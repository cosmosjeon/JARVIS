import { useCallback, useEffect, useRef, useState } from 'react';
import AgentClient from 'services/agentClient';
import { ChatStatus, createAssistantMessagePlaceholder, createUserMessage } from '../models/message';

export default function useChat({ onAssistantDone } = {}) {
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef(null);
  const timersRef = useRef([]);

  const scrollToEnd = useCallback(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => scrollToEnd(), [messages, scrollToEnd]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const send = useCallback(async (text, { channel = 'askRoot', streaming = false } = {}) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const user = createUserMessage(trimmed);
    const assistant = createAssistantMessagePlaceholder();

    setMessages((prev) => [...prev, user, assistant]);
    setIsThinking(true);

    try {
      const openaiMessages = [...messages, user].map((m) => ({ role: m.role, content: m.text })).filter((m) => m.content);
      const responder = channel === 'askChild' ? AgentClient.askChild : AgentClient.askRoot;
      const result = await responder({ messages: openaiMessages });

      const answer = result.answer || '';

      if (!streaming) {
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, text: answer, status: ChatStatus.Complete } : m)));
        setIsThinking(false);
        onAssistantDone?.(answer, result);
        return;
      }

      // 타이핑 애니메이션
      const chars = Array.from(answer);
      let i = 0;
      const step = () => {
        i += 1;
        const typed = chars.slice(0, i).join('');
        const done = i >= chars.length;
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, text: typed, status: done ? ChatStatus.Complete : ChatStatus.Typing } : m)));
        if (!done) {
          const t = setTimeout(step, 18);
          timersRef.current.push(t);
        } else {
          setIsThinking(false);
          onAssistantDone?.(typed, result);
        }
      };
      step();
    } catch (error) {
      setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, text: `오류: ${error.message}`, status: ChatStatus.Error } : m)));
      setIsThinking(false);
    }
  }, [messages, onAssistantDone]);

  return {
    messages,
    isThinking,
    endRef,
    send,
  };
}

