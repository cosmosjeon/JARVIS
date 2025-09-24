# Sprint 3 – 핫키 아키텍처 초안

## 목표
- 플랫폼별 구현을 교체 가능한 구조로 설계
- 핫키 이벤트 → 위젯 토글 → 로그/오류 핸들링 흐름 정의

## 모듈 구성
1. `electron/hotkeys/index.js`
   - 공통 인터페이스 `register({ accelerator, handler })`
   - 플랫폼 판별 후 `windows.js`, `mac.js`, `linux.js` 구현체 선택
2. `electron/hotkeys/windows.js`
   - `iohook` 또는 `SetWindowsHookEx` 래퍼 사용
   - Ctrl key down/up 타임스탬프 저장 → 500ms 이내 더블 탭 판단
3. `electron/hotkeys/mac.js`
   - `iohook` + 접근성 권한 체크
   - 미허용 시 `globalShortcut.register('Command+Space')` fallback
4. `electron/hotkeys/linux.js`
   - X11 환경: `iohook`
   - Wayland: config에서 fallback accelerator 사용

## 이벤트 흐름
```
핫키 감지 → hotkeyController.toggleWidget()
           ↳ windowConfig.alwaysOnTop 세팅 보정
           ↳ jarvisAPI.onLog 로깅
           ↳ 실패 시 state:notify IPC
```

## 설정 저장
- Renderer에서 사용자 설정을 `state:widget:update` IPC로 저장
- Hotkey 설정 변경 시 main 프로세스 재등록

## 오류 처리
- 등록 실패 → logger.warn + renderer toast (`state:notify`)
- 반복 실패 횟수 3회 이상 시 fallback accelerator 자동 적용

## TODO
- [ ] PoC 구현 전, `iohook` 빌드 성공 여부 확인
- [ ] macOS 접근성 권한 체크 helper (`systemPreferences.isTrustedAccessibilityClient`) 추가
- [ ] 설정 패널 UI 와이어프레임 업데이트
