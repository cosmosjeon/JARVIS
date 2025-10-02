/**
 * DataTransformService
 * 
 * Business Logic: 트리 데이터 구조 변환
 * nodes/links 배열을 D3 hierarchy 형태로 변환
 */

const nodeToHierarchy = (node) => {
    const isMemoNode = node?.nodeType === 'memo';
    const memoTitle = isMemoNode ? (node?.memo?.title || '') : '';
    const resolvedName = (isMemoNode ? (memoTitle || node.keyword || node.id || 'Memo') : (node.keyword || node.id || 'Node'));

    return {
        name: resolvedName,
        id: node.id,
        data: { ...node }
    };
};

const transformToHierarchy = (nodes, links) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return null;
    }

    const safeLinks = Array.isArray(links) ? links : [];

    const targetIds = new Set(
        safeLinks.map(link =>
            typeof link.target === 'object' ? link.target.id : link.target
        )
    );

    let rootCandidates = nodes
        .filter(node => !targetIds.has(node.id))
        .map(node => node.id);

    if (rootCandidates.length === 0) {
        rootCandidates = [nodes[0].id];
    }

    const childrenMap = new Map();
    safeLinks.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        if (!childrenMap.has(sourceId)) {
            childrenMap.set(sourceId, []);
        }
        childrenMap.get(sourceId).push(targetId);
    });

    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    const buildHierarchy = (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) return null;

        const hierarchyNode = nodeToHierarchy(node);

        const childIds = childrenMap.get(nodeId) || [];
        if (childIds.length > 0) {
            hierarchyNode.children = childIds
                .map(childId => buildHierarchy(childId))
                .filter(Boolean);
        }

        return hierarchyNode;
    };

    const roots = rootCandidates
        .map(candidateId => buildHierarchy(candidateId))
        .filter(Boolean);

    if (roots.length === 0) {
        return null;
    }

    if (roots.length === 1) {
        return roots[0];
    }

    return {
        name: '__virtual_root__',
        id: '__virtual_root__',
        data: { id: '__virtual_root__', name: '__virtual_root__' },
        children: roots,
    };
};

const isValidHierarchy = (hierarchy) => {
    if (!hierarchy || typeof hierarchy !== 'object') {
        return false;
    }

    if (!hierarchy.name || !hierarchy.id) {
        return false;
    }

    if (hierarchy.children && !Array.isArray(hierarchy.children)) {
        return false;
    }

    return true;
};

const DataTransformService = {
    transformToHierarchy,
    nodeToHierarchy,
    isValidHierarchy,
};

export default DataTransformService;
