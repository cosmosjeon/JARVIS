# Chat Attachment & File Upload Plan

## 1. 배경 및 목표
- AI 챗 인터페이스에서 이미지·파일을 첨부해 맥락을 제공하고 싶은 요구가 증가했습니다.
- 현재 `ChatComposer`는 텍스트만 전송하며, 첨부에 대한 상태·전송·표시 로직이 존재하지 않습니다.
- 동일 저장소의 노드 어시스턴트 패널은 이미지 첨부 UI와 처리 흐름을 제공하므로, 재사용 가능한 패턴을 채택해 채팅에서도 일관된 UX를 제공하는 것이 목표입니다.

## 2. 현재 구현 분석
### 2.1 Chat 영역
- `src/features/chat/components/ChatComposer.jsx`: 텍스트 입력, Enter 전송, IME composition 제어만 포함.
- `src/features/chat/hooks/useChat.js`: 메시지 배열을 관리하며 `AgentClient.askRoot/askChild` 호출. 메시지 모델(`createUserMessage`, `createAssistantMessagePlaceholder`)은 `text`와 `timestamp`만 보유.
- `src/features/chat/components/ChatMessageList.jsx`: 사용자/어시스턴트 메시지 UI, Retry/Copy 액션만 제공하며 첨부 표시 로직 없음.

### 2.2 Node Assistant 참고 구현
- `NodeAssistantPanelView`와 `useNodeAssistantPanelController`는 이미지 첨부, 미리보기, 제거, 다중 업로드를 지원.
- 첨부 객체 구조 예시는 `{ id, type, mimeType, dataUrl, name, size, createdAt }` 패턴으로 정규화되어 있음.
- `AssistantMessageList`는 메시지에 `attachments` 배열이 있을 경우 썸네일을 렌더링.
- 첨부 업로드는 프론트에서 Base64 Data URL로 변환 후 메시지 payload에 담아 `submitMessage`에 전달.

## 3. 요구사항 정리
- 채팅 입력창에서 이미지 및 일반 파일(문서, PDF 등) 첨부 지원.
- 전송 전 첨부 미리보기 및 제거 기능 제공.
- 메시지 모델과 저장 로직이 첨부 메타데이터를 처리하고, 서버/에이전트로 안전하게 전달되어야 함.
- 파일 크기 제한, 허용 타입, 업로드 실패 대응 등 UX 가이드 필요.
- 향후 텍스트+이미지 맥락을 OpenAI Vision/Assistants API로 전달할 수 있도록 확장성 확보.

## 4. 공식 문서 인사이트
- **Vision 입력**: `input_image` 타입과 `detail` 파라미터(`low`/`high`/`auto`)로 이미지 해상도와 토큰 사용량을 제어하고, Base64 혹은 URL 입력을 지원 (`https://platform.openai.com/docs/guides/vision`).
- **이미지 업로드 예시**: Base64 Data URL 또는 스트림을 사용해 GPT-4.1/5 Vision 모델에 전달 가능 (`https://platform.openai.com/docs/guides/images-vision`).
- **파일 업로드**: `POST /v1/files`에 `purpose`를 지정해 업로드 후 ID로 참조 (`https://platform.openai.com/docs/guides/pdf-files`).
- **벡터 스토어 & File Search**: 업로드한 파일을 `vector_stores`에 배치하여 Assistants에서 검색 기반 응답을 구성 (`https://platform.openai.com/docs/assistants/tools/file-search`).

## 5. 설계 방향
### 5.1 UI/UX 개선
- `ChatComposer`에 첨부 버튼(이미지·파일) 추가, Node Assistant 패턴 재사용.
- 첨부 리스트를 composer 상단 혹은 하단 영역에 썸네일/파일명 형태로 표시.
- 다중 첨부 허용, 각 항목에 제거 버튼 제공, 전체 제거 액션 지원.
- 업로드 진행 중 상태를 버튼/알림으로 피드백.

### 5.2 상태 & 데이터 모델
- 메시지 모델 확장:
  ```js
  {
    id,
    role: 'user' | 'assistant' | 'system',
    text,
    attachments: [
      {
        id,
        type: 'image' | 'file',
        mimeType,
        name,
        size,
        dataUrl?, // 이미지 미리보기용
        fileId?,  // OpenAI / 서버 업로드 ID
        createdAt
      }
    ],
    timestamp,
    status
  }
  ```
