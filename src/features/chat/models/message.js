// 공통 메시지 모델 유틸

export const ChatRole = Object.freeze({
  User: 'user',
  Assistant: 'assistant',
  System: 'system',
});

export const ChatStatus = Object.freeze({
  Pending: 'pending',
  Typing: 'typing',
  Complete: 'complete',
  Error: 'error',
});

export function createUserMessage(text) {
  return {
    id: Date.now() + '-user',
    role: ChatRole.User,
    text,
    timestamp: Date.now(),
  };
}

export function createAssistantMessagePlaceholder() {
  return {
    id: Date.now() + '-assistant',
    role: ChatRole.Assistant,
    text: '',
    status: ChatStatus.Pending,
    timestamp: Date.now() + 1,
  };
}

