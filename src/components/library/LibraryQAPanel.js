import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2, Bot, User, X } from 'lucide-react';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Badge } from 'components/ui/badge';
import { ScrollArea } from 'components/ui/scroll-area';
import QuestionService from 'services/QuestionService';
import { useSupabaseAuth } from 'hooks/useSupabaseAuth';
import { upsertTreeNodes } from 'services/supabaseTrees';

const TYPING_INTERVAL_MS = 18;

const MarkdownMessage = ({ text }) => {
  if (!text) return null;

  // 간단한 마크다운 파싱 (실제로는 더 정교한 파서가 필요할 수 있음)
  const blocks = text.split('\n\n').map((block, index) => ({
    id: index,
    content: block.trim()
  }));

  return (
    <div className="space-y-2">
      {blocks.map((block) => {
        if (!block.content) return null;
        return (
          <p key={block.id} className="whitespace-pre-wrap leading-relaxed">
            {block.content}
          </p>
        );
      })}
    </div>
  );
};

const LibraryQAPanel = ({
  selectedNode,
  selectedTree,
  onNodeUpdate,
  onNewNodeCreated
}) => {
  const { user } = useSupabaseAuth();
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const questionServiceRef = useRef(new QuestionService());
  const typingTimers = useRef([]);
  const messagesEndRef = useRef(null);

  // 선택된 노드가 변경될 때 메시지 초기화
  useEffect(() => {
    if (selectedNode) {
      const initialMessages = Array.isArray(selectedNode.conversation)
        ? selectedNode.conversation.map(msg => ({
          ...msg,
          content: msg.content || msg.text || ''
        }))
        : [];
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
    setComposerValue('');
    setError(null);
  }, [selectedNode]);

  // 메시지가 변경될 때 스크롤을 맨 아래로
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 타이핑 애니메이션을 위한 타이머 정리
  const clearTypingTimers = useCallback(() => {
    typingTimers.current.forEach(timer => clearTimeout(timer));
    typingTimers.current = [];
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => clearTypingTimers();
  }, [clearTypingTimers]);

  // LLM API 호출
  const invokeAgent = useCallback(async (channel, payload = {}) => {
    if (typeof window === 'undefined' || !window.jarvisAPI) {
      throw new Error('JARVIS API를 사용할 수 없습니다.');
    }

    console.log(`API 호출 시도: ${channel}`, payload);

    try {
      const result = await window.jarvisAPI[channel](payload);
      console.log(`API 호출 결과: ${channel}`, result);

      if (!result.success) {
        throw new Error(result.error?.message || 'API 호출에 실패했습니다.');
      }
      return result;
    } catch (error) {
      console.error(`API 호출 실패 (${channel}):`, error);
      throw error;
    }
  }, []);

  // 답변 생성 및 타이핑 애니메이션
  const animateAssistantResponse = useCallback((assistantId, answerText, context = {}) => {
    clearTypingTimers();

    let currentText = '';
    const words = answerText.split(' ');
    let wordIndex = 0;

    const typeNextWord = () => {
      if (wordIndex < words.length) {
        currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
        wordIndex++;

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, text: currentText }
              : msg
          )
        );

        const timer = setTimeout(typeNextWord, TYPING_INTERVAL_MS);
        typingTimers.current.push(timer);
      } else {
        // 타이핑 완료
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, status: 'complete' }
              : msg
          )
        );
        setIsProcessing(false);
      }
    };

    typeNextWord();
  }, [clearTypingTimers]);

  // 질문 전송 처리
  const handleSendMessage = useCallback(async () => {
    const question = composerValue.trim();
    if (!question || isProcessing || !selectedNode || !selectedTree || !user) {
      return;
    }

    setComposerValue('');
    setError(null);
    setIsProcessing(true);

    const timestamp = Date.now();
    const userId = `${timestamp}-user`;
    const assistantId = `${timestamp}-assistant`;

    // 사용자 메시지 추가
    const userMessage = {
      id: userId,
      role: 'user',
      content: question,
      text: question,
      timestamp
    };

    // 어시스턴트 메시지 추가 (로딩 상태)
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      text: '생각 중…',
      status: 'pending',
      timestamp: timestamp + 1
    };

    // 라이브러리에서는 모든 질문을 새 노드로 생성
    const newNodeId = `node_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    const keyword = question.split(' ').slice(0, 3).join(' ') || 'Q';

    const newNode = {
      id: newNodeId,
      keyword: keyword,
      question: question,
      answer: '', // 답변은 나중에 채움
      status: 'asking',
      createdAt: timestamp,
      updatedAt: timestamp,
      conversation: [userMessage, assistantMessage],
      parentId: selectedNode.id,
      level: (selectedNode.level || 0) + 1
    };

    // 새 노드로 즉시 전환하고 메시지도 설정
    setMessages([userMessage, assistantMessage]);

    if (onNewNodeCreated) {
      onNewNodeCreated(newNode, {
        source: newNode.parentId,
        target: newNode.id,
        value: 1
      });
    }

    try {
      // LLM API 호출 - OpenAI 형식으로 메시지 변환
      const openaiMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content || msg.text || ''
      })).filter(msg => msg.content && msg.content.trim());

      console.log('변환된 OpenAI 메시지:', openaiMessages);

      const response = await invokeAgent('askRoot', {
        messages: openaiMessages
      });

      if (!response.answer) {
        throw new Error('답변을 받지 못했습니다.');
      }

      // 답변 애니메이션 시작
      animateAssistantResponse(assistantId, response.answer);

      // 새로 생성된 노드 업데이트
      const updatedMessages = [userMessage, {
        ...assistantMessage,
        text: response.answer,
        status: 'complete'
      }];

      const updatedNode = {
        ...newNode,
        conversation: updatedMessages,
        answer: response.answer,
        status: 'answered',
        updatedAt: timestamp
      };

      // 데이터베이스에 새 노드 저장
      await upsertTreeNodes({
        treeId: selectedTree.id,
        nodes: [updatedNode],
        userId: user.id
      });

      // 로컬 상태 업데이트
      if (onNodeUpdate) {
        onNodeUpdate(updatedNode);
      }

    } catch (error) {
      console.error('질문 처리 실패:', error);
      const errorMessage = error.message || '질문 처리 중 오류가 발생했습니다.';
      setError(errorMessage);

      // 에러 메시지로 교체
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
            : msg
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [composerValue, isProcessing, selectedNode, selectedTree, user, messages, invokeAgent, animateAssistantResponse, onNodeUpdate]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // 컴포저 포커스 처리
  const handleComposerFocus = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleComposerBlur = useCallback(() => {
    setIsComposing(false);
  }, []);

  if (!selectedNode) {
    return (
      <Card className="h-full bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            질문 답변
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
          노드를 선택하면 질문 답변을 시작할 수 있습니다.
        </CardContent>
      </Card>
    );
  }

  // API 사용 가능 여부 확인
  const isApiAvailable = typeof window !== 'undefined' && window.jarvisAPI;

  return (
    <Card className="flex h-full flex-col bg-card/80 overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" />
          질문 답변
          {isProcessing && (
            <Badge variant="outline" className="text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              처리 중...
            </Badge>
          )}
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          {selectedNode.keyword || selectedNode.id}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3 min-h-0 overflow-hidden">
        {/* 메시지 영역 */}
        <ScrollArea className="flex-1 pr-2 min-h-0 max-h-full">
          <div className="space-y-3 h-full">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                질문을 입력해보세요.
              </div>
            ) : (
              messages.map((message) => {
                const isAssistant = message.role === 'assistant';
                const Icon = isAssistant ? Bot : User;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isAssistant
                        ? 'bg-muted/50 text-foreground'
                        : 'bg-primary text-primary-foreground'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3 w-3" />
                        <span className="text-xs opacity-70">
                          {isAssistant ? 'JARVIS' : '사용자'}
                        </span>
                        {message.status === 'pending' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      </div>
                      {isAssistant ? (
                        <MarkdownMessage text={message.text} />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.text}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 에러 메시지 */}
        {error && (
          <div className="text-xs text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded">
            {error}
          </div>
        )}

        {/* 질문 입력 */}
        <div className="flex-shrink-0">
          {!isApiAvailable ? (
            <div className="text-center text-sm text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded">
              JARVIS API를 사용할 수 없습니다. Electron 환경에서 실행해주세요.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
            <textarea
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleComposerFocus}
              onBlur={handleComposerBlur}
              placeholder="질문을 입력하세요... (Enter로 전송)"
              className="flex min-h-[40px] max-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              disabled={isProcessing}
              rows={2}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!composerValue.trim() || isProcessing}
              className="h-10 w-10 p-0"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LibraryQAPanel;
