import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import TreeNode from 'features/tree/ui/components/TreeNode';
import QuestionService from 'features/tree/services/QuestionService';
import { PANEL_SIZES } from 'features/tree/ui/components/NodeAssistantPanel';

describe('TreeNode', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('bubbles branch requests from NodeAssistantPanel to parent', async () => {
    jest.useFakeTimers();

    const node = { id: 'root', keyword: 'Root', fullText: '', level: 0, size: 20 };
    const mockOnSecondQuestion = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <svg>
        <TreeNode
          node={node}
          position={{ x: 100, y: 100 }}
          color="#1d4ed8"
          onNodeClick={() => {}}
          isExpanded={true}
          onSecondQuestion={mockOnSecondQuestion}
          questionService={new QuestionService()}
        />
      </svg>
    );

    // Wait for panel to render in expanded mode
    const input = await screen.findByPlaceholderText('Ask anything...');

    // Send first message (should not trigger branch)
    await user.type(input, '첫 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(mockOnSecondQuestion).not.toHaveBeenCalled();

    // Send second message (should trigger branch request)
    await user.type(input, '두 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // Expect TreeNode to bubble the branch request to its parent
    expect(mockOnSecondQuestion).toHaveBeenCalledTimes(1);
    const callArgs = mockOnSecondQuestion.mock.calls[0];
    expect(callArgs[0]).toBe(node.id);
    expect(callArgs[1]).toBe('두 번째 메시지');
    expect(typeof callArgs[2]).toBe('string');

    jest.useRealTimers();
  });

  it('maintains question count across re-renders when sharing QuestionService', async () => {
    jest.useFakeTimers();

    const node = { id: 'root', keyword: 'Root', fullText: '', level: 0, size: 20 };
    const sharedQuestionService = new QuestionService();
    const mockOnSecondQuestion = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const conversationStore = new Map();

    const { unmount } = render(
      <svg>
        <TreeNode
          node={node}
          position={{ x: 100, y: 100 }}
          color="#1d4ed8"
          onNodeClick={() => {}}
          isExpanded={true}
          onSecondQuestion={mockOnSecondQuestion}
          questionService={sharedQuestionService}
          initialConversation={conversationStore.get(node.id) || []}
          onConversationChange={(messages) => conversationStore.set(node.id, messages)}
        />
      </svg>
    );

    const input = await screen.findByPlaceholderText('Ask anything...');

    await user.type(input, '첫 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await user.type(input, '두 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(mockOnSecondQuestion).toHaveBeenCalledTimes(1);
    expect((conversationStore.get(node.id) || []).length).toBeGreaterThan(0);

    unmount();

    render(
      <svg>
        <TreeNode
          node={node}
          position={{ x: 100, y: 100 }}
          color="#1d4ed8"
          onNodeClick={() => {}}
          isExpanded={true}
          onSecondQuestion={mockOnSecondQuestion}
          questionService={sharedQuestionService}
          initialConversation={conversationStore.get(node.id) || []}
          onConversationChange={(messages) => conversationStore.set(node.id, messages)}
        />
      </svg>
    );

    const secondRenderInput = await screen.findByPlaceholderText('Ask anything...');
    expect(await screen.findByText('첫 번째 메시지')).toBeInTheDocument();

    await user.type(secondRenderInput, '첫 번째 이후 추가 질문{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await user.type(secondRenderInput, '두 번째 이후 추가 질문{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(mockOnSecondQuestion).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('restores expanded panel size when reopening with existing assistant replies', async () => {
    jest.useFakeTimers();

    const node = { id: 'root', keyword: 'Root', fullText: '', level: 0, size: 20 };
    const storedConversation = [
      { id: 'seed-user', role: 'user', text: '이전 질문' },
      { id: 'seed-assistant', role: 'assistant', text: '이전 답변', status: 'complete' },
    ];

    const { rerender, container } = render(
      <svg>
        <TreeNode
          node={node}
          position={{ x: 100, y: 100 }}
          color="#1d4ed8"
          onNodeClick={() => {}}
          isExpanded={false}
          questionService={new QuestionService()}
          initialConversation={[]}
        />
      </svg>
    );

    rerender(
      <svg>
        <TreeNode
          node={node}
          position={{ x: 100, y: 100 }}
          color="#1d4ed8"
          onNodeClick={() => {}}
          isExpanded={true}
          questionService={new QuestionService()}
          initialConversation={storedConversation}
        />
      </svg>
    );

    await waitFor(() => {
      const panel = container.querySelector('foreignObject');
      expect(panel).not.toBeNull();
      expect(parseFloat(panel?.getAttribute('width') || '')).toBe(PANEL_SIZES.expanded.width);
      expect(parseFloat(panel?.getAttribute('height') || '')).toBe(PANEL_SIZES.expanded.height);
    });

    jest.useRealTimers();
  });
});
