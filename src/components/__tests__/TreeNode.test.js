import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import TreeNode from '../TreeNode';
import { treeData } from '../../data/treeData';

describe('TreeNode', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('bubbles branch requests from NodeAssistantPanel to parent', async () => {
    jest.useFakeTimers();

    const node = treeData.nodes[0]; // CEO node
    const mockOnBranchRequest = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <svg>
        <TreeNode
          node={node}
          position={{ x: 100, y: 100 }}
          color="#1d4ed8"
          onNodeClick={() => {}}
          isExpanded={true}
          onBranchRequest={mockOnBranchRequest}
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

    expect(mockOnBranchRequest).not.toHaveBeenCalled();

    // Send second message (should trigger branch request)
    await user.type(input, '두 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // Expect TreeNode to bubble the branch request to its parent
    expect(mockOnBranchRequest).toHaveBeenCalledTimes(1);
    const payload = mockOnBranchRequest.mock.calls[0][0];
    expect(payload.parentNode.id).toBe(node.id);
    expect(payload.question).toBe('두 번째 메시지');

    jest.useRealTimers();
  });
});