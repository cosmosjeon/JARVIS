# Sprint 4 – macOS 접근성 가이드 통합 계획

## 목표
- 트레이 메뉴와 설정 패널에서 접근성 권한 상태를 확인하고, 미허용 시 안내를 제공
- Renderer → Main 브리지: `jarvisAPI.requestAccessibilityPermission()` 추가 (SettingsPanel/DebugDashboard 사용)
- 사용자 흐름: 권한 미허용 → 안내 배너/모달 → "설정 열기" → 재검사 (`AccessibilityPermissionBanner`)

## 단계별 플로우
1. 앱 시작 시 `window.jarvisAPI.checkAccessibilityPermission()` 호출 (macOS 한정) → **2025-09-25 bridge 구현 완료**
2. false 반환 시 헤더 배너 + 설정 패널 경고 표시
3. 배너의 "권한 허용" 버튼 → `requestAccessibilityPermission()` → main에서 `systemPreferences.isTrustedAccessibilityClient(true)`
4. 결과를 Renderer에 전달하여 UI 업데이트 (`DebugDashboard` 뷰에서 시범 구현)

## 트레이 연동
- macOS 트레이 메뉴 추가 항목: "접근성 권한 확인"
- 클릭 시 `jarvisAPI.requestAccessibilityPermission()` 실행 후 성공/실패 토스트 표시

## UI 요소
- 설정 패널 섹션: "macOS 권한"
  - 상태 태그 (`허용됨` / `필요`) 색상 구분
  - 설명 텍스트: `sprint3-clipboard-permissions.md` 참고

## 후속 TODO
- [ ] `jarvisAPI.checkAccessibilityPermission` 브리지 구현 (mac 전용 no-op)
- [ ] 배너 컴포넌트 작성 (`AccessibilityPermissionBanner`)
- [ ] 트레이 메뉴 구축 후 `tray:command` IPC에 통합
