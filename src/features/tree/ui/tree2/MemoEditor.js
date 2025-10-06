import React from 'react';
import MemoEditorView from 'features/tree/ui/tree2/MemoEditorView';
import { useMemoEditorController } from 'features/tree/ui/tree2/hooks/useMemoEditorController';

const MemoEditor = (props) => {
  const controller = useMemoEditorController(props);
  return <MemoEditorView {...controller} />;
};

export default MemoEditor;
