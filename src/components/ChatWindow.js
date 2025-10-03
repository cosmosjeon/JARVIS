import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowUpCircle,
  BookOpen,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import MarkdownMessage from './common/MarkdownMessage';
import useChat from 'features/chat/hooks/useChat';
import ChatMessageList from 'features/chat/components/ChatMessageList';
import ChatComposer from 'features/chat/components/ChatComposer';
import { Dialog, DialogContent } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';
import { cn } from 'lib/utils';

// anchorPosition: { x, y }가 전달되면 해당 좌표 기준으로 고정 렌더링
// onSubmit 이 전달되면 첫 전송 시 상위에서 처리하도록 콜백 호출
const ChatWindow = ({ isOpen, onClose, nodeData, anchorPosition, onSubmit }) => {
  const { messages, isThinking, endRef, send } = useChat();
  const [isComposing, setIsComposing] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const composerRef = useRef(null);
  const pendingReplyRef = useRef();
  const copyTimeoutRef = useRef();

  const title = useMemo(() => nodeData?.keyword || nodeData?.id || 'Assistant', [nodeData]);
  const avatarInitial = title.charAt(0).toUpperCase();

  const quickPrompts = useMemo(
    () => [
      `${title} 노드와 관련된 핵심 내용을 요약해줘`,
      '현재 선택한 노드와 직접 연결된 인사이트를 정리해줘',
      '다음 액션 아이템을 3가지로 추천해줘',
      '추가로 조사해야 할 자료를 리스트업해줘',
    ],
    [title]
  );

  const recentConversations = useMemo(
    () => [
      {
        id: 'active',
        title,
        description: '현재 노드를 중심으로 대화 중',
        icon: Sparkles,
        active: true,
      },
      {
        id: 'analysis',
        title: '연관 노드 분석',
        description: '관계 그래프 기반 요약',
        icon: BookOpen,
      },
      {
        id: 'history',
        title: '최근 기록',
        description: '24시간 대화 히스토리',
        icon: MessageSquare,
      },
    ],
    [title]
  );

  useEffect(() => {
    if (isOpen && nodeData) {
      setMessages([]);
      setNewMessage('');
      setIsThinking(false);
    }
  }, [isOpen, nodeData]);

  useEffect(() => () => window.clearTimeout(pendingReplyRef.current), []);
  useEffect(() => () => window.clearTimeout(copyTimeoutRef.current), []);

  // 스크롤은 useChat 내부에서 처리됨

  useEffect(() => {
    if (isOpen && composerRef.current) {
      composerRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = (overrideText) => {
    const value = (overrideText || '').trim();
    if (!value) return;
    if (typeof onSubmit === 'function') {
      onSubmit(value);
      return;
    }
    send(value, { channel: 'askRoot', streaming: true });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handlePromptInsert = (prompt, submit = false) => {
    setNewMessage(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
    if (submit) {
      handleSendMessage(prompt);
    }
  };

  const handleCopyMessage = useCallback((message) => {
    if (!message?.text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text).catch(() => undefined);
    }
    setCopiedMessageId(message.id);
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopiedMessageId(null), 1800);
  }, []);

  const showCloseButton = !anchorPosition;

  const handleRetry = useCallback((message) => {
    const content = message?.text || '';
    if (!content) return;
    send(content, { channel: 'askRoot', streaming: true });
  }, [send]);

  const handleCopy = useCallback((message) => {
    if (!message?.text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text).catch(() => undefined);
    }
  }, []);

  const messageList = (
    <ChatMessageList title={title} messages={messages} endRef={endRef} onRetry={handleRetry} onCopy={handleCopy} />
  );

  const composer = (
    <form
      className="flex flex-col gap-3 border-t border-border/80 bg-background/10 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        handleSendMessage();
      }}
    >
      <Textarea
        ref={composerRef}
        value={newMessage}
        onChange={(event) => setNewMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder="아이디어, 질문, 다음 액션을 입력하세요..."
        className="min-h-[108px] resize-none rounded-2xl border border-border/80 bg-card/80 px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 rounded-full border border-border/60 bg-background/20 px-3 text-xs uppercase tracking-wide"
            onClick={() => setIsCommandOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            프롬프트 라이브러리
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 rounded-full border border-border/60 bg-background/20 px-3 text-xs uppercase tracking-wide"
            onClick={() => handlePromptInsert(quickPrompts[0] || '', true)}
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            빠른 실행
          </Button>
        </div>
        <Button type="submit" disabled={!newMessage.trim() && !isThinking} className="gap-2">
          <Send className="h-4 w-4" />
          전송
        </Button>
      </div>
    </form>
  );

  const chatPanel = (
    <TooltipProvider delayDuration={180}>
      <div className="grid h-[620px] w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl md:grid-cols-[300px_1fr]">
        <aside className="flex h-full flex-col border-b border-border/80 bg-card md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">모델</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                <span>Cosmos Analyst</span>
                <Badge variant="secondary" className="bg-muted/50 text-[11px] uppercase tracking-wide">
                  GPT-4o-mini
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-border/60 bg-background/10">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">모델 옵션 열기</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>선호 모델</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>GPT-4o-mini</DropdownMenuItem>
                <DropdownMenuItem>GPT-4o</DropdownMenuItem>
                <DropdownMenuItem>Claude 3.5 Sonnet</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>설정 열기</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator className="bg-border/80" />

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-3 px-4 py-5">
              {recentConversations.map(({ id, title: itemTitle, description, icon: Icon, active }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'border-primary/60 bg-primary/20'
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/20 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-card-foreground">{itemTitle}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>

          <Separator className="bg-border/80" />

          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground/70">
              <span>Quick prompts</span>
              <Badge variant="outline" className="border-border text-[10px] uppercase tracking-wide">
                {quickPrompts.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((item, index) => (
                <Button
                  key={item}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full border border-border/70 bg-secondary/80 px-3 text-xs tracking-wide text-secondary-foreground hover:bg-primary/40 hover:text-primary-foreground"
                  onClick={() => handlePromptInsert(item, index === 0)}
                >
                  {index === 0 ? <Sparkles className="mr-1.5 h-3 w-3" /> : <Plus className="mr-1.5 h-3 w-3" />}
                  {item.replace(title, '이 노드')}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex h-full flex-col bg-card">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-6 py-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold leading-tight text-card-foreground">{title}</h2>
                <Badge variant="secondary" className="bg-muted/50 text-[11px] uppercase tracking-wide">
                  Online
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {nodeData?.description || '노드 컨텍스트를 기반으로 인사이트를 생성합니다.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/60 bg-background/10">
                    <Sparkles className="h-4 w-4" />
                    <span className="sr-only">아이디어 추천</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>추천 프롬프트 보기</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/60 bg-background/10">
                    <BookOpen className="h-4 w-4" />
                    <span className="sr-only">지식 베이스</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>참조 노트 열기</TooltipContent>
              </Tooltip>
              {showCloseButton && (
                <Button
                  type="button"
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full border border-border/60 bg-background/10"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">창 닫기</span>
                </Button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">{messageList}</ScrollArea>
          </div>

          <ChatComposer onSend={(text) => handleSendMessage(text)} />
        </section>
      </div>

      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="프롬프트나 명령을 검색하세요" />
        <CommandList>
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          <CommandGroup heading="추천 프롬프트">
            {quickPrompts.map((item) => (
              <CommandItem
                key={item}
                value={item}
                onSelect={() => {
                  handlePromptInsert(item, true);
                  setIsCommandOpen(false);
                }}
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                {item}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </TooltipProvider>
  );

  if (anchorPosition) {
    return (
      <div
        className="absolute z-50 w-full max-w-4xl"
        style={{ left: anchorPosition.x, top: anchorPosition.y, transform: 'translate(-50%, 12px)' }}
      >
        {chatPanel}
      </div>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none [&>button]:hidden">
        {chatPanel}
      </DialogContent>
    </Dialog>
  );
};

export default ChatWindow;
