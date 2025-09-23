import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import HierarchicalForceTree from '../HierarchicalForceTree';

// Mock D3 to avoid DOM manipulation issues in tests
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    call: jest.fn(() => ({
      on: jest.fn()
    })),
    selectAll: jest.fn(() => ({
      on: jest.fn(),
      style: jest.fn(),
      raise: jest.fn()
    })),
    on: jest.fn()
  })),
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn(() => ({
      filter: jest.fn(() => ({
        on: jest.fn()
      }))
    }))
  })),
  forceSimulation: jest.fn(() => ({
    force: jest.fn(() => ({
      force: jest.fn(() => ({
        force: jest.fn(() => ({
          force: jest.fn(() => ({
            force: jest.fn(() => ({
              force: jest.fn(() => ({}))
            }))
          }))
        }))
      }))
    })),
    on: jest.fn(),
    stop: jest.fn(),
    alphaTarget: jest.fn(() => ({
      restart: jest.fn()
    }))
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn(() => ({
      distance: jest.fn()
    }))
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn(() => ({
      distanceMin: jest.fn(() => ({
        distanceMax: jest.fn()
      }))
    }))
  })),
  forceCenter: jest.fn(),
  forceCollide: jest.fn(() => ({
    radius: jest.fn(() => ({
      strength: jest.fn(() => ({
        iterations: jest.fn()
      }))
    }))
  })),
  forceX: jest.fn(() => ({
    strength: jest.fn()
  })),
  forceY: jest.fn(() => ({
    strength: jest.fn()
  })),
  drag: jest.fn(() => ({
    on: jest.fn()
  })),
  scaleOrdinal: jest.fn(),
  schemeCategory10: [],
  group: jest.fn(() => new Map()),
  scalePoint: jest.fn(() => ({
    domain: jest.fn(() => ({
      range: jest.fn()
    }))
  }))
}));

describe('HierarchicalForceTree', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('dynamically creates child nodes when branch requests are received', async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<HierarchicalForceTree />);

    // Find CEO node and click to expand it
    const ceoNode = screen.getByText('CEO');
    await user.click(ceoNode);

    // Wait for the panel to be visible
    const input = await screen.findByPlaceholderText('Ask anything...');

    // Send first message (should not create branch)
    await user.type(input, '첫 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // Initially should have original 6 nodes
    expect(screen.getAllByText(/CEO|CTO|CFO|CMO|Dev Team|DevOps Team/)).toHaveLength(6);

    // Send second message (should create branch/child node)
    await user.type(input, '두 번째 메시지{enter}');
    await act(async () => {
      jest.runOnlyPendingTimers();
      // Allow for requestAnimationFrame and state updates
      jest.advanceTimersByTime(100);
    });

    // Should have created a new child node dynamically
    // RED phase: This will fail until we implement dynamic node creation
    const allNodes = screen.getAllByText(/CEO|CTO|CFO|CMO|Dev Team|DevOps Team/);
    expect(allNodes.length).toBeGreaterThan(6);

    // New child node should have a generated ID and be a child of CEO
    const newChildNodes = screen.getAllByText(/CEO_child_\d+/);
    expect(newChildNodes.length).toBeGreaterThan(0);

    jest.useRealTimers();
  });

  it('automatically focuses the newly created child node', async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<HierarchicalForceTree />);

    // Click CEO to expand
    const ceoNode = screen.getByText('CEO');
    await user.click(ceoNode);

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

    // After branching, should have 2 input fields (original + new child node)
    // RED phase: This will fail until we implement auto-focus on new child
    const inputFields = screen.getAllByPlaceholderText('Ask anything...');
    expect(inputFields.length).toBe(2);

    // The new child node should be automatically expanded (focused)
    // Check that we can type in the new child's input field
    const newChildInput = inputFields[1];
    await user.type(newChildInput, 'Child node message');
    expect(newChildInput.value).toBe('Child node message');

    jest.useRealTimers();
  });
});