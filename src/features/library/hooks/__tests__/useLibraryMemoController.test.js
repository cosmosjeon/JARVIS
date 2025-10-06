import { renderHook, act } from '@testing-library/react';
import { useLibraryMemoController } from '../useLibraryMemoController';

const createTreeFixture = () => ({
  id: 'tree-1',
  treeData: {
    nodes: [
      { id: 'node-1', memo: null },
      { id: 'node-2', memo: null },
    ],
    links: [],
  },
});

describe('useLibraryMemoController', () => {
  it('creates, updates, and removes memo on the selected tree node', () => {
    const tree = createTreeFixture();
    let latestTrees = [tree];

    const setTrees = jest.fn((updater) => {
      latestTrees = updater(latestTrees);
      return latestTrees;
    });

    const getSelectedTree = () => latestTrees[0];

    const { result } = renderHook(() => useLibraryMemoController({ setTrees, getSelectedTree }));

    let createdId;
    act(() => {
      createdId = result.current.create('node-1');
    });

    expect(typeof createdId).toBe('string');
    expect(setTrees).toHaveBeenCalledTimes(1);
    expect(latestTrees[0].treeData.nodes.find((node) => node.id === 'node-1').memo).not.toBeNull();

    act(() => {
      result.current.update('node-1', { title: 'updated', content: 'hello' });
    });

    const updatedMemo = latestTrees[0].treeData.nodes.find((node) => node.id === 'node-1').memo;
    expect(updatedMemo.title).toBe('updated');
    expect(updatedMemo.content).toBe('hello');

    act(() => {
      result.current.remove(createdId);
    });

    expect(latestTrees[0].treeData.nodes.find((node) => node.id === 'node-1').memo).toBeNull();
  });
});
