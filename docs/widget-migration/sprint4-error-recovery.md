# Sprint 4 – 오류 재시도 & 로그 내보내기 UX

## 상황 정의
1. OpenAI 호출 실패 / 네트워크 오류
2. Electron 내부 예외 또는 renderer crash 감지
3. 글로벌 단축키 미동작 (권한 부족)

## 공통 UX 원칙
- 첫 실패 시 즉시 재시도 버튼과 로그 내보내기 링크 제공
- 사용자가 취할 수 있는 조치(권한 확인, 네트워크 점검)를 카드 형태로 안내
- 로그 수집 시 개인정보 최소화(메타 정보, UI 상태만)

## UI 스케치
```
[ 오류 카드 ]
---------------------------------------------
| ⚠️  무언가 잘못되었어요                     |
| "네트워크 연결을 확인하고 다시 시도해주세요." |
|                                             |
| [다시 시도]   [로그 내보내기]               |
|                                             |
| 기타 해결 방법                              |
|  - 접근성 권한 확인                          |
|  - OpenAI 키 재확인                          |
---------------------------------------------
```
- "다시 시도" → 기존 요청을 재실행 (handler 주입)
- "로그 내보내기" → `jarvisAPI.exportLogs()` (2025-09-25 bridge) + 후속 업로드 흐름
- "자동 재시도" → DebugDashboard에서 2초 간격 최대 3회 PoC 구현 (실제 오류 경로에 적용 예정)

## Renderer stub (추가 예정)
`src/components/ErrorRecoveryCard.js`
- props: `title`, `description`, `onRetry`, `onExport`
- 내부에서 `window.jarvisAPI.log('info', ...)`로 사용자 행동 로깅

## 후속 TODO
- [x] `jarvisAPI.exportLogs()` 브리지 설계
- [x] 자동 재시도 간격/횟수 정책 정의 (기본 3회, 최초 2초 지연 후 2초 간격)
- [x] 접근성 권한 가이드와 연동 (macOS 배너/Tray → `SettingsContext`에서 helper 호출)

### 자동 재시도 정책 (2025-09-25 업데이트)
- `autoRetryPolicy = { enabled: true, maxAttempts: 3, initialDelayMs: 2000, intervalMs: 2000 }`
- `ErrorRecoveryCard`가 정책을 받아 retry를 자동으로 스케줄하며, 각 시도는 `error_recovery_auto_retry_attempt` 로그를 남김
- 자동 재시도 실패 시에도 사용자는 수동으로 “다시 시도” 버튼을 눌러 흐름을 이어갈 수 있음

### 접근성 연동
- `SettingsContext`에서 `jarvisAPI.onTrayCommand`를 구독해 macOS 트레이 메뉴의 “접근성 권한 확인”을 눌렀을 때 `requestAccessibility()`를 호출
- 접근성 권한 상태는 `AccessibilityPermissionBanner`와 설정 패널에 동시에 반영되어 안내 모달과 토스트가 중복되지 않게 함
