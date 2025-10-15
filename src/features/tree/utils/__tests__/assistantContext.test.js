import collectAncestorConversationMessages from '../assistantContext';

const buildMap = (entries) => {
  const map = new Map();
  entries.forEach(([child, parent]) => {
    map.set(child, parent);
  });
  return map;
};

describe('collectAncestorConversationMessages', () => {
  it('루트부터 대상 노드까지의 대화를 순서대로 합쳐 반환한다', () => {
    const parentByChild = buildMap([
      ['child', 'root'],
      ['leaf', 'child'],
    ]);

    const conversations = {
      root: [
        { role: 'user', text: 'root question' },
        { role: 'assistant', text: 'root answer' },
      ],
      child: [
        { role: 'user', text: 'child question' },
      ],
      leaf: [
        { role: 'assistant', text: 'leaf answer' },
      ],
    };

    const getConversation = (nodeId) => conversations[nodeId];

    const result = collectAncestorConversationMessages({
      nodeId: 'leaf',
      parentByChild,
      getConversation,
      maxMessages: 12,
    });

    expect(result).toEqual([
      { role: 'user', content: 'root question' },
      { role: 'assistant', content: 'root answer' },
      { role: 'user', content: 'child question' },
      { role: 'assistant', content: 'leaf answer' },
    ]);
  });

  it('maxMessages 제한을 넘는 경우 최신 메시지만 유지한다', () => {
    const parentByChild = buildMap([
      ['child', 'root'],
    ]);

    const conversations = {
      root: Array.from({ length: 5 }).map((_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        text: `root ${index}`,
      })),
      child: Array.from({ length: 5 }).map((_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        text: `child ${index}`,
      })),
    };

    const getConversation = (nodeId) => conversations[nodeId];

    const result = collectAncestorConversationMessages({
      nodeId: 'child',
      parentByChild,
      getConversation,
      maxMessages: 6,
    });

    expect(result).toHaveLength(6);
    expect(result.map((entry) => entry.content)).toEqual([
      'root 4',
      'child 0',
      'child 1',
      'child 2',
      'child 3',
      'child 4',
    ]);
  });

  it('부모 맵에 순환이 있어도 중복 없이 순회를 종료한다', () => {
    const parentByChild = buildMap([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'], // cycle
    ]);

    const conversationByNode = {
      a: [{ role: 'user', text: 'a question' }],
      b: [{ role: 'assistant', text: 'b answer' }],
      c: [{ role: 'user', text: 'c question' }],
    };

    const result = collectAncestorConversationMessages({
      nodeId: 'a',
      parentByChild,
      getConversation: (id) => conversationByNode[id],
    });

    expect(result).toEqual([
      { role: 'user', content: 'c question' },
      { role: 'assistant', content: 'b answer' },
      { role: 'user', content: 'a question' },
    ]);
  });

  it('잘못된 노드 또는 대화가 없으면 빈 배열을 반환한다', () => {
    const parentByChild = buildMap([
      ['child', 'root'],
    ]);

    const getConversation = jest.fn(() => null);

    expect(
      collectAncestorConversationMessages({
        nodeId: null,
        parentByChild,
        getConversation,
      }),
    ).toEqual([]);

    expect(
      collectAncestorConversationMessages({
        nodeId: 'child',
        parentByChild,
        getConversation,
      }),
    ).toEqual([]);
  });

  it('fallbackParentResolver를 사용해 부모 체인을 복원한다', () => {
    const parentByChild = new Map();

    const conversations = {
      root: [
        { role: 'user', text: 'root question' },
        { role: 'assistant', text: 'root answer' },
      ],
      child: [
        { role: 'user', text: 'child question' },
      ],
    };

    const fallbackParentResolver = jest.fn((nodeId) => {
      if (nodeId === 'child') {
        return 'root';
      }
      return null;
    });

    const result = collectAncestorConversationMessages({
      nodeId: 'child',
      parentByChild,
      getConversation: (id) => conversations[id],
      fallbackParentResolver,
    });

    expect(fallbackParentResolver).toHaveBeenCalledWith('child');
    expect(result).toEqual([
      { role: 'user', content: 'root question' },
      { role: 'assistant', content: 'root answer' },
      { role: 'user', content: 'child question' },
    ]);
  });
});
