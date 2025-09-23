import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatWindow = ({ isOpen, onClose, nodeData }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Dummy messages based on node type
  const getDummyMessages = (node) => {
    const baseMessages = [
      {
        id: 1,
        sender: 'system',
        text: `${node.keyword || node.id}에 대한 정보를 제공해드릴게요.`,
        timestamp: new Date(Date.now() - 300000).toLocaleTimeString()
      },
      {
        id: 2,
        sender: 'user',
        text: '현재 업무 현황은 어떤가요?',
        timestamp: new Date(Date.now() - 240000).toLocaleTimeString()
      }
    ];

    const nodeSpecificMessages = {
      'CEO': [
        {
          id: 3,
          sender: 'assistant',
          text: '전체 회사 전략을 수립하고 이끌어가고 있습니다. 현재 Q4 목표 달성을 위해 각 부서와 협력하고 있어요.',
          timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
        }
      ],
      'CTO': [
        {
          id: 3,
          sender: 'assistant',
          text: '기술 로드맵을 검토하고 새로운 아키텍처 도입을 준비 중입니다. AI 기술 스택 업그레이드도 진행하고 있어요.',
          timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
        }
      ],
      'CFO': [
        {
          id: 3,
          sender: 'assistant',
          text: '재무 계획 수립과 예산 관리를 담당하고 있습니다. 투자 포트폴리오 최적화 작업을 진행 중이에요.',
          timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
        }
      ],
      'CMO': [
        {
          id: 3,
          sender: 'assistant',
          text: '마케팅 캠페인 기획과 브랜드 전략을 수립하고 있습니다. 신제품 런칭을 위한 준비를 하고 있어요.',
          timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
        }
      ],
      'Eng Mgr': [
        {
          id: 3,
          sender: 'assistant',
          text: '개발팀 리드와 기술 전략을 담당하고 있습니다. 현재 새로운 프로젝트 아키텍처 설계를 진행 중이에요.',
          timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
        }
      ]
    };

    const specificMessages = nodeSpecificMessages[node.keyword || node.id] || [
      {
        id: 3,
        sender: 'assistant',
        text: `${node.keyword || node.id} 역할을 맡아 업무를 진행하고 있습니다. 팀과 협력하여 목표를 달성하고 있어요.`,
        timestamp: new Date(Date.now() - 180000).toLocaleTimeString()
      }
    ];

    return [...baseMessages, ...specificMessages, {
      id: 4,
      sender: 'user',
      text: '더 자세한 정보를 알려주세요.',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString()
    }, {
      id: 5,
      sender: 'assistant',
      text: '네, 궁금한 점이 있으시면 언제든 말씀해 주세요!',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString()
    }];
  };

  useEffect(() => {
    if (isOpen && nodeData) {
      setMessages(getDummyMessages(nodeData));
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

      // Simulate assistant response
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
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="glass-shell relative flex h-[600px] w-96 flex-col rounded-2xl"
          onClick={(e) => e.stopPropagation()}
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
            <button
              onClick={onClose}
              className="text-slate-300 transition hover:text-slate-100"
            >
              ×
            </button>
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
                onKeyPress={handleKeyPress}
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
