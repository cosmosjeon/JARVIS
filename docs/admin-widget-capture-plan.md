# 관리자 위젯 캡처 기능 개발 계획

## 1. 배경 및 목표
- 관리자 위젯에서 **캡처 아이콘**을 제공하여 사용자가 언제든 화면 일부를 캡처 가능하도록 한다.
- 선택 영역 캡처가 완료되면 **첫 번째 노드의 어시스턴트 채팅 패널**을 자동으로 열고, 새 메시지 작성 영역에 캡처 이미지를 첨부한다.
- 전역 단축키 없이도 관리자 위젯을 통해 빠르게 지식 수집 흐름을 시작하게 만드는 것이 핵심 목표다.

## 2. 요구사항 요약
1. 관리자 위젯 상단 바에 캡처 아이콘을 추가하고 접근성(툴팁, 포커스 스타일 등)을 유지한다.
2. 캡처 아이콘 클릭 시 메인 프로세스를 통해 전체 화면 위에 선택 가능한 오버레이를 띄운다.
3. 사용자가 영역을 선택하면 해당 영역이 이미지로 캡처되어 렌더러 프로세스(관리자 위젯)로 전달된다.
4. 캡처가 성공하면 첫 노드가 있는 트리 창을 확보하고, 어시스턴트 채팅 패널을 열어 캡처 이미지를 첨부한 입력 상태로 초기화한다.
5. 사용자는 바로 추가 텍스트를 작성 후 전송할 수 있어야 한다.
6. 캡처 중 ESC 나 취소 시에는 아무 영향도 남기지 않고 흐름을 종료한다.

## 3. 사용자 흐름
1. 사용자가 관리자 위젯을 연다.
2. 상단 컨트롤 바의 `캡처` 아이콘을 클릭한다.
3. 전체 화면을 덮는 반투명 오버레이가 나타나고, 사용자는 드래그로 영역을 선택한다.
4. 선택 완료 시 짧은 피드백을 보여주고 오버레이는 닫힌다.
5. 트리(메인/위젯) 창이 자동으로 포커스를 가져오고 첫 노드 채팅 패널이 열리며, 새 메시지 입력창에 이미지가 미리 첨부되어 있다.
6. 사용자는 텍스트를 입력해 전송하거나 이미지를 제거할 수 있다.

## 4. 기술 설계 개요

### 4.1 관리자 위젯 UI 수정
- `src/shared/components/admin/AdminWidgetControlBar.jsx`
  - Lucide `Camera` 아이콘 버튼 추가 (`title="화면 캡처"`).
  - `onCaptureClick` 핸들러를 프롭으로 받아 기존 버튼들과 동일한 드래그/포커스 스타일 유지.
- `src/features/admin/ui/AdminWidgetPanel.jsx`
  - 상태 훅을 확장해 `handleCapture` 콜백 구현.
  - `adminWidgetService`에 캡처 액션을 위임하여 IPC 호출을 간소화.

### 4.2 서비스 & IPC 레이어
- 새 서비스 메서드 추가: `features/admin/services/adminWidgetService.js`
  - `requestGlobalCapture` → `ipcRenderer.invoke('capture-area:request')` 사용.
- IPC 채널 정의
  - `electron/main/ipc-handlers/capture.js`(신규)에서 요청/응답 처리.
  - 성공 시 `capture-area:completed` 이벤트로 이미지 버퍼 전달.
  - 취소 시 `capture-area:cancelled` 송신.
- `electron/main/bootstrap/ipc.js`
  - `registerCaptureHandlers` 추가.

### 4.3 캡처 오버레이 구현 (메인 프로세스)
- 새 모듈: `electron/main/capture-overlay.js`
  - 투명한 `BrowserWindow` 생성 (fullscreen, always-on-top, frameless, 클릭 스루 비활성화).
  - 렌더러 페이지: `electron/renderer/capture-overlay.html` + React 미사용 단순 캔버스 or Svelte? — 최소 요구 기능으로 HTML/Vanilla JS.
  - 영역 선택 UI: 마우스 다운/업 이벤트로 사각형 좌표 계산, 시각적 피드백 제공.
  - 선택 완료 시 `desktopCapturer.getSources({ types: ['screen'] })` 활용해 현재 디스플레이 이미지 획득 후 `crop` 처리(Sharp 등 사용) 또는 `capturePage` 활용.
  - 다중 모니터 고려: 선택 영역이 속한 디스플레이 계산 후 해당 디스플레이 결과 사용.

### 4.4 이미지 처리 & 저장 전략
- 선택 영역 좌표 기반으로 원본 스크린샷 이미지에서 crop.
- `nativeImage` → PNG Buffer → Base64 문자열.
- 임시 파일 저장 필요 시 `app.getPath('temp')` 하위에 저장하여 렌더러로 경로 전달.
- 기본 흐름: 메인에서 PNG Base64를 렌더러(Admin)로 전달, 이후 트리 창으로 재전달.

