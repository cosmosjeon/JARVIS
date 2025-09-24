import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import * as d3 from 'd3';
import HierarchicalForceTree from '../HierarchicalForceTree';
import TreeAnimationService from '../../services/TreeAnimationService';

// D3 중 selection/zoom 등 DOM 의존 함수만 간단히 모킹한다.
jest.mock('d3', () => {
  const zoomInstance = {
    scaleExtent: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  };

  const forceSimulationInstance = {
    force: jest.fn().mockReturnThis(),
    on: jest.fn(),
    stop: jest.fn(),
    alphaTarget: jest.fn(() => ({ restart: jest.fn() })),
  };

  return {
    select: jest.fn(() => ({
      call: jest.fn(() => ({ on: jest.fn() })),
      selectAll: jest.fn(() => ({
        on: jest.fn(),
        style: jest.fn(),
        raise: jest.fn(),
      })),
      on: jest.fn(),
    })),
    tree: jest.fn(() => {
      const layout = jest.fn();
      layout.size = jest.fn(() => layout);
      layout.separation = jest.fn(() => layout);
      return layout;
    }),
    hierarchy: jest.fn((root) => ({
      data: root,
      children: root.children || [],
      descendants: () =>
        (root.children || []).length
          ? [
              { data: root, depth: 0, height: 1, x: 0, y: 0 },
              ...root.children.map((child, index) => ({
                data: child,
                depth: 1,
                height: 0,
                x: index * 20,
                y: (index + 1) * 60,
              })),
            ]
          : [{ data: root, depth: 0, height: 0, x: 0, y: 0 }],
      links: () =>
        (root.children || []).map((child) => ({
          source: { data: root },
          target: { data: child },
        })),
    })),
    zoom: jest.fn(() => zoomInstance),
    forceSimulation: jest.fn(() => forceSimulationInstance),
    forceLink: jest.fn(() => ({
      id: jest.fn(() => ({ distance: jest.fn() })),
    })),
    forceManyBody: jest.fn(() => ({
      strength: jest.fn(() => ({
        distanceMin: jest.fn(() => ({ distanceMax: jest.fn() })),
      })),
    })),
    forceCenter: jest.fn(),
    forceCollide: jest.fn(() => ({
      radius: jest.fn(() => ({
        strength: jest.fn(() => ({ iterations: jest.fn() })),
      })),
    })),
    forceX: jest.fn(() => ({ strength: jest.fn() })),
    forceY: jest.fn(() => ({ strength: jest.fn() })),
    drag: jest.fn(() => ({ on: jest.fn() })),
    scaleOrdinal: jest.fn(),
    schemeCategory10: [],
    group: jest.fn(() => new Map()),
    scalePoint: jest.fn(() => ({
      domain: jest.fn(() => ({ range: jest.fn() })),
    })),
  };
});

