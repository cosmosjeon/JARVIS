const BLANK_TITLE = '제목 없는 트리';

const sanitizeTitle = (title) => {
  if (typeof title !== 'string') {
    return BLANK_TITLE;
  }
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : BLANK_TITLE;
};

const buildExistingTitleSet = ({ trees, targetFolderId, movingTreeIds }) => {
  return trees
    .filter((tree) => {
      const isTargetFolder = (tree.folderId ?? null) === (targetFolderId ?? null);
      return isTargetFolder && !movingTreeIds.has(tree.id);
    })
    .reduce((acc, tree) => {
      acc.add(sanitizeTitle(tree.title));
      return acc;
    }, new Set());
};

const generateUniqueTitle = (baseTitle, occupiedTitles) => {
  const base = sanitizeTitle(baseTitle);
  if (!occupiedTitles.has(base)) {
    occupiedTitles.add(base);
    return base;
  }

  const match = base.match(/^(.*?)(?:\s*\((\d+)\))?$/);
  const stem = (match?.[1] ?? base).trim();
  let counter = Number(match?.[2]) || 1;
  let candidate = `${stem} (${counter})`;

  while (occupiedTitles.has(candidate)) {
    counter += 1;
    candidate = `${stem} (${counter})`;
  }

  occupiedTitles.add(candidate);
  return candidate;
};

export const planTreeMoves = ({ trees, treeIds, targetFolderId }) => {
  const normalizedIds = Array.isArray(treeIds) ? treeIds.filter(Boolean) : [];
  const dedupedIds = Array.from(new Set(normalizedIds));

  const treeLookup = trees.reduce((acc, tree) => {
    acc.set(tree.id, tree);
    return acc;
  }, new Map());

  const movingTreeIds = new Set(dedupedIds);
  const occupiedTitles = buildExistingTitleSet({
    trees,
    targetFolderId,
    movingTreeIds,
  });

  const moves = [];
  const skipped = [];
  const missing = [];

  dedupedIds.forEach((treeId) => {
    const tree = treeLookup.get(treeId);
    if (!tree) {
      missing.push(treeId);
      return;
    }

    const currentFolderId = tree.folderId ?? null;
    const nextFolderId = targetFolderId ?? null;

    if (currentFolderId === nextFolderId) {
      skipped.push({ id: treeId, reason: 'already-in-target' });
      return;
    }

    const originalTitle = sanitizeTitle(tree.title);
    const nextTitle = generateUniqueTitle(originalTitle, occupiedTitles);

    moves.push({
      id: treeId,
      currentFolderId,
      nextFolderId,
      previousTitle: originalTitle,
      nextTitle,
      renamed: originalTitle !== nextTitle,
    });
  });

  return {
    moves,
    skipped,
    missing,
    targetFolderId: targetFolderId ?? null,
  };
};

export const applyTreeMovePlan = ({ trees, plan, successfulIds }) => {
  if (!plan?.moves?.length) {
    return trees;
  }

  const successSet = new Set(successfulIds ?? plan.moves.map((move) => move.id));
  if (successSet.size === 0) {
    return trees;
  }

  const successLookup = plan.moves
    .filter((move) => successSet.has(move.id))
    .reduce((acc, move) => {
      acc.set(move.id, move);
      return acc;
    }, new Map());

  return trees.map((tree) => {
    const move = successLookup.get(tree.id);
    if (!move) {
      return tree;
    }
    return {
      ...tree,
      folderId: move.nextFolderId,
      title: move.nextTitle,
    };
  });
};

export const revertTreeMovePlan = ({ trees, plan, revertIds }) => {
  if (!plan?.moves?.length) {
    return trees;
  }
  const revertSet = new Set(revertIds ?? plan.moves.map((move) => move.id));
  if (revertSet.size === 0) {
    return trees;
  }
  const lookup = plan.moves
    .filter((move) => revertSet.has(move.id))
    .reduce((acc, move) => {
      acc.set(move.id, move);
      return acc;
    }, new Map());

  return trees.map((tree) => {
    const move = lookup.get(tree.id);
    if (!move) {
      return tree;
    }
    return {
      ...tree,
      folderId: move.currentFolderId,
      title: move.previousTitle,
    };
  });
};

export const summariseMovePlan = ({ plan, successfulIds }) => {
  if (!plan) {
    return {
      moved: [],
      renamed: [],
    };
  }

  const successSet = new Set(successfulIds ?? plan.moves.map((move) => move.id));
  const moved = [];
  const renamed = [];

  plan.moves.forEach((move) => {
    if (!successSet.has(move.id)) {
      return;
    }
    moved.push({ id: move.id, targetFolderId: move.nextFolderId });
    if (move.renamed) {
      renamed.push({
        id: move.id,
        previousTitle: move.previousTitle,
        newTitle: move.nextTitle,
      });
    }
  });

  return { moved, renamed };
};

export const buildUndoSnapshot = ({ plan, successfulIds }) => {
  if (!plan?.moves?.length) {
    return [];
  }
  const successSet = new Set(successfulIds ?? plan.moves.map((move) => move.id));
  return plan.moves
    .filter((move) => successSet.has(move.id))
    .map((move) => ({
      id: move.id,
      folderId: move.currentFolderId,
      title: move.previousTitle,
    }));
};

export default planTreeMoves;
