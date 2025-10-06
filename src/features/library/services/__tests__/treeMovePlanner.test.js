import {
  planTreeMoves,
  applyTreeMovePlan,
  revertTreeMovePlan,
  summariseMovePlan,
} from '../treeMovePlanner';

const createTree = ({ id, title, folderId }) => ({
  id,
  title,
  folderId: folderId ?? null,
});

describe('treeMovePlanner', () => {
  const baseTrees = [
    createTree({ id: 'tree-1', title: 'Alpha', folderId: null }),
    createTree({ id: 'tree-2', title: 'Beta', folderId: null }),
    createTree({ id: 'tree-3', title: 'Alpha', folderId: 'folder-a' }),
    createTree({ id: 'tree-4', title: 'Delta (2)', folderId: 'folder-a' }),
  ];

  it('identifies moves and renames when conflicts exist', () => {
    const plan = planTreeMoves({
      trees: baseTrees,
      treeIds: ['tree-1', 'tree-2'],
      targetFolderId: 'folder-a',
    });

    expect(plan.missing).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
    expect(plan.moves).toHaveLength(2);

    const [first, second] = plan.moves;
    expect(first.id).toBe('tree-1');
    expect(first.nextTitle).toBe('Alpha (2)');
    expect(first.renamed).toBe(true);
    expect(second.id).toBe('tree-2');
    expect(second.nextTitle).toBe('Beta');
    expect(second.renamed).toBe(false);
  });

  it('skips moves when tree already in target folder', () => {
    const plan = planTreeMoves({
      trees: baseTrees,
      treeIds: ['tree-3'],
      targetFolderId: 'folder-a',
    });

    expect(plan.moves).toHaveLength(0);
    expect(plan.skipped).toEqual([
      { id: 'tree-3', reason: 'already-in-target' },
    ]);
  });

  it('returns missing ids when tree not found', () => {
    const plan = planTreeMoves({
      trees: baseTrees,
      treeIds: ['unknown'],
      targetFolderId: 'folder-a',
    });

    expect(plan.moves).toHaveLength(0);
    expect(plan.missing).toEqual(['unknown']);
  });

  it('applies move results to tree collection', () => {
    const plan = planTreeMoves({
      trees: baseTrees,
      treeIds: ['tree-1', 'tree-2'],
      targetFolderId: 'folder-a',
    });

    const nextTrees = applyTreeMovePlan({ trees: baseTrees, plan, successfulIds: ['tree-1'] });

    const movedTree = nextTrees.find((tree) => tree.id === 'tree-1');
    const untouchedTree = nextTrees.find((tree) => tree.id === 'tree-2');

    expect(movedTree.folderId).toBe('folder-a');
    expect(movedTree.title).toBe('Alpha (2)');
    expect(untouchedTree.folderId).toBe(null);
    expect(untouchedTree.title).toBe('Beta');
  });

  it('reverts move plan for undo operations', () => {
    const plan = planTreeMoves({
      trees: baseTrees,
      treeIds: ['tree-1'],
      targetFolderId: 'folder-a',
    });
    const movedTrees = applyTreeMovePlan({ trees: baseTrees, plan });

    const reverted = revertTreeMovePlan({ trees: movedTrees, plan });
    const revertedTree = reverted.find((tree) => tree.id === 'tree-1');

    expect(revertedTree.folderId).toBe(null);
    expect(revertedTree.title).toBe('Alpha');
  });

  it('summarises moves and renames for callers', () => {
    const plan = planTreeMoves({
      trees: baseTrees,
      treeIds: ['tree-1', 'tree-2'],
      targetFolderId: 'folder-a',
    });

    const summary = summariseMovePlan({ plan, successfulIds: ['tree-1'] });

    expect(summary.moved).toEqual([
      { id: 'tree-1', targetFolderId: 'folder-a' },
    ]);
    expect(summary.renamed).toEqual([
      { id: 'tree-1', previousTitle: 'Alpha', newTitle: 'Alpha (2)' },
    ]);
  });
});
