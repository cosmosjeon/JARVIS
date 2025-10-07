import React, { useMemo } from 'react';
import NodeAssistantPanelView from 'features/tree/ui/components/node-assistant/NodeAssistantPanelView';
import { useNodeAssistantPanelController, PANEL_SIZES, getScaledPanelSizes } from 'features/tree/hooks/useNodeAssistantPanelController';

const buildSummary = (node, fallbackSummary) => {
  if (!node) {
    return fallbackSummary ?? { label: '', intro: '', bullets: [] };
  }

  if (node.questionData) {
    return {
      label: node.keyword || node.id,
      intro: node.fullText || `${node.keyword || node.id}에 대한 질문과 답변입니다.`,
      bullets: [
        `질문: ${node.questionData.question}`,
        `답변: ${node.questionData.answer}`,
        `부모 노드: ${node.questionData.parentNodeId}`,
      ],
    };
  }

  if (fallbackSummary) {
    return fallbackSummary;
  }

  const label = node.keyword || node.id;
  return {
    label,
    intro: node.fullText ? `${label}은(는) ${node.fullText}` : `${label} 개요입니다.`,
    bullets: [],
  };
};

const NodeAssistantPanelContainer = ({ node, nodeSummary, nodeScaleFactor, showHeaderControls = true, ...rest }) => {
  const summary = useMemo(() => buildSummary(node, nodeSummary), [node, nodeSummary]);

  const controller = useNodeAssistantPanelController({
    node,
    nodeScaleFactor,
    summary,
    ...rest,
  });

  return (
    <NodeAssistantPanelView
      {...controller}
      showHeaderControls={showHeaderControls}
    />
  );
};

export default NodeAssistantPanelContainer;
export { PANEL_SIZES, getScaledPanelSizes };