- `createUserMessage`, `createAssistantMessagePlaceholder`, `sanitizeConversationMessages` 등을 첨부 포함 형태로 업데이트.
- `useChat`의 `send` 함수는 텍스트와 첨부를 모두 payload로 전송하고, 실패 시 첨부 상태 롤백.

### 5.3 업로드 & API 워크플로우
- **클라이언트 업로드**: 소량 이미지의 경우 Base64 인라인 전달, 대용량 파일은 백엔드 프록시나 Electron bridge를 통해 `POST /v1/files` 업로드.
- **OpenAI Vision**: 이미지 첨부 시 `input_image` 파트 생성, 필요 시 `detail`을 사용자 옵션 혹은 자동 설정으로 제어.
- **File Search / Vector Store**: 문서 첨부는 `purpose='assistants'`로 업로드 후 생성된 `file_id`를 요청 메시지에 포함. 대화가 파일 검색을 활용하도록 `AgentClient`에 채널 추가 필요.
- 재사용 가능한 `AttachmentService`(업로드, 타입 검사, 크기 제한, URL 생성)를 도입해 UI 훅에서 의존하도록 설계.

### 5.4 검증 & 제약
- 허용 MIME 타입 목록과 최대 크기(예: 이미지 5MB, 문서 10MB)를 상수로 선언.
- 실패 시 사용자 경고 메시지 노출, 재시도 경로 제공.
- 데이터 저장소(Supabase 등)에 첨부 메타데이터 동기화를 고려하고, 민감정보 업로드 시 암호화/접근 제어 정책 확인.

## 6. 구현 단계
1. **메시지 모델 정비**: `chat/models/message.js`, `useChat`, `ChatMessageList`에서 첨부 필드 도입 및 역직렬화 로직 정리.
2. **Composer 확장**: 파일 입력, 미리보기, 제거, 업로드 진행상태를 지원하는 컴포넌트 추출 (`ChatAttachmentList`, `useChatAttachments`).
3. **업로드 서비스 구축**: Electron bridge 혹은 REST API로 업로드/다운로드 기능 구현하고, OpenAI Vision/File Search 요청에 맞춰 payload 생성.
4. **UI 렌더링 보강**: `ChatMessageList`에서 이미지 썸네일, 일반 파일 다운로드 링크 제공.
5. **통합 테스트**: 첨부 업로드→전송→응답 흐름, 실패 시 복구, IME 및 키보드 단축키와의 상호작용 검증.
6. **문서 & QA**: 허용 타입, 사이즈 제약, 보안 정책 문서화하고 QA 시나리오 작성.

## 7. 테스트 전략
- 단위 테스트: 첨부 유효성 검사, 메시지 모델 변환, 업로드 실패 처리.
- 통합 테스트: `useChat` 훅 모킹으로 첨부 포함 전송 경로 검증.
- 수동 QA: 다양한 파일/이미지 조합, 대용량, 네트워크 실패, IME 입력과 첨부 동시 사용.
- 회귀 검증: 기존 텍스트 전송, Retry/Copy 기능이 영향을 받지 않는지 확인.

## 8. 리스크 & 오픈 이슈
- **대용량 파일 전송**: Base64 인라인 전송은 메모리·성능을 저하시킬 수 있으므로 스트림 업로드 경로 마련 필요.
- **보안 정책**: 사용자 업로드 파일 저장소(Supabase/Local/Electron)의 접근 제어와 만료 정책 확인 필요.
- **서버 지원 여부**: `AgentClient`가 첨부를 처리할 수 있는 백엔드 경로(`askRoot`/`askChild` 확장 또는 신규 채널) 정의 필요.
- **파일 타입 식별**: 클라이언트에서 MIME 스니핑을 통한 1차 검증 후 서버 측 안전장치 필요.

## 9. 후속 작업
- 백엔드 혹은 Electron bridge 팀과 업로드 API 계약 확정.
- UX 디자인 검토(아이콘, 위치, 접근성) 및 피드백 반영.
- 구현 착수 전 PoC로 이미지 한 장 + PDF 한 개 시나리오를 end-to-end로 검증.
