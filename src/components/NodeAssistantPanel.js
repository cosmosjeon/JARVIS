import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { treeData } from '../data/treeData';
import QuestionService from '../services/QuestionService';

export const PANEL_SIZES = {
  compact: { width: 360, height: 180 },
  expanded: { width: 600, height: 640 },
};

const TYPING_INTERVAL_MS = 18;

const parentsByChild = new Map();
treeData.links.forEach((link) => {
  parentsByChild.set(link.target, link.source);
});

const buildChain = (nodeId) => {
  const chain = [];
  let current = nodeId;
  const guard = new Set();

  while (current) {
    if (guard.has(current)) break;
    guard.add(current);

    const match = treeData.nodes.find((n) => n.id === current);
    chain.unshift(match ? match.keyword || match.id : current);

    const parent = parentsByChild.get(current);
    if (!parent) break;
    current = parent;
  }

  return chain;
};

const getDirectReports = (nodeId) => {
  return treeData.links
    .filter((link) => link.source === nodeId)
    .map((link) => treeData.nodes.find((n) => n.id === link.target))
    .filter(Boolean)
    .map((node) => node.keyword || node.id);
};

const getPeers = (nodeId) => {
  const parent = parentsByChild.get(nodeId);
  if (!parent) return [];

  return treeData.links
    .filter((link) => link.source === parent && link.target !== nodeId)
    .map((link) => treeData.nodes.find((n) => n.id === link.target))
    .filter(Boolean)
    .map((node) => node.keyword || node.id);
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
  };
};

const buildAnswerText = (summary, question) => {
  const bulletText = summary.bullets.map((item) => `- ${item}`).join('\n');
  const intro = question
    ? `${summary.label} 관련 질문을 받았습니다.`
    : `${summary.label} 개요입니다.`;
  const detail = `${summary.intro}`;
  const body = [detail, bulletText].filter(Boolean).join('\n\n');
  return `${intro}\n\n${body}`.trim();
};

const parseMarkdownBlocks = (text) => {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let currentList = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      currentList = null;
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!currentList) {
        currentList = { type: 'list', items: [] };
        blocks.push(currentList);
      }
      currentList.items.push(trimmed.replace(/^[-*]\s+/, '').trim());
      return;
    }

    currentList = null;
    blocks.push({ type: 'paragraph', content: trimmed });
  });

  return blocks;
};

const MarkdownMessage = ({ text }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);

  if (!blocks.length) {
    return null;
  }

  return (
    <div className="markdown-body">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'list') {
          return (
            <ul key={`md-list-${blockIndex}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`md-list-item-${blockIndex}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`md-paragraph-${blockIndex}`}>
            {block.content}
          </p>
        );
      })}
    </div>
  );
};

const NodeAssistantPanel = ({ node, color, onSizeChange, onSecondQuestion }) => {
  const summary = useMemo(() => {
    // 새로 생성된 노드인 경우 (questionData가 있는 경우) 특별 처리
    if (node.questionData) {
      return {
        label: node.keyword || node.id,
        intro: node.fullText || `${node.keyword || node.id}에 대한 질문과 답변입니다.`,
        bullets: [
          `질문: ${node.questionData.question}`,
          `답변: ${node.questionData.answer}`,
          `부모 노드: ${node.questionData.parentNodeId}`
        ]
      };
    }
    return buildSummary(node);
  }, [node]);
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const typingTimers = useRef([]);
  const questionService = useRef(new QuestionService());

  const clearTypingTimers = useCallback(() => {
    typingTimers.current.forEach(clearInterval);
    typingTimers.current = [];
  }, []);

  useEffect(() => () => clearTypingTimers(), [clearTypingTimers]);

  useEffect(() => {
    clearTypingTimers();
    setMessages([]);
    setComposerValue('');
  }, [clearTypingTimers, summary]);

  const assistantMessageCount = useMemo(
    () => messages.filter((message) => message.role === 'assistant').length,
    [messages],
  );

  useEffect(() => {
    if (!onSizeChange) return;
    const nextSize = assistantMessageCount > 0 ? PANEL_SIZES.expanded : PANEL_SIZES.compact;
    onSizeChange(nextSize);
  }, [assistantMessageCount, onSizeChange]);

  const sendResponse = useCallback(
    (question) => {
      clearTypingTimers();

      // 질문 수 증가 및 2번째 질문인지 확인
      const isSecondQuestion = questionService.current.incrementQuestionCount(node.id);

      // 2번째 질문이면 즉시 새 노드 생성 콜백 호출
      if (isSecondQuestion && onSecondQuestion) {
        onSecondQuestion(node.id, question);
      }

      const responseText = buildAnswerText(summary, question);
      const timestamp = Date.now();
      const userId = `${timestamp}-user`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', text: question },
      ]);

      const characters = Array.from(responseText);
      const assistantId = `${timestamp}-assistant`;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', text: '', status: 'typing' },
      ]);

      if (!characters.length) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, status: 'complete' } : message,
          ),
        );
        return;
      }

      let index = 0;
      const intervalId = setInterval(() => {
        index += 1;
        const typedText = characters.slice(0, index).join('');
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== assistantId) return message;
            const isDone = index >= characters.length;
            return {
              ...message,
              text: typedText,
              status: isDone ? 'complete' : 'typing',
            };
          }),
        );

        if (index >= characters.length) {
          clearInterval(intervalId);
          typingTimers.current = typingTimers.current.filter((timer) => timer !== intervalId);
        }
      }, TYPING_INTERVAL_MS);

      typingTimers.current.push(intervalId);
    },
    [clearTypingTimers, summary, node.id, onSecondQuestion],
  );

  const handleSend = useCallback(() => {
    const trimmed = composerValue.trim();
    if (!trimmed) return;

    sendResponse(trimmed);
    setComposerValue('');
  }, [composerValue, sendResponse]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend, isComposing],
  );

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  return (
    <div
      className="glass-shell relative flex h-full w-full flex-col rounded-[28px] p-6"
      style={{
        fontFamily: 'Arial, sans-serif',
        borderColor: 'rgba(255,255,255,0.25)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-white/10 opacity-40 mix-blend-screen" />
      <div className="relative flex flex-1 flex-col gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 min-h-0 backdrop-blur-md">
        <div className="glass-scrollbar flex-1 overflow-y-auto overflow-x-hidden pr-1 min-h-0">
          <div className="flex h-full flex-col gap-3">
            {messages.map((message) => {
              const isAssistant = message.role === 'assistant';

              return (
                <div
                  key={message.id}
                  className={`flex ${isAssistant ? 'justify-center' : 'justify-end'}`}
                  data-testid={isAssistant ? 'assistant-message' : 'user-message'}
                  data-status={message.status || 'complete'}
                >
                  <div
                    className={
                      isAssistant
                        ? 'glass-surface w-full max-w-[520px] break-words rounded-3xl border border-white/10 px-6 py-4 text-sm leading-relaxed text-slate-50 shadow-2xl'
                        : 'max-w-[240px] break-all rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur-sm'
                    }
                  >
                    {isAssistant ? (
                      <MarkdownMessage text={message.text} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form
          className="glass-surface flex items-end gap-3 rounded-xl border border-white/15 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <textarea
            value={composerValue}
            onChange={(event) => setComposerValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask anything..."
            className="glass-text-primary max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm placeholder:text-slate-200 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!composerValue.trim()}
            className="glass-chip flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition-opacity disabled:opacity-40"
            aria-label="메시지 전송"
          >
            ↗
          </button>
        </form>
      </div>
    </div>
  );
};

export default NodeAssistantPanel;
