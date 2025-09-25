# 테스트 전략 (Sprint 1)

## 목표
- NodeAssistantPanel UI 회귀를 빠르게 감지할 스냅샷 테스트 1종 추가
- 하이라이트 모드를 검증하는 동작 테스트 유지/강화
- Electron 전환 시 자동화된 스모크 테스트 플로우 설계

## 현재 상태 요약
- Jest + React Testing Library 구성 (`src/setupTests.js`)
- `NodeAssistantPanel.test.js`에서 사용자 이벤트 시나리오 일부 커버

## Snapshot 테스트 도입
- `render(<NodeAssistantPanel ... />); const { asFragment }`으로 초기 UI 스냅샷 생성
- 질문/응답 후 상태까지 동일 스냅샷으로 비교하지 않고, 초기 렌더만 고정 (과도한 실패 방지)
- 스냅샷 위치: `src/components/__tests__/__snapshots__/NodeAssistantPanel.test.js.snap`

## 하이라이트 테스트
- `web-highlighter`를 Jest mock으로 대체하여 DOM 이벤트 시뮬레이션
- `highlightSourceMapRef`와 `onPlaceholderCreate` 호출 여부를 검증
- Electron 환경에서도 동일 로직이 동작하도록 훅 추출 시 Mock 기반 테스트 재사용 예정

## Electron 스모크 테스트 자동화 대안
- Playwright 대신 **패키지된 앱을 직접 기동하는 Node 기반 스모크 스크립트** 채택
- 흐름 개요
  1. `npm run build`로 React 번들을 준비하고 `electron-builder --dir`로 언팩 빌드 생성
  2. Node 스크립트(`scripts/smoke/run-electron-smoke.js`)가 언팩된 실행 파일을 기동
  3. `stdout`/`stderr` 및 `electron-log` 파일에서 `Main window ready` 로그를 기다리며 타임아웃 관리
  4. 종료 전 IPC 헬스체크(예: `process.send('ping')` → `process.on('message')`)로 기본 채널 응답 확인
  5. 성공/실패 결과를 콘솔과 CI 종료 코드로 리턴
- 이 접근의 장점: 외부 브라우저 드라이버 없이 Electron 런타임만 사용, CI에서 headless 환경 의존 최소화
- TODO
  - Linux CI에서는 `--no-sandbox` 플래그를 강제해 headless 환경에서 실행되도록 유지하고, 로거 경로/IPC 헬스체크 보완 및 CI에서 필요한 디스플레이 세팅(`xvfb-run`) 가이드를 정리
  - 결과 리포팅 형식 정의(JUnit 등)로 Nightly 파이프라인 연동 준비

## 커버리지 우선순위
1. 기본 렌더링 (스냅샷)
2. 하이라이트 토글 및 placeholder 생성 (기존 테스트 강화)
3. Electron 스모크 스크립트로 창 기동·로그 확인
4. 단축키/클립보드 흐름 시나리오 (Phase 3 계획)

## 리스크 및 대응
- Electron 언팩 빌드 경로(OS별 상이) → 스모크 스크립트에서 플랫폼별 경로 매핑 함수 작성
- CI 리소스 사용량 증가 → 스모크 테스트를 Nightly 파이프라인에만 연결하고 Pull Request에서는 옵트인 실행
- 로그 포맷 변경 시 스모크가 실패할 수 있음 → `electron/logger.js`에 `Main window ready` 메시지를 유지하고 회전 정책 확정 시에도 동일 키워드를 보존

## 참고 문서
- `docs/widget-migration/sprint1-node-assistant-panel.md`
- `docs/widget-migration/sprint1-chat-highlight-interfaces.md`
- `docs/widget-migration/sprint1-security-and-input.md`
