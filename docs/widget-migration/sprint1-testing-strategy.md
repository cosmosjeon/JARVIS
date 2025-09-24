# 테스트 전략 (Sprint 1)

## 목표
- NodeAssistantPanel UI 회귀를 빠르게 감지할 스냅샷 테스트 1종 추가
- 하이라이트 모드를 검증하는 동작 테스트 유지/강화
- Electron 전환 시 Playwright 기반 통합 테스트 플랜 수립

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

## Playwright + Electron 조사 메모
- 권장 패키지: `@playwright/test` + `playwright/coverage` + `@playwright/test-electron` (MS Playwright 예제 기반)
- 실행 방식: Electron main 프로세스를 스폰하고, 렌더러에 Playwright 연결 → 미니맵 수준 e2e 검증 가능
- 장점: Spectron EoL, 최신 Chromium 엔진과 호환, 병렬 시나리오 가능
- 할 일 (Phase 1)
  - `playwright.config.ts`에 Electron 프로젝트 추가
  - smoke test: Electron 앱 부팅 → 패널 렌더링 → 텍스트 입력/응답 확인
  - CI 연동 시 `xvfb-run`/macOS runner 지원 여부 검증

## 커버리지 우선순위
1. 기본 렌더링 (스냅샷)
2. 하이라이트 토글 및 placeholder 생성 (기존 테스트 강화)
3. Electron e2e smoke (Phase 1 이후)
4. 단축키/클립보드 흐름 시나리오 (Phase 3 계획)
