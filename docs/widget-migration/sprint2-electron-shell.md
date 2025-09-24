# Sprint 2 – Electron 셸 기본 설정

## 설치 및 스크립트
- `package.json`에 Electron(`^31.2.0`), electron-builder(`^25.1.0`) 추가
- 개발용 유틸: `cross-env`, `concurrently`, `wait-on`
- 신규 npm 스크립트
  - `npm run start:renderer` – CRA 개발 서버를 브라우저 없이 실행
  - `npm run start:electron` – 포트 3000 대기 후 Electron 실행
  - `npm run electron:dev` – 상기 두 프로세스를 병렬 실행
  - `npm run electron:build` – React 빌드 후 electron-builder 호출
- Electron 앱 메인 엔트리: `electron/main.js`

### 실행 흐름
1. `npm install`
2. `npm run electron:dev` → CRA(포트 3000) + Electron 동시 기동 (첫 실행 시 10~15초 스타트업 여유)
3. Prod 확인: `npm run electron:build` → `dist/`에 생성된 앱 실행 (플랫폼별 서명/노터라이즈는 추후 단계)

## BrowserWindow 기본값 (PoC)
| 설정 | 값 | 메모 |
| --- | --- | --- |
| `width/height` | 1024 × 720 | MVP 작업 공간 기준치 |
| `minWidth/minHeight` | 520 × 360 | 최소 사이즈 제한 |
| `backgroundColor` | `#111827` | 위젯 다크 톤과 맞춤 |
| `autoHideMenuBar` | `true` | 메뉴 제거, 보안경고는 콘솔로 유지 |
| `frame` | `!windowConfig.frameless` | IPC로 실시간 토글 가능 |
| `transparent` | `windowConfig.transparent` | 투명 창 실험용 플래그 |
| `alwaysOnTop` | `windowConfig.alwaysOnTop` | floating 레벨 유지 |
| `skipTaskbar` | `windowConfig.skipTaskbar` | 위젯 모드 시 작업표시줄 숨김 |
| `webPreferences.contextIsolation` | `true` | 보안 체크리스트 준수 |
| `webPreferences.sandbox` | `true` | 렌더러 샌드박스화 |
| `webPreferences.devTools` | `isDev` | 개발 모드에서만 DevTools 허용 |
| `setWindowOpenHandler` | `deny` | 외부 링크는 shell.openExternal |

## Preload 브리지
- `electron/preload.js`에서 최소 API 노출
  - `jarvisAPI.ping()` → `ipcMain.handle('system:ping')`
  - `jarvisAPI.updateWindowConfig(config)` → 실시간 창 옵션 토글
  - `jarvisAPI.log(level, message, meta?)` → main logger 브리지
  - `jarvisAPI.onLog(handler)` → 메인 프로세스의 `app:log` 이벤트 구독용 제거 함수 리턴
- 추후 IPC 채널 정의를 위해 `widgetAPI`보다 구체적인 이름(`jarvisAPI`) 유지

## 창 옵션 실험 메모
- `jarvisAPI.updateWindowConfig({ frameless: true })` 호출 시 메뉴바 자동 숨김, Windows에서는 그림자 제거됨
- `transparent: true` 설정 시 Windows에서 텍스트 블러 현상 관찰(추가 CSS 필요), macOS vibrancy는 추후 실험 예정
- `alwaysOnTop: true` + `skipTaskbar: true` 조합은 위젯 모드에 적합, 클릭 포커스 문제는 추후 QA 필요
- 설정은 앱 재시작 시 기본값으로 초기화됨 (현 단계에서는 영구 저장 없음)

## 체크 항목
- [x] Electron 보안 기본 설정 적용
- [x] CRA 번들을 로컬 파일에서 로드하는 생산 경로
- [x] 프레임리스/투명 모드 실험 훅 추가
- [x] IPC 명세 초안 작성 (`sprint2-ipc-contract.md`)
- [ ] OS별 렌더링/포커스 관찰 기록 업데이트
- [x] Logging 브리지 및 실행 가이드 문서화
- [ ] 실제 기동 테스트 로그 첨부 (차후 실행 후 업데이트)
- [ ] Windows/macOS QA 결과 링크 추가 예정
