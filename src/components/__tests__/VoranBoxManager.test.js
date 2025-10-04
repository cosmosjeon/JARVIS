import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoranBoxManager from '../library/VoranBoxManager';

// Mock the UI components
jest.mock('shared/ui/button', () => ({
    Button: ({ children, onClick, ...props }) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
}));

jest.mock('shared/ui/input', () => ({
    Input: ({ onChange, onKeyDown, ...props }) => (
        <input onChange={onChange} onKeyDown={onKeyDown} {...props} />
    ),
}));

jest.mock('shared/utils', () => ({
    cn: (...classes) => classes.filter(Boolean).join(' '),
}));

describe('VoranBoxManager', () => {
    const mockProps = {
        isVisible: true,
        onClose: jest.fn(),
        trees: [
            {
                id: 'tree1',
                title: 'Test Tree 1',
                folderId: null,
                updatedAt: Date.now(),
                treeData: { nodes: [] }
            },
            {
                id: 'tree2',
                title: 'Test Tree 2',
                folderId: 'folder1',
                updatedAt: Date.now(),
                treeData: { nodes: [] }
            }
        ],
        folders: [
            {
                id: 'folder1',
                name: 'Test Folder 1'
            }
        ],
        onTreeSelect: jest.fn(),
        onTreeMoveToFolder: jest.fn(),
        onTreeOpen: jest.fn(),
        onFolderCreate: jest.fn(),
        onFolderSelect: jest.fn(),
        selectedTreeId: null,
        selectedFolderId: null,
        loading: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockProps.onTreeMoveToFolder = jest.fn().mockResolvedValue({
            moved: [{ id: 'tree1', targetFolderId: 'folder1', title: 'Test Tree 1' }],
            failures: [],
            renamed: [],
            skipped: [],
        });
    });

    test('renders VORAN BOX and folder sections', () => {
        render(<VoranBoxManager {...mockProps} />);

        expect(screen.getByText('VORAN BOX')).toBeInTheDocument();
        expect(screen.getByText('폴더 관리')).toBeInTheDocument();
        expect(screen.getByText('Test Tree 1')).toBeInTheDocument();
        expect(screen.getByText('Test Folder 1')).toBeInTheDocument();
    });

    test('handles drag and drop for trees', async () => {
        render(<VoranBoxManager {...mockProps} />);

        const treeElement = screen.getByText('Test Tree 1');

        // Simulate drag start
        const dragDataTransfer = {
            setData: jest.fn(),
            effectAllowed: 'move',
            setDragImage: jest.fn()
        };

        fireEvent.dragStart(treeElement, {
            dataTransfer: dragDataTransfer
        });

        // Simulate drag over folder
        const folderElement = screen.getByText('Test Folder 1');
        fireEvent.dragOver(folderElement, {
            preventDefault: jest.fn(),
            dataTransfer: { dropEffect: 'move' }
        });

        // Simulate drop
        const dropDataTransfer = {
            getData: jest.fn((type) => {
                if (type === 'application/json') {
                    return JSON.stringify({ treeIds: ['tree1'] });
                }
                if (type === 'text/plain') {
                    return 'tree1';
                }
                return '';
            })
        };

        fireEvent.drop(folderElement, {
            preventDefault: jest.fn(),
            dataTransfer: dropDataTransfer
        });

        await waitFor(() => {
            expect(mockProps.onTreeMoveToFolder).toHaveBeenCalledWith({
                treeIds: ['tree1'],
                targetFolderId: 'folder1'
            });
        });
    });

    test('supports dragging multiple selected trees at once', async () => {
        const multiProps = {
            ...mockProps,
            trees: [
                {
                    id: 'tree1',
                    title: 'Test Tree 1',
                    folderId: null,
                    updatedAt: Date.now(),
                    treeData: { nodes: [] }
                },
                {
                    id: 'tree1',
                    title: 'Another Tree',
                    folderId: null,
                    updatedAt: Date.now(),
                    treeData: { nodes: [] }
                },
                {
                    id: 'tree2',
                    title: 'Test Tree 2',
                    folderId: 'folder1',
                    updatedAt: Date.now(),
                    treeData: { nodes: [] }
                }
            ],
            onTreeMoveToFolder: jest.fn().mockResolvedValue({
                moved: [
                    { id: 'tree1', targetFolderId: 'folder1', title: 'Test Tree 1' },
                    { id: 'tree1', targetFolderId: 'folder1', title: 'Another Tree' }
                ],
                failures: [],
                renamed: [],
                skipped: [],
            })
        };

        render(<VoranBoxManager {...multiProps} />);

        const firstTree = screen.getByText('Test Tree 1');
        const secondTree = screen.getByText('Another Tree');

        expect(firstTree).toBeInTheDocument();
        expect(secondTree).toBeInTheDocument();

        fireEvent.click(secondTree, { metaKey: true });

        const dragDataTransfer = {
            setData: jest.fn(),
            effectAllowed: 'move',
            setDragImage: jest.fn()
        };

        fireEvent.dragStart(secondTree, { dataTransfer: dragDataTransfer });

        const folderElement = screen.getByText('Test Folder 1');

        fireEvent.dragOver(folderElement, {
            preventDefault: jest.fn(),
            dataTransfer: { dropEffect: 'move' }
        });

        const dropDataTransfer = {
            getData: jest.fn((type) => {
                if (type === 'application/json') {
                    return JSON.stringify({ treeIds: ['tree1', 'tree1'] });
                }
                if (type === 'text/plain') {
                    return 'tree1,tree1';
                }
                return '';
            })
        };

        fireEvent.drop(folderElement, {
            preventDefault: jest.fn(),
            dataTransfer: dropDataTransfer
        });

        await waitFor(() => {
            expect(multiProps.onTreeMoveToFolder).toHaveBeenCalledWith({
                treeIds: ['tree1', 'tree1'],
                targetFolderId: 'folder1'
            });
        });
    });

    test('handles escape key to cancel folder creation', () => {
        render(<VoranBoxManager {...mockProps} />);

        // Click create folder button
        fireEvent.click(screen.getByRole('button', { name: /folderplus/i }));

        // Press Escape to cancel
        fireEvent.keyDown(document, { key: 'Escape' });

        // Folder creation form should be hidden
        expect(screen.queryByPlaceholderText('폴더 이름')).not.toBeInTheDocument();
    });
});
