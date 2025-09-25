# macOS 클립보드 권한 안내 초안 (Sprint 3)

## 안내 흐름
1. 전역 단축키 실행 → 클립보드 접근 시도
2. `systemPreferences.isTrustedAccessibilityClient(false)` 결과가 거짓이면 아래 안내 문구 호출
3. Renderer 토스트 + 안내 모달에서 다음 내용을 표시

## 안내 문구 (초안)
- 제목: "macOS 접근성 권한이 필요합니다"
- 본문 (2단락):
  1. "클립보드를 자동으로 불러오기 위해 macOS 접근성 권한이 필요합니다."
  2. "설정 > 보안 및 개인 정보 보호 > 개인 정보 보호 탭에서 '접근성'을 선택하고 JARVIS를 허용해 주세요."
- 버튼: "설정 열기" → `shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')`
- 서브텍스트: "권한 허용 후 단축키를 다시 눌러 주세요."

## 다국어 고려
- 기본은 한국어, 추후 영어/일본어 번역 필요 여부를 Sprint 4에서 검토

## 후속 TODO
- [x] 접근성 권한 확인 helper에서 안내 모달 트리거 연결 (SettingsContext + AccessibilityPermissionBanner)
- [x] Renderer에서 모달 UI 컴포넌트 설계 (`AccessibilityPermissionBanner`, macOS 안내 모달/토스트 정리)
