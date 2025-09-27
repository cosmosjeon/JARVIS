import React, { useMemo } from "react";
import { Bot, MessageSquare, User } from "lucide-react";

import { Badge } from "components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { ScrollArea } from "components/ui/scroll-area";
import { buildFallbackConversation, sanitizeConversationMessages } from "services/supabaseTrees";

const ROLE_LABEL = {
  assistant: "JARVIS",
  user: "사용자",
};

const ROLE_ICON = {
  assistant: Bot,
  user: User,
};

const formatTimestamp = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  try {
    return new Date(value).toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return null;
  }
};

const LibraryConversationPanel = ({ node }) => {
  const normalizedConversation = useMemo(() => {
    if (!node) {
      return [];
    }

    const explicitConversation = sanitizeConversationMessages(node.conversation);
    if (explicitConversation.length > 0) {
      return explicitConversation;
    }

    const fallback = buildFallbackConversation(
      node.question || node.questionData?.question,
      node.answer || node.questionData?.answer || node.fullText,
    );

    return sanitizeConversationMessages(fallback);
  }, [node]);

  if (!node) {
    return (
      <Card className="h-full bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">대화 뷰</CardTitle>
        </CardHeader>
        <CardContent className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
          노드를 선택하면 위젯에서 진행한 대화가 여기에 표시됩니다.
        </CardContent>
      </Card>
    );
  }

  const rootKeyword = node.keyword || node.id;

  return (
    <Card className="flex h-full flex-col bg-card/80">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base">{rootKeyword}</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{node.status === "placeholder" ? "임시" : "확정"}</Badge>
          {node.createdAt ? (
            <span>생성: {formatTimestamp(node.createdAt)}</span>
          ) : null}
          {node.updatedAt ? (
            <span>업데이트: {formatTimestamp(node.updatedAt)}</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          {normalizedConversation.length ? (
            <div className="space-y-3">
              {normalizedConversation.map((message, index) => {
                const role = message.role === "assistant" ? "assistant" : "user";
                const Icon = ROLE_ICON[role] || MessageSquare;
                const timestampLabel = formatTimestamp(message.timestamp);
                return (
                  <div key={`conversation-${node.id}-${index}`} className="rounded-lg border border-border/40 bg-background/60 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      <span>{ROLE_LABEL[role] || "대화"}</span>
                      {message.status ? (
                        <Badge variant="outline" className="ml-1 uppercase">
                          {message.status}
                        </Badge>
                      ) : null}
                      {timestampLabel ? <span className="ml-auto">{timestampLabel}</span> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.text}
                    </p>
                    {message.metadata && typeof message.metadata === "object" ? (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">추가 정보</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-muted/30 p-2">
                          {JSON.stringify(message.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-10 w-10" />
              <p>저장된 대화가 없습니다.</p>
              <p className="text-xs text-muted-foreground/80">
                위젯에서 질문을 하면 대화가 자동으로 저장되고 이곳에 표시됩니다.
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LibraryConversationPanel;
