import { BLOCK_DEFINITIONS, BLOCK_TYPES } from './blockTypes';

const randomId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `block-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeBlock = (raw) => {
    if (!raw || typeof raw !== 'object') {
        return createBlock();
    }

    const definition = BLOCK_DEFINITIONS[raw.type] || BLOCK_DEFINITIONS[BLOCK_TYPES.TEXT];
    const baseChildren = Array.isArray(raw.children) ? raw.children : [];

    return {
        id: raw.id || randomId(),
        type: raw.type || BLOCK_TYPES.TEXT,
        html: typeof raw.html === 'string' ? raw.html : '',
        props: { ...(definition.create?.().props || {}), ...(raw.props || {}) },
        children: baseChildren.map((child) => normalizeBlock(child)),
    };
};

export const createBlock = (type = BLOCK_TYPES.TEXT) => {
    const definition = BLOCK_DEFINITIONS[type] || BLOCK_DEFINITIONS[BLOCK_TYPES.TEXT];
    const payload = typeof definition.create === 'function' ? definition.create() : { html: '', props: {} };
    return {
        id: randomId(),
        type,
        html: payload.html ?? '',
        props: payload.props ?? {},
        children: Array.isArray(payload.children) ? payload.children.map((child) => ({ ...child, id: randomId() })) : [],
    };
};

export const cloneBlock = (block) => ({
    ...block,
    id: randomId(),
    children: block.children?.map(cloneBlock) ?? [],
    props: { ...(block.props || {}) },
});

export const getBlockAtPath = (blocks, path) => {
    let cursor = blocks;
    let target = null;
    for (let i = 0; i < path.length; i += 1) {
        const index = path[i];
        if (!cursor || !Array.isArray(cursor) || !cursor[index]) {
            return null;
        }
        target = cursor[index];
        cursor = target.children;
    }
    return target;
};

export const setBlockAtPath = (blocks, path, updater) => {
    if (!Array.isArray(path) || path.length === 0) {
        return typeof updater === 'function' ? updater(blocks) : updater;
    }

    const [currentIndex, ...rest] = path;

    return blocks.map((block, index) => {
        if (index !== currentIndex) {
            return block;
        }
        if (rest.length === 0) {
            return typeof updater === 'function' ? updater(block) : updater;
        }
        return {
            ...block,
            children: setBlockAtPath(block.children || [], rest, updater),
        };
    });
};

export const insertBlockAfterPath = (blocks, path, newBlock) => {
    if (path.length === 0) {
        return [...blocks, newBlock];
    }

    const [index, ...rest] = path;

    return blocks.map((block, i) => {
        if (i !== index) {
            return block;
        }

        if (rest.length === 0) {
            const children = block.children || [];
            return {
                ...block,
                children,
            };
        }

        return {
            ...block,
            children: insertBlockAfterPath(block.children || [], rest, newBlock),
        };
    });
};

export const insertSiblingAfter = (blocks, path, newBlock) => {
    if (path.length === 0) {
        const draft = [...blocks];
        draft.push(newBlock);
        return draft;
    }

    const targetIndex = path[path.length - 1];
    const parentPath = path.slice(0, -1);

    if (parentPath.length === 0) {
        const draft = [...blocks];
        draft.splice(targetIndex + 1, 0, newBlock);
        return draft;
    }

    return setBlockAtPath(blocks, parentPath, (parent) => ({
        ...parent,
        children: insertSiblingAfter(parent.children || [], [targetIndex], newBlock),
    }));
};

export const removeBlockAtPath = (blocks, path) => {
    if (path.length === 0) {
        return blocks;
    }

    const targetIndex = path[path.length - 1];
    const parentPath = path.slice(0, -1);

    if (parentPath.length === 0) {
        return blocks.filter((_, index) => index !== targetIndex);
    }

    return setBlockAtPath(blocks, parentPath, (parent) => ({
        ...parent,
        children: (parent.children || []).filter((_, index) => index !== targetIndex),
    }));
};

export const findBlockById = (blocks, targetId, path = []) => {
    for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        const currentPath = [...path, i];
        if (block.id === targetId) {
            return { block, path: currentPath };
        }
        if (block.children && block.children.length > 0) {
            const found = findBlockById(block.children, targetId, currentPath);
            if (found) {
                return found;
            }
        }
    }
    return null;
};

export const insertBlockAtPath = (blocks, path, newBlock) => {
    if (path.length === 0) {
        return [newBlock, ...blocks];
    }

    const targetIndex = path[path.length - 1];
    const parentPath = path.slice(0, -1);

    if (parentPath.length === 0) {
        const draft = [...blocks];
        draft.splice(targetIndex, 0, newBlock);
        return draft;
    }

    return setBlockAtPath(blocks, parentPath, (parent) => ({
        ...parent,
        children: insertBlockAtPath(parent.children || [], [targetIndex], newBlock),
    }));
};

export const indentBlock = (blocks, path) => {
    if (path.length === 0) {
        return blocks;
    }

    const targetIndex = path[path.length - 1];
    if (targetIndex === 0) {
        return blocks;
    }

    const parentPath = path.slice(0, -1);

    const currentSiblings = parentPath.length === 0
        ? blocks
        : getBlockAtPath(blocks, parentPath)?.children || [];

    const previousSibling = currentSiblings[targetIndex - 1];
    if (!previousSibling) {
        return blocks;
    }

    const block = getBlockAtPath(blocks, path);
    if (!block) {
        return blocks;
    }

    const removed = removeBlockAtPath(blocks, path);

    const nextPath = [...parentPath, targetIndex - 1];

    return setBlockAtPath(removed, nextPath, (sibling) => ({
        ...sibling,
        children: [...(sibling.children || []), block],
    }));
};

export const outdentBlock = (blocks, path) => {
    if (path.length <= 1) {
        return blocks;
    }

    const parentPath = path.slice(0, -1);
    const parentIndex = parentPath[parentPath.length - 1];
    const grandParentPath = parentPath.slice(0, -1);

    const parentBlock = getBlockAtPath(blocks, parentPath);
    if (!parentBlock) {
        return blocks;
    }

    const block = getBlockAtPath(blocks, path);
    if (!block) {
        return blocks;
    }

    const withoutBlock = setBlockAtPath(blocks, parentPath, (parent) => ({
        ...parent,
        children: (parent.children || []).filter((child) => child.id !== block.id),
    }));

    if (grandParentPath.length === 0) {
        const draft = [...withoutBlock];
        draft.splice(parentIndex + 1, 0, block);
        return draft;
    }

    return setBlockAtPath(withoutBlock, grandParentPath, (grand) => ({
        ...grand,
        children: insertSiblingAfter(grand.children || [], [parentIndex], block),
    }));
};

export const flattenBlocks = (blocks, depth = 0) => {
    return blocks.reduce((acc, block, index) => {
        acc.push({ block, depth, index });
        if (block.children && block.children.length > 0) {
            acc.push(...flattenBlocks(block.children, depth + 1));
        }
        return acc;
    }, []);
};

export const serializeBlocks = (blocks) => JSON.stringify({ version: 2, blocks });

export const deserializeBlocks = (payload) => {
    if (!payload) {
        return [createBlock(BLOCK_TYPES.TEXT)];
    }

    try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (Array.isArray(parsed)) {
            return parsed.map((block) => normalizeBlock(block));
        }
        if (Array.isArray(parsed.blocks)) {
            return parsed.blocks.map((block) => normalizeBlock(block));
        }
    } catch (error) {
        // fallback: treat payload as plain text
        const lines = String(payload).split(/\r?\n/);
        return lines.map((line) => {
            if (!line.trim()) {
                return createBlock(BLOCK_TYPES.TEXT);
            }
            if (line.startsWith('# ')) {
                const block = createBlock(BLOCK_TYPES.HEADING_1);
                block.html = line.slice(2);
                return block;
            }
            if (line.startsWith('## ')) {
                const block = createBlock(BLOCK_TYPES.HEADING_2);
                block.html = line.slice(3);
                return block;
            }
            if (line.startsWith('### ')) {
                const block = createBlock(BLOCK_TYPES.HEADING_3);
                block.html = line.slice(4);
                return block;
            }
            if (line.startsWith('- [ ] ')) {
                const block = createBlock(BLOCK_TYPES.TODO);
                block.props.checked = false;
                block.html = line.slice(6);
                return block;
            }
            if (line.startsWith('- [x] ')) {
                const block = createBlock(BLOCK_TYPES.TODO);
                block.props.checked = true;
                block.html = line.slice(6);
                return block;
            }
            if (line.startsWith('- ')) {
                const block = createBlock(BLOCK_TYPES.BULLETED_LIST);
                block.html = line.slice(2);
                return block;
            }
            const block = createBlock(BLOCK_TYPES.TEXT);
            block.html = line;
            return block;
        });
    }
    return [createBlock(BLOCK_TYPES.TEXT)];
};

export const mapBlocks = (blocks, iteratee) => blocks.map((block, index) => iteratee(block, index));

export const updateBlockHtml = (blocks, path, html) => {
    return setBlockAtPath(blocks, path, (block) => ({
        ...block,
        html,
    }));
};

export const updateBlockProps = (blocks, path, props) => {
    return setBlockAtPath(blocks, path, (block) => ({
        ...block,
        props: { ...block.props, ...props },
    }));
};

export const transformBlockType = (block, nextType) => {
    const definition = BLOCK_DEFINITIONS[nextType] || BLOCK_DEFINITIONS[BLOCK_TYPES.TEXT];
    const payload = typeof definition.create === 'function' ? definition.create() : { html: '', props: {} };
    return {
        ...block,
        type: nextType,
        html: payload.html ?? '',
        props: { ...(payload.props || {}) },
        children: Array.isArray(payload.children) ? payload.children : block.children || [],
    };
};
