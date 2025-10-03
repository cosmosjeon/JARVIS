import React, { useMemo } from 'react';
import * as d3 from 'd3';
import NodeAssistantPanel from '../../NodeAssistantPanel';
import MemoPanel from '../MemoPanel';
import MemoEditor from '../MemoEditor';
import { getNodeDatum, getNodeId } from '../utils/forceTreeUtils';

const ForceTreeAssistantOverlay = ({ controller }) => {
  const {
    selectedNodeId,
    setSelectedNodeId,
    simulatedNodes,
    getInitialConversationForNode,
    handleConversationChange,
    onSecondQuestion,
    onPlaceholderCreate,
    onRequestAnswer,
    onAnswerComplete,
    onAnswerError,
    questionServiceRef,
    onMemoUpdate,
    memoEditorState,
    handleMemoEditorClose,
    handleMemoUpdate,
    handleMemoDelete,
    data,
    hierarchicalLinks,
    dimensions,
  } = controller;

  const assistantContent = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    const selectedNode = simulatedNodes.find((candidate) => getNodeId(candidate) === selectedNodeId);
    if (!selectedNode) {
      return null;
    }

    const selectedDatum = getNodeDatum(selectedNode);
    const isMemoSelection = selectedDatum?.nodeType === 'memo';
    const panelWidth = isMemoSelection
      ? Math.min(Math.max(dimensions.width * 0.45, 360), 520)
      : dimensions.width * 0.95;
    const panelHeight = isMemoSelection
      ? Math.min(Math.max(dimensions.height * 0.45, 320), 520)
      : dimensions.height * 0.95;

    return (
      <div
        className="pointer-events-none absolute"
        style={{
          left: '50%',
          top: '52%',
          transform: 'translate(-50%, -50%)',
          width: panelWidth,
          height: panelHeight,
          zIndex: 1000,
        }}
        data-interactive-zone="true"
      >
        <div className="pointer-events-auto" style={{ width: '100%', height: '100%' }}>
          {isMemoSelection ? (
            <MemoPanel
              memo={selectedDatum}
              onClose={() => setSelectedNodeId(null)}
              onUpdate={(updates) => {
                if (!onMemoUpdate) return;
                onMemoUpdate(selectedDatum.id, updates);
              }}
            />
          ) : (
            <NodeAssistantPanel
              node={selectedDatum}
              color={d3.schemeCategory10[0]}
              onSizeChange={() => { }}
              onSecondQuestion={onSecondQuestion || (() => { })}
              onPlaceholderCreate={onPlaceholderCreate || (() => { })}
              questionService={questionServiceRef.current}
              initialConversation={getInitialConversationForNode(selectedNodeId)}
              onConversationChange={(messages) => handleConversationChange(selectedNodeId, messages)}
              onRequestAnswer={onRequestAnswer || (() => { })}
              onAnswerComplete={onAnswerComplete || (() => { })}
              onAnswerError={onAnswerError || (() => { })}
              nodeSummary={{
                label: selectedDatum.keyword || selectedDatum.id,
                intro: selectedDatum.fullText || '',
                bullets: [],
              }}
              isRootNode={false}
              bootstrapMode={false}
              onBootstrapFirstSend={() => { }}
              onCloseNode={() => setSelectedNodeId(null)}
              onPanZoomGesture={() => { }}
              nodeScaleFactor={1}
              treeNodes={data?.nodes || []}
              treeLinks={hierarchicalLinks}
              onNodeSelect={(targetNode) => {
                const targetNodeId = targetNode?.id;
                if (targetNodeId) {
                  setSelectedNodeId(targetNodeId);
                }
              }}
              disableNavigation={isMemoSelection}
            />
          )}
        </div>
      </div>
    );
  }, [
    data?.nodes,
    handleConversationChange,
    hierarchicalLinks,
    onAnswerComplete,
    onAnswerError,
    onMemoUpdate,
    onPlaceholderCreate,
    onRequestAnswer,
    onSecondQuestion,
    questionServiceRef,
    selectedNodeId,
    setSelectedNodeId,
    simulatedNodes,
    dimensions.height,
    dimensions.width,
    getInitialConversationForNode,
  ]);

  return (
    <>
      {assistantContent}
      <MemoEditor
        memo={memoEditorState.memo}
        isVisible={memoEditorState.isOpen}
        onClose={handleMemoEditorClose}
        onUpdate={handleMemoUpdate}
        onDelete={handleMemoDelete}
      />
    </>
  );
};

export default ForceTreeAssistantOverlay;
