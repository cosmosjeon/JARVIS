import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { render, screen, within } from '@testing-library/react';
import NodeAssistantPanel, { PANEL_SIZES } from '../NodeAssistantPanel';
import { createTreeNodeSummary, isTreeRootNode } from '../../services/TreeSummaryService';

jest.mock('web-highlighter', () => {
  const instances = [];

  class MockHighlighter {
    static event = { CREATE: 'create', REMOVE: 'remove' };

    constructor() {
      this.handlers = {};
      this.run = jest.fn();
      this.dispose = jest.fn();
      this.removeAll = jest.fn();
      instances.push(this);
    }

    on(event, handler) {
      this.handlers[event] = handler;
      return this;
    }

    off(event, handler) {
      if (this.handlers[event] === handler) {
        delete this.handlers[event];
      }
      return this;
    }

    emit(event, payload) {
      this.handlers[event]?.(payload, this);
    }
  }

  MockHighlighter.__getLastInstance = () => instances[instances.length - 1];

  return {
    __esModule: true,
    default: MockHighlighter,
  };
});

describe('NodeAssistantPanel', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('초기 렌더링이 예상된 스냅샷과 일치한다', () => {
    const node = { id: 'root', keyword: 'Root', fullText: '' };
    const summary = createTreeNodeSummary(node);

    const { asFragment } = render(
      <NodeAssistantPanel
        node={node}
        color="#1d4ed8"
        nodeSummary={summary}
        isRootNode={isTreeRootNode(node)}
      />,
    );

    expect(asFragment()).toMatchSnapshot();
  });

  it('starts empty and shows path-style placeholder, then renders centered markdown after first question', async () => {
    jest.useFakeTimers();

    const node = { id: 'root', keyword: 'Root', fullText: '' };
    const handleSizeChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const summary = createTreeNodeSummary(node);

    render(
      <NodeAssistantPanel
        node={node}
        color="#1d4ed8"
        onSizeChange={handleSizeChange}
        nodeSummary={summary}
        isRootNode={isTreeRootNode(node)}
      />,
    );

    const input = screen.getByPlaceholderText('Ask anything...');
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

  it('토글 버튼으로 하이라이트 모드를 전환하고 Highlighter 인스턴스를 관리한다', async () => {
    const node = { id: 'root', keyword: 'Root', fullText: '' };
    const user = userEvent.setup();

    const summary = createTreeNodeSummary(node);

    render(
      <NodeAssistantPanel
        node={node}
        color="#1d4ed8"
        nodeSummary={summary}
        isRootNode={isTreeRootNode(node)}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: '하이라이트 모드' });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');

    const { default: MockHighlighter } = await import('web-highlighter');
    const instance = MockHighlighter.__getLastInstance();

    expect(instance).toBeDefined();
    expect(instance.run).toHaveBeenCalledTimes(1);

    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    expect(instance.dispose).toHaveBeenCalledTimes(1);
    expect(instance.removeAll).toHaveBeenCalledTimes(1);
  });

  it('하이라이트 모드에서 선택된 텍스트로 하위 노드를 생성한다', async () => {
    const node = treeData.nodes[0];
    const onPlaceholderCreate = jest.fn();
    const user = userEvent.setup();

    const summary = createTreeNodeSummary(node);

    render(
      <NodeAssistantPanel
        node={node}
        color="#1d4ed8"
        onPlaceholderCreate={onPlaceholderCreate}
        nodeSummary={summary}
        isRootNode={isTreeRootNode(node)}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: '하이라이트 모드' });
    const input = screen.getByPlaceholderText('Ask anything...');

    await user.click(toggleButton);

    const { default: MockHighlighter } = await import('web-highlighter');
    const instance = MockHighlighter.__getLastInstance();

    instance.emit(MockHighlighter.event.CREATE, {
      sources: [
        { id: 'alpha', text: 'Alpha' },
        { id: 'beta', text: 'Beta' },
      ],
    });

    await user.type(input, '{enter}');

    expect(onPlaceholderCreate).toHaveBeenCalledWith(node.id, ['Alpha', 'Beta']);
  });

  it('첫 번째 질문 이후에도 하이라이트로 플레이스홀더를 만들 수 있다', async () => {
    jest.useFakeTimers();

    const node = treeData.nodes[0];
    const onPlaceholderCreate = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <NodeAssistantPanel
        node={node}
        color="#1d4ed8"
        onPlaceholderCreate={onPlaceholderCreate}
        nodeSummary={createTreeNodeSummary(node)}
        isRootNode={isTreeRootNode(node)}
      />,
    );

    const input = screen.getByPlaceholderText('Ask anything...');

    await user.type(input, '첫 질문입니다{enter}');

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    const toggleButton = screen.getByRole('button', { name: '하이라이트 모드' });
    await user.click(toggleButton);

    const { default: MockHighlighter } = await import('web-highlighter');
    const instance = MockHighlighter.__getLastInstance();

    instance.emit(MockHighlighter.event.CREATE, {
      sources: [
        { id: 'gamma', text: 'Gamma' },
        { id: 'delta', text: 'Delta' },
      ],
    });

    await user.keyboard('{Enter}');

    expect(onPlaceholderCreate).toHaveBeenCalledWith(node.id, ['Gamma', 'Delta']);

    jest.useRealTimers();
  });
});