### 4.5 트리 채팅 패널 연동
- `electron/main/app-window/index.js`
  - `ensureMainWindowFocus` 활용하여 메인(혹은 위젯) 창 포커스.
  - IPC로 `chat:first-node-open` 이벤트 송신.
- `src/features/tree/ui/components/NodeAssistantPanelContainer.js`
  - `useNodeAssistantPanelController`에서 새 이벤트 수신(`systemBridge` or 커스텀 Bridge)을 통해 첫 노드 열기.
  - 첨부 구조 없으므로 신규 상태 도입: `pendingImageAttachment` (Blob/URL).
  - 메시지 입력 영역 컴포넌트에 이미지 미리보기 추가, 전송 시 업로드/스트림.
- 서버 연동 영향 파악 필요: LLM 서비스가 이미지 입력을 처리할 수 있는지 확인하고, 필요 시 업로드 후 URL만 전달.

### 4.6 접근성 & UX
- 캡처 진행 중 단축키 안내(ESC 취소).
- 캡처 성공/실패 토스트 알림 (`AdminWidgetPanel` 또는 트리 패널 쪽 공용 토스트 사용 중인지 확인 필요).

## 5. 단계별 작업 계획
1. **기초 인프라**
   - 캡처 IPC 채널 및 오버레이 창 틀 구축.
   - Dummy 캡처 흐름(고정 이미지를 반환)으로 관리자 위젯과 트리 채팅 연결 검증.
2. **실제 캡처 구현**
   - `desktopCapturer` 기반 디스플레이 캡처 + 자르기 로직 완성.
   - 다중 모니터 / Retina 스케일링 대응.
3. **채팅 첨부 통합**
   - 첫 노드 패널 열기 API 확장.
   - 메시지 입력창에 이미지 미리보기 & 전송 경로 구현.
4. **UX 다듬기 & 오류 처리**
   - 취소/오류 시 알림 UX.
   - 임시 파일 정리, 메모리 릴리즈.
5. **테스트 & QA**
   - 주요 OS(macOS/Windows/Linux-X11)에서 오버레이 동작 확인.
   - 이미지 첨부 후 LLM 응답 플로우 테스트.

## 6. 리스크 및 대응 전략
| 리스크 | 내용 | 대응 |
| --- | --- | --- |
| 멀티 디스플레이 좌표 | 디스플레이별 scaling/offset이 달라 crop 좌표가 어긋날 수 있음 | Electron `screen` API 사용해 디스플레이 bounds 적용, 자동 테스트 추가 |
| 성능/메모리 | 고해상도 캡처 시 메모리 사용 증가 | Buffer 크기 제한, 필요 시 JPEG 변환 옵션 제공 |
| 채팅 첨부 미지원 | 현재 채팅 패널이 파일 첨부를 지원하지 않을 수 있음 | 메시지 모델 확장 전 Proof-of-Concept 구현, 백엔드/LLM 팀과 API 조율 |
| 보안 | 화면 캡처 권한이 필요한 OS(macOS)에서 권한 미승인 시 실패 | 권한 체크 루틴 추가, 실패 시 가이드 메시지 표출 |

## 7. 검증 계획
- 단위 테스트: 캡처 서비스 모듈, IPC 핸들러의 happy-path/취소 케이스.
- 통합 테스트(수동):
  1. 관리자 위젯에서 캡처 실행 → 선택 영역 → 첫 노드 패널 열림 확인.
  2. 첨부 이미지가 채팅 입력창에서 미리보기되는지 확인.
  3. ESC 취소, 다중 캡처 연속 실행, 트레이/메인 창 포커스 전환 시나리오 점검.
- 퍼포먼스: 대형 모니터(4K)에서 capture latency 측정.

## 8. 오픈 이슈
- 백엔드/LLM이 이미지 메시지를 어떤 형식으로 수신해야 하는지 명확한 스펙 필요.
- 트리 첫 노드 식별 로직(매번 일정한 ID인지, 현재 선택된 노드인지)의 정의 필요.
- macOS 보안 권한 안내 UI를 자체 구현할지 여부 결정.
- 캡처 결과 저장 위치(임시 파일 vs. Base64 메모리) 확정.

---

### 파일 영향 예상 요약
- **Electron 메인**: `admin-panel.js`, `app-window/index.js`, 신규 `capture-overlay` 모듈, IPC 핸들러.
- **Renderer(Admin)**: `AdminWidgetControlBar.jsx`, `AdminWidgetPanel.jsx`, `adminWidgetService`.
- **Renderer(Tree)**: Node Assistant 패널 관련 훅/뷰, 메시지 스토어/전송 로직.
- **공용 브리지**: 캡처 완료 이벤트 전달 경로 추가.
- **Docs**: 본 문서 추가.

