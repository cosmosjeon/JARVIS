import React, { useEffect, useMemo } from 'react';
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ComposerPrimitive,
  useAssistantState,
  useLocalRuntime,
} from '@assistant-ui/react';
import { treeData } from '../data/treeData';

const parentsByChild = new Map();
treeData.links.forEach(link => {
  parentsByChild.set(link.target, link.source);
});

const buildChain = (nodeId) => {
  const chain = [];
  let current = nodeId;
  const guard = new Set();

  while (current) {
    if (guard.has(current)) break;
    guard.add(current);

    const match = treeData.nodes.find(n => n.id === current);
    chain.unshift(match ? (match.keyword || match.id) : current);

    const parent = parentsByChild.get(current);
    if (!parent) break;
    current = parent;
  }

  return chain;
};

const getDirectReports = (nodeId) => {
  return treeData.links
    .filter(link => link.source === nodeId)
    .map(link => treeData.nodes.find(n => n.id === link.target))
    .filter(Boolean)
    .map(node => node.keyword || node.id);
};

const getPeers = (nodeId) => {
  const parent = parentsByChild.get(nodeId);
  if (!parent) return [];

  return treeData.links
    .filter(link => link.source === parent && link.target !== nodeId)
    .map(link => treeData.nodes.find(n => n.id === link.target))
    .filter(Boolean)
    .map(node => node.keyword || node.id);
};

const buildSummary = (node) => {
  const label = node.keyword || node.id;
  const chain = buildChain(node.id);
  const reports = getDirectReports(node.id);
  const peers = getPeers(node.id);

  const bullets = [
    chain.length > 1 ? `보고 체계: ${chain.join(' → ')}` : null,
    reports.length ? `리드 팀: ${reports.join(', ')}` : null,
    peers.length ? `협업 파트너: ${peers.join(', ')}` : null,
  ].filter(Boolean);

  return {
    label,
    intro: `${label}은(는) ${node.fullText}`,
    bullets,
    followUps: [
      `${label}의 주요 목표`,
      `${label}이 협업하는 부서`,
      `${label} 팀의 현재 과제`,
    ],
  };
};

const buildAnswerText = (summary) => {
  const bulletText = summary.bullets.map(item => `• ${item}`).join('\n');
  return `${summary.intro}\n${bulletText}`.trim();
};

const buildInitialMessages = (summary) => [
  {
    role: 'user',
    content: [{ type: 'text', text: `${summary.label} 역할에 대해 알려줘.` }],
  },
  {
    role: 'assistant',
    content: [{ type: 'text', text: buildAnswerText(summary) }],
    status: { type: 'complete', reason: 'stop' },
  },
];

const extractLatestUserQuestion = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    const textParts = Array.isArray(message.content)
      ? message.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
      : '';
    if (textParts.trim()) return textParts.trim();
  }
  return '';
};

const MessageText = () => (
  <MessagePartPrimitive.Text
    smooth
    component="p"
    className="whitespace-pre-wrap break-all leading-relaxed text-sm"
  />
);

const createMessageComponent = (color) => () => {
  const role = useAssistantState(({ message }) => message.role);
  const isAssistant = role === 'assistant';
  const bubbleStyle = isAssistant
    ? {
        backgroundColor: 'rgba(255,255,255,0.9)',
        color: '#0f172a',
        border: '1px solid rgba(255,255,255,0.6)',
      }
    : {
        backgroundColor: 'rgba(0,0,0,0.28)',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.25)',
      };

  return (
    <MessagePrimitive.Root className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className="max-w-[240px] break-all rounded-2xl px-4 py-3 text-sm shadow-sm"
        style={bubbleStyle}
      >
        <MessagePrimitive.Parts components={{ Text: MessageText }} />
      </div>
    </MessagePrimitive.Root>
  );
};

const NodeAssistantPanel = ({ node, color }) => {
  const summary = useMemo(() => buildSummary(node), [node]);

  const adapter = useMemo(() => ({
    async run({ messages }) {
      const question = extractLatestUserQuestion(messages);
      const answer = question
        ? `${summary.label} 관련 질문을 받았습니다.\n${buildAnswerText(summary)}`
        : buildAnswerText(summary);

      return {
        content: [{ type: 'text', text: answer }],
        status: { type: 'complete', reason: 'stop' },
      };
    },
  }), [summary]);

  const runtime = useLocalRuntime(adapter, {
    initialMessages: buildInitialMessages(summary),
  });

  useEffect(() => {
    runtime.thread.reset(buildInitialMessages(summary));
  }, [runtime, summary]);

  const MessageComponent = useMemo(() => createMessageComponent(color), [color]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        className="flex h-full w-full flex-col rounded-[28px] p-6 shadow-xl"
        style={{
          fontFamily: 'Arial, sans-serif',
          backgroundColor: color,
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.35)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div className="mb-4 flex items-center">
          <span
            className="rounded-full px-4 py-1 text-sm font-semibold"
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            {summary.label}에 대해 설명해 줘
          </span>
        </div>

        <ThreadPrimitive.Root className="flex flex-1 flex-col gap-4 min-h-0">
          <div
            className="flex flex-1 flex-col gap-3 rounded-2xl p-4 min-h-0"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.28)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.24)',
            }}
          >
            <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto overflow-x-hidden pr-1 min-h-0">
              <div className="flex flex-col gap-3">
                <ThreadPrimitive.Messages components={{ Message: MessageComponent }} />
              </div>
            </ThreadPrimitive.Viewport>

            <ComposerPrimitive.Root
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <ComposerPrimitive.Input
                placeholder="무엇이든 물어보세요"
                className="max-h-24 flex-1 resize-none border-none bg-transparent text-sm text-white placeholder:text-slate-200 focus:outline-none"
              />
              <ComposerPrimitive.Send
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.28)',
                  border: '1px solid rgba(255,255,255,0.4)',
                }}
              >
                ↗
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          </div>

          <div className="flex flex-wrap gap-2">
            {summary.followUps.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-full px-3 py-1 text-xs"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  color: '#ffffff',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
};

export default NodeAssistantPanel;
