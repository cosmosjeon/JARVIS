# 채팅·하이라이트 인터페이스 다이어그램

## 채팅 흐름 (간략 개요)
```
사용자 입력(Composer) -> sendResponse() -> QuestionServiceAdapter
                                      \-> 메시지 상태 업데이트 (messages[])
QuestionServiceAdapter -> (answerText) -> 메시지 리스트 -> UI 렌더 (MarkdownMessage)
                                             |
                                             v
                                      onConversationChange()
```

### 외부 통신 포인트
- `QuestionServiceAdapter.ask(nodeId, question)` — 현재는 로컬 클래스, Electron 위젯에서는 IPC `question:ask` 채널로 대체 예정
- `onSecondQuestion(nodeId, question)` — 트리 컨텍스트에서만 사용, 위젯에서는 옵셔널 no-op
- `onConversationChange(messages)` — 웹에서는 부모 컴포넌트, 위젯에서는 저장소/IPC 동기화

## 하이라이트 흐름
```
Toggle 버튼 -> useHighlightManager.enable()
            -> web-highlighter 인스턴스 -> DOM selection -> event.CREATE({ sources })
                                                                  |
                                                                  v
                                                 HighlightBridge.mapTexts()
                                                                  |
                                                                  v
                                     onPlaceholderCreate(nodeId, highlightTexts)
```

### 외부 통신 포인트
- `useHighlightManager` 내부에서 `web-highlighter` 또는 환경별 구현 사용
- `onPlaceholderCreate(nodeId, texts[])` — 트리에서는 자식 노드 생성, Electron 위젯에서는 클립보드/로컬 저장소 업데이트
- `placeholderNotice` — UI 피드백 전용, 외부와 직접 통신 없음

## 상태 요약
- 내부 상태: `messages[]`, `composerValue`, `isHighlightMode`, `placeholderNotice`
- 주입 가능한 서비스: `QuestionService`, `HighlightManager`, `NodeSummaryService`
- 이벤트 콜백: `onSizeChange`, `onSecondQuestion`, `onPlaceholderCreate`, `onConversationChange`
