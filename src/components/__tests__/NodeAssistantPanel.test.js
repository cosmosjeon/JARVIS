import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { render, screen, within } from '@testing-library/react';
import NodeAssistantPanel, { PANEL_SIZES } from '../NodeAssistantPanel';
import { treeData } from '../../data/treeData';

describe('NodeAssistantPanel', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts empty and shows path-style placeholder, then renders centered markdown after first question', async () => {
    jest.useFakeTimers();

    const node = treeData.nodes[0];
    const handleSizeChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<NodeAssistantPanel node={node} color="#1d4ed8" onSizeChange={handleSizeChange} />);

    const input = screen.getByPlaceholderText('/Users/cosmos/Documents/develop/r/와이어프레임/ui5-1-2.png 같은 파일 경로로 질문을 입력해 주세요');
    expect(input).toBeInTheDocument();

    expect(handleSizeChange).toHaveBeenCalledTimes(1);
    expect(handleSizeChange).toHaveBeenNthCalledWith(1, PANEL_SIZES.compact);

    const noAssistantMessage = screen.queryByTestId('assistant-message');
    expect(noAssistantMessage).toBeNull();

    await user.type(input, '테스트 질문{enter}');

    const assistantMessage = await screen.findByTestId('assistant-message');

    await act(async () => {
      jest.runAllTimers();
    });

    expect(handleSizeChange).toHaveBeenLastCalledWith(PANEL_SIZES.expanded);
    expect(assistantMessage).toHaveClass('justify-center');

    const listItems = within(assistantMessage).getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);

    jest.useRealTimers();
  });
});
