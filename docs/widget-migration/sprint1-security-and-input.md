# 전역 입력·보안 조사 (Sprint 1)

## 전역 단축키 권한 및 제약
| OS | 권한 요구 | 기술 접근 방식 | 리스크/제약 |
| --- | --- | --- | --- |
| Windows 10/11 | 추가 권한 없음(표준 사용자 가능) | `SetWindowsHookEx`(WH_KEYBOARD_LL) 또는 Electron `globalShortcut` | 저수준 훅은 DLL 인젝션 요구 → UAC 경고 가능, 게임/보안 SW에서 차단 사례 존재 |
| macOS 13+ | 접근성 권한 필요(시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용) | `CGEventTapCreate` 기반 훅, Electron에서는 `iohook` 등 네이티브 모듈 사용 | Apple Silicon에서 서명되지 않은 바이너리 차단, 권한 미허용 시 이벤트 수집 불가 |
| Linux (X11) | 대부분 추가 권한 없음, Wayland는 앱별 정책 | X11: `XGrabKey`, `XRecord`; Electron `globalShortcut`는 X11에서 동작 | Wayland에서는 전역 단축키 제한 → 포털 API 또는 데스크톱 환경별 확장 필요 |

### Double Ctrl 감지 메모
- Electron `globalShortcut`은 키 다운 이벤트만 제공 → 더블 탭 감지는 자체 시간 측정 필요
- macOS에서는 빠른 반복 입력 시 시스템이 키 반복으로 처리할 수 있어 이벤트 누락 가능
- 실패 대비: fallback 핫키(Ctrl+Space) 및 트레이 아이콘 토글 제공

## iohook vs 네이티브 모듈 비교
| 항목 | iohook | 직접 제작한 네이티브 모듈 |
| --- | --- | --- |
| 유지보수 | 커뮤니티 유지, 릴리스 간격 불규칙 | 팀 소유, 코드 완전 제어 가능 |
| Apple Silicon | 최근 포크에서 지원(서명 필요) | 서명/노터라이즈 필요, 자체 처리 |
| 성능 | 이벤트 필터링 비용 존재(공용 훅) | 요구 기능만 구현 가능 → 경량화 |
| 빌드 | 사전 빌드 제공(한정된 Node 버전), 나머지는 node-gyp 필요 | 플랫폼별 toolchain 유지 필수 |
| 리스크 | 의존성 중단, 보안 이슈 대응 지연 | 초기 투자 및 보안 책임 전가 |
| 권장 | MVP에서는 빠른 PoC용, 베타 이후 직접 모듈 고려 |  |

## 저수준 훅 실패 시 fallback UX
1. 핫키 등록 실패 → 사용자에게 설정 패널에서 대체 핫키 지정 요청
2. 핫키 이벤트 누락 → 트레이 아이콘/시스템 메뉴에서 토글 버튼 제공
3. 권한 거부(macOS) → 권한 안내 모달 표시 후, 클립보드 복사→Shift+Ctrl+V 등 대체 흐름 안내

## Electron 보안 체크리스트
- [x] `contextIsolation: true`
- [x] `nodeIntegration: false`
- [x] `sandbox: true` (필요 시 enableRemoteModule false)
- [x] `preload`에서 최소 API만 `contextBridge.exposeInMainWorld`
- [x] `webPreferences` → `disableDialogs`, `navigateOnDragDrop: false`
- [x] `app.commandLine.appendSwitch('--no-sandbox')` 금지 (테스트 환경 제외)
- [x] `BrowserWindow`에서 `backgroundColor` 지정해 투명도 악용 방지
- [x] CSP 헤더 추가(`default-src 'self'; connect-src 'self' https://api.openai.com`) 
- [x] 자동 업데이트 채널 검증(서명된 아티팩트만 허용)
- [x] `IPC` 채널 화이트리스트 + 입력값 검증

## OpenAI API 키 저장 방식 비교
| 방법 | 장점 | 단점 | 권장 시나리오 |
| --- | --- | --- | --- |
| `.env` + 환경 변수 | 설정 간단, 개발 환경 편리 | 데스크톱 빌드에 포함되면 키 노출 위험, 사용자 PC에 저장 시 평문 | 로컬 개발, 빌드 서버 환경 변수 주입 |
| `keytar` (OS 비밀 저장소) | OS 수준 암호화, 사용자 계정과 연결 | 초기화 시 네이티브 모듈 설치 필요, 일부 Linux 배포판에서 Secret Service 구성 필요 | 배포 후 사용자 입력 키 저장 |

### 제안
1. **개발**: `.env.local`로 키 주입 (Git ignore 유지)
2. **배포**: 최초 실행 시 키를 입력받아 `keytar`에 저장, IPC로 렌더러에 전달하지 않고 main에서 proxy 호출
3. **백업 플로우**: Secret Service 미구성 Linux → 암호화된 로컬 파일(AES) + 사용자 비밀번호로 보호
