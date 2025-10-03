import { transformTreeRowsToLibraryData } from '../supabaseTrees';

describe('transformTreeRowsToLibraryData', () => {
  const baseTree = {
    id: 'tree-1',
    title: '테스트 트리',
    created_at: Date.now(),
    updated_at: Date.now(),
    folder_id: null,
  };

  it('사이클 노드를 제외하고 유효 링크만 유지한다', () => {
    const rows = [
      {
        id: 'A',
        tree_id: 'tree-1',
        parent_id: 'B',
        keyword: 'A',
        question: 'A?',
        answer: 'A!',
        status: 'answered',
        node_type: 'question',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'B',
        tree_id: 'tree-1',
        parent_id: 'A',
        keyword: 'B',
        question: 'B?',
        answer: 'B!',
        status: 'answered',
        node_type: 'question',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'ROOT',
        tree_id: 'tree-1',
        parent_id: null,
        keyword: 'Root',
        question: 'Root?',
        answer: 'Root!',
        status: 'answered',
        node_type: 'question',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'CHILD',
        tree_id: 'tree-1',
        parent_id: 'ROOT',
        keyword: 'Child',
        question: 'Child?',
        answer: 'Child!',
        status: 'answered',
        node_type: 'question',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ];

    const [tree] = transformTreeRowsToLibraryData([baseTree], rows);

    expect(tree.treeData.nodes.map((node) => node.id)).toEqual(['ROOT', 'CHILD']);
    expect(tree.treeData.links).toEqual([
      { source: 'ROOT', target: 'CHILD', value: 1 },
    ]);
  });
});
