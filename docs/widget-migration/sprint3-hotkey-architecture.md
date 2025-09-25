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
- 임시 기본 단축키: macOS `Command+Shift+J`, Windows/Linux `Control+Shift+J`
- Windows 더블 Ctrl PoC: `enableDoubleCtrl` 플래그(포커스된 창 기준 `before-input-event`에서 더블 Ctrl 감지, 글로벌 훅은 추후 iohook 도입 예정)
- 핫키 동작: 더블 Ctrl → 창이 포커스되지 않은 경우 열고, 이미 포커스된 상태면 숨김 + 클립보드 자동 붙여넣기
- Hotkey manager API: `registerToggle({ accelerator, handler, options })` → `options.enableDoubleCtrl` 등 확장 예정

## iohook 빌드 체크 (2025-09-25)
- `npm install iohook@0.9.3` 시도 → WSL(Ubuntu 24.04) 환경에서 node-gyp 의존성(`libx11-dev`, `python3`, `build-essential`) 설치 필요
- 빌드 성공 조건: `sudo apt-get install build-essential libx11-dev libxtst-dev libpng-dev` 후 `npm rebuild iohook`
- Electron 31.x와 호환되는 바이너리 확인, 추후 Sprint 4에서 hotkeys/windows.js에 통합 예정

## 설정 저장
- Renderer에서 사용자 설정을 `state:widget:update` IPC로 저장
- Hotkey 설정 변경 시 main 프로세스 재등록

## 오류 처리
- 등록 실패 → logger.warn + renderer toast (`state:notify`)
- 반복 실패 횟수 3회 이상 시 fallback accelerator 자동 적용

## TODO
- [x] PoC 구현 전, `iohook` 빌드 성공 여부 확인 (빌드 가이드 작성, 후속 Sprint 4에서 통합 예정)
- [x] macOS 접근성 권한 체크 helper (`systemPreferences.isTrustedAccessibilityClient`) 추가
- [x] 설정 패널 UI 와이어프레임 업데이트 → `sprint3-hotkey-settings.md`