describe('HierarchicalForceTree', () => {
  beforeEach(() => {
    const selectionWithMethods = {
      on: jest.fn().mockReturnThis(),
      style: jest.fn().mockReturnThis(),
      raise: jest.fn().mockReturnThis(),
      call: jest.fn().mockReturnThis(),
    };

    const selectMock = {
      call: jest.fn(() => ({ on: jest.fn() })),
      selectAll: jest.fn(() => selectionWithMethods),
      on: jest.fn(),
    };

    jest.spyOn(d3, 'select').mockReturnValue(selectMock);

    const zoomInstance = {
      scaleExtent: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
    };
    jest.spyOn(d3, 'zoom').mockReturnValue(zoomInstance);

    const treeLayoutMock = jest.fn();
    treeLayoutMock.size = jest.fn().mockReturnValue(treeLayoutMock);
    treeLayoutMock.separation = jest.fn().mockReturnValue(treeLayoutMock);
    jest.spyOn(d3, 'tree').mockReturnValue(treeLayoutMock);

    jest.spyOn(d3, 'hierarchy').mockImplementation((root) => {
      const children = root.children || [];
      return {
        data: root,
        children,
        descendants: () => [
          { data: root, depth: 0, height: children.length ? 1 : 0, x: 0, y: 0 },
          ...children.map((child, index) => ({
            data: child,
            depth: 1,
            height: 0,
            x: (index + 1) * 80,
            y: (index + 1) * 120,
          })),
        ],
        links: () =>
          children.map((child) => ({
            source: { data: root },
            target: { data: child },
          })),
      };
    });

    jest.spyOn(d3, 'scaleOrdinal').mockReturnValue(() => '#1f2937');
    jest.spyOn(d3, 'drag').mockReturnValue({ on: jest.fn().mockReturnThis() });

    jest
      .spyOn(TreeAnimationService.prototype, 'calculateTreeLayoutWithAnimation')
      .mockImplementation((_currentNodes, nodes, links, _dimensions, onUpdate) => {
        const layoutNodes = nodes.map((node, index) => ({
          ...node,
          x: index * 20,
          y: index * 30,
        }));
        onUpdate(layoutNodes, links);
        return { stop: jest.fn() };
      });

    jest.spyOn(TreeAnimationService.prototype, 'cleanup').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('dynamically creates child nodes when branch requests are received', async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<HierarchicalForceTree />);

    // Find CEO node and click to expand it
    const ceoClickable = document.querySelector('[data-node-id="CEO"] g[style*="cursor: pointer"]');
    expect(ceoClickable).not.toBeNull();
    fireEvent.click(ceoClickable);

    // Wait for the panel to be visible
    const input = await screen.findByPlaceholderText('Ask anything...');

    // Send first message (should not create branch)
    await user.type(input, '첫 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // 처음에는 기획된 4개의 기본 노드만 존재한다.
    await screen.findByText('Nodes: 4');

    // Send second message (should create branch/child node)
    await user.type(input, '두 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
      // Allow for requestAnimationFrame and state updates
      jest.advanceTimersByTime(100);
    });

    // 새 자식 노드가 추가되어 총 노드 수와 링크 수가 증가했는지 확인한다.
    await screen.findByText('Nodes: 5');
    expect(screen.getByText('Links: 4')).toBeInTheDocument();
    const createdNodeElement = document.querySelector('[data-node-id^="node_"]');
    expect(createdNodeElement).not.toBeNull();

    jest.useRealTimers();
  });

  it('automatically focuses the newly created child node', async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<HierarchicalForceTree />);

    // Click CEO to expand
    const ceoNode = screen.getByText('CEO');
    const ceoClickable = ceoNode.parentElement;
    expect(ceoClickable).not.toBeNull();
    fireEvent.click(ceoClickable);

    const input = await screen.findByPlaceholderText('Ask anything...');

    // Send messages to trigger branching
    await user.type(input, '첫 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // Should have only 1 input field (original expanded node)
    expect(screen.getAllByPlaceholderText('Ask anything...')).toHaveLength(1);

    await user.type(input, '두 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
      jest.advanceTimersByTime(100);
    });

    // After branching, 디버그 정보에서 선택된 노드가 새 자식으로 이동했는지 확인한다.
    await screen.findByText('Nodes: 5');
    const selectedNodeDebug = await screen.findByText(/Selected Node: node_/);
    expect(selectedNodeDebug).toBeInTheDocument();

    // 새로 생성된 노드 그룹이 존재하고 입력 필드가 유지되는지 확인한다.
    const expandedNodeElement = document.querySelector('[data-node-id^="node_"]');
    expect(expandedNodeElement).not.toBeNull();
    const inputFields = screen.getAllByPlaceholderText('Ask anything...');
    expect(inputFields).toHaveLength(1);

    jest.useRealTimers();
  });

  it('creates a new child again when returning to a parent after branching', async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<HierarchicalForceTree />);

    const ceoNode = screen.getByText('CEO');
    const ceoClickable = ceoNode.parentElement;
    expect(ceoClickable).not.toBeNull();
    fireEvent.click(ceoClickable);

    const input = await screen.findByPlaceholderText('Ask anything...');

    await user.type(input, '첫 번째 질문{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await user.type(input, '두 번째 질문{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
      jest.advanceTimersByTime(100);
    });

    await screen.findByText('Nodes: 5');

    const ceoClickableAgain = document.querySelector('[data-node-id="CEO"] g[style*="cursor: pointer"]');
    expect(ceoClickableAgain).not.toBeNull();
    fireEvent.click(ceoClickableAgain);

    const parentInput = await screen.findByPlaceholderText('Ask anything...');

    await user.type(parentInput, '세 번째 질문{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
      jest.advanceTimersByTime(100);
    });

    await screen.findByText('Nodes: 6');
    expect(screen.getByText('Links: 5')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('creates placeholder child nodes when placeholder action is triggered', async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<HierarchicalForceTree />);

    const ceoClickable = document.querySelector('[data-node-id="CEO"] g[style*="cursor: pointer"]');
    expect(ceoClickable).not.toBeNull();
    fireEvent.click(ceoClickable);

    const input = await screen.findByPlaceholderText('Ask anything...');

    await user.type(input, '첫번째 질문{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
      jest.advanceTimersByTime(200);
    });

    const assistantMessage = await screen.findByTestId('assistant-message');
    const range = document.createRange();
    range.selectNodeContents(assistantMessage);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    input.blur();
    fireEvent.keyDown(window, { key: 'Enter', shiftKey: false });

    await act(async () => {
      jest.runOnlyPendingTimers();
      jest.advanceTimersByTime(120);
    });

    const placeholderNodes = await screen.findAllByText(/Placeholder:/);
    expect(placeholderNodes.length).toBeGreaterThan(0);

    jest.useRealTimers();
  });
});
