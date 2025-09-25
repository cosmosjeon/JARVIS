# Sprint 4 – 트레이 & 토글 준비 메모 (2025-09-25)

## 목표
- 트레이 아이콘에서 위젯 토글, 설정, 종료 메뉴 제공
- Renderer 측에서 `jarvisAPI.toggleWindow()` 사용 경로 정리
- macOS 및 Windows 트레이 UX 차이 정리

## IPC 구조
- `window:toggleVisibility` (main) ← `jarvisAPI.toggleWindow()` (preload)
- `tray:command` (main → renderer) – 2025-09-25 구현, 트레이 메뉴/클릭 이벤트가 DebugDashboard로 전달

## Renderer 플레이스홀더
- `src/components/TrayDebugButton.js`에서 `jarvisAPI.toggleWindow()` 호출 구현 (2025-09-25)
- `src/views/DebugDashboard.js`에 디버그 카드/토글 진입점 배치 (개발 모드 전용 오버레이)
- 후속 작업에서 헤더 액션/설정 패널에 자연스럽게 배치 예정

## 후속 TODO
- [x] Electron `Tray` 인스턴스 생성 및 메뉴 구성 (Windows/macOS 분기)
- [x] `tray:command` IPC 설계 → Renderer 이벤트 통합
- [x] 설정 패널에 "트레이 아이콘 사용" 토글 추가 (SettingsPanel + SettingsContext 저장)

## 접근성 권한 연계 메모
- macOS 트레이 메뉴에 "접근성 권한 확인" 항목 추가 (main → `app.emit('tray:accessibility-check')`)
- Renderer 측에서 `jarvisAPI.requestAccessibilityPermission` 브리지 구현 후 토스트/배너 갱신 예정
- 상태 저장은 Sprint 4 설정 패널 작업에서 함께 처리
