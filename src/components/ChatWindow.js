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
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="bg-white rounded-2xl shadow-2xl w-96 h-[600px] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gray-100 rounded-t-2xl p-4 border-b flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {(nodeData?.keyword || nodeData?.id || '?').charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  {nodeData?.keyword || nodeData?.id}
                </h3>
                <p className="text-sm text-gray-500">온라인</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.sender === 'system'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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