import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('shared/utils', () => ({
  cn: (...inputs) => inputs.filter(Boolean).join(' '),
}));

const noop = () => {};

const createResizeObserverMock = () =>
  class {
    constructor() {}
    observe() {}
    disconnect() {}
  };

let VoranBoxManager;

describe('VoranBoxManager', () => {
  const createBaseProps = () => ({
    isVisible: true,
    onClose: noop,
    trees: [],
    folders: [],
    onTreeSelect: noop,
    onTreeMoveToFolder: jest.fn(),
    onTreeOpen: noop,
    onTreeRename: noop,
    onTreeDelete: noop,
    onFolderCreate: jest.fn(),
    onFolderSelect: noop,
    selectedTreeId: null,
    selectedFolderId: null,
    loading: false,
  });

  beforeAll(() => {
    global.ResizeObserver = createResizeObserverMock();
    // eslint-disable-next-line global-require
    VoranBoxManager = require('../VoranBoxManager').default;
  });

  beforeEach(() => {
    global.ResizeObserver = createResizeObserverMock();
    window.scrollTo = jest.fn();
  });

  it('should_pass_trimmed_folder_name_to_handler_when_creating_folder', () => {
    const onFolderCreate = jest.fn();

    render(<VoranBoxManager {...createBaseProps()} onFolderCreate={onFolderCreate} />);

    fireEvent.click(screen.getByRole('button', { name: '새 폴더 만들기' }));
    fireEvent.change(screen.getByPlaceholderText('폴더 이름'), { target: { value: '   새 폴더  ' } });
    fireEvent.click(screen.getByRole('button', { name: '생성' }));

    expect(onFolderCreate).toHaveBeenCalledTimes(1);
    expect(onFolderCreate).toHaveBeenCalledWith('새 폴더', null);
  });
});
