import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// anchorPosition: { x, y } 가 전달되면 해당 좌표 기준으로 고정 위치에 렌더링
// onSubmit 이 전달되면 첫 전송 시 상위에서 처리하도록 콜백 호출
const ChatWindow = ({ isOpen, onClose, nodeData, anchorPosition, onSubmit }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 더미 메시지 생성 제거: 초기 메시지는 빈 배열 유지

  useEffect(() => {
    if (isOpen && nodeData) {
      setMessages([]);
    }
  }, [isOpen, nodeData]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const userMessage = {
        id: messages.length + 1,
        sender: 'user',
        text: newMessage,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');

      if (typeof onSubmit === 'function') {
        onSubmit(userMessage.text);
      } else {
        // 기본 동작: 간단한 응답 시뮬레이션 유지
        setTimeout(() => {
          const assistantMessage = {
            id: messages.length + 2,
            sender: 'assistant',
            text: '답변을 준비 중입니다. 잠시만 기다려주세요.',
            timestamp: new Date().toLocaleTimeString()
          };
          setMessages(prev => [...prev, assistantMessage]);
        }, 1000);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={anchorPosition ? undefined : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xl"}
        style={anchorPosition ? { position: 'absolute', left: anchorPosition.x, top: anchorPosition.y } : undefined}
        onClick={anchorPosition ? undefined : onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="glass-shell relative flex h-[600px] w-96 flex-col rounded-2xl"
          onClick={(e) => e.stopPropagation()}
          style={anchorPosition ? { transform: 'translate(-50%, 8px)' } : undefined}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-white/10 opacity-40 mix-blend-screen" />
          {/* Header */}
          <div className="relative flex items-center justify-between rounded-t-2xl border-b border-white/15 bg-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              <div className="glass-chip flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-slate-100">
                {(nodeData?.keyword || nodeData?.id || '?').charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-slate-50">
                  {nodeData?.keyword || nodeData?.id}
                </h3>
                <p className="text-sm text-slate-300 opacity-80">온라인</p>
              </div>
            </div>
            {!anchorPosition && (
              <button
                onClick={onClose}
                className="text-slate-300 transition hover:text-slate-100"
              >
                ×
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="glass-scrollbar relative flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs rounded-2xl px-4 py-2 lg:max-w-md ${
                    message.sender === 'user'
                      ? 'glass-chip text-slate-100'
                      : message.sender === 'system'
                      ? 'glass-surface text-slate-100'
                      : 'glass-surface text-slate-100'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className={`mt-1 text-xs ${
                    message.sender === 'user' ? 'text-slate-200/80' : 'text-slate-300/70'
                  }`}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="rounded-b-2xl border-t border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="Ask anything..."
                className="glass-surface flex-1 rounded-full border border-white/20 bg-transparent px-4 py-2 text-sm text-slate-100 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="glass-chip px-6 py-2 text-slate-100 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/10"
              >
                전송
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatWindow;
