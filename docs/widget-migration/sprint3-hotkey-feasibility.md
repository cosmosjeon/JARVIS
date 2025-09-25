# Sprint 3 – 전역 단축키 (Ctrl+Ctrl) 타당성 조사

## 목표
- Windows/macOS에서 Ctrl+Ctrl(Win) / Cmd+Cmd(mac) 두 번 입력 감지 가능한지 검증
- 권한 요구사항과 실패 시 대체 시나리오 정의
- Electron 수준에서 구현 가능한 라이브러리 및 네이티브 모듈 비교

## 플랫폼별 요약

### Windows 10/11
- API 후보
  - `RegisterHotKey` (Win32): 반복 입력 구분 불가, 이중 입력은 타이머로 처리
  - `SetWindowsHookEx(WH_KEYBOARD_LL)`: 절대 좌표 키 이벤트 훅 가능, UAC 권한 불필요
- 리스크
  - 일부 보안 SW가 저수준 훅 차단
  - 게임/풀스크린 앱과 충돌 가능 (키 이벤트 swallow 여부 주의)
- 대응
  - 실패 시 fallback `Ctrl+Space`
  - 훅 재시도 로직 + 사용자 안내 모달

### macOS 13+
- API 후보
  - `CGEventTapCreate` (accessibility 권한 필요)
  - Electron `globalShortcut`는 반복 입력 판별 불가 → 조합 불가
- 리스크
  - 접근성 권한 거부 시 이벤트 수집 불가
  - Apple Silicon: 서명/노터라이즈된 binary 필요
- 대응
  - 권한 안내 UI + System Preferences 링크 제공
  - fallback: `Cmd+Shift+Space` 등 사용자 지정 가능하도록 옵션 제공

### Linux (X11/Wayland)
- X11: `XGrabKey` 또는 `XRecord`로 감지 가능, 하지만 Wayland에서 제한적
- Wayland: GNOME/KDE portal 사용 필요, Electron native 지원 미흡
- 대응
  - MVP 범위에서 Linux는 `Ctrl+Alt+Space` 등 전역 조합으로 대체
  - 문서에 “Wayland는 수동 단축키 설정 필요” 명시

## 라이브러리 비교
| 라이브러리 | 장점 | 단점 | 비고 |
| --- | --- | --- | --- |
| `iohook` | 다중 OS 지원, 이벤트 스트림 제공 | Apple Silicon 서명 필요, 유지보수 불안 | MVP PoC 용도 가능 |
| `@nut-tree/nut-js` | 고수준 입력 API, TypeScript 지원 | 의존성 많음, 이벤트 훅은 실험적 | 단축키 감지는 제한적 |
| 자체 네이티브 모듈 | 커스텀 가능, 최적화 용이 | 구현/테스트 비용 큼 | Phase 3 이후 고려 |

## 타임라인 제안
1. Week 5 (Sprint 3 Week 1): Windows + macOS Ctrl+Ctrl PoC 작성, 성공률 로그 수집
2. 실패 시 fallback 핫키 UX 정의, 설정 패널에 노출
3. Week 6: 권한 안내 플로우, 대체 키 입력 저장 구현

## 성공 기준
- Windows: Ctrl+Ctrl 95% 이상 성공률 (500ms 이내 두 번 입력)
- macOS: 접근성 권한 허용 시 90% 이상 성공률, 미허용 시 명확한 안내 제공
- Linux: 공식 fallback 문서화
