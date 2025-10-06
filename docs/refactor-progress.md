# Refactor Progress (2025-10-05)

## Current State Snapshot
- Renderer 브리지 교체(Stage 4A-2) 완료: 트리/라이브러리/Admin/Auth/트레이/로그 관련 전역 `window.jarvisAPI` 호출이 전부 브리지 계층(`src/infrastructure/electron/bridges/*`)으로 이동했습니다.
- `docs/refactor-plan.md` 기준 작업 4A-2 항목은 AI 체크 완료, 사용자 점검도 통과한 상태입니다.
- `docs/architecture.md`는 브리지 구조를 따르며, `settingsBridge`, `loggerBridge`, `trayBridge`, `systemBridge`, `libraryBridge`, `oauthBridge`, `adminBridge` 등 신규 브리지 타입이 추가되어 있습니다.

## Partial Stage 4B-1 Progress
- 새 디렉터리/모듈 생성: `electron/main/app-window`, `electron/main/auth`, `electron/main/bootstrap`, `electron/main/library-window`, `electron/main/admin-panel`.
- 그러나, 모듈 분리 작업 중 Electron이 실행되지 않는 문제가 발생하여 `electron/main.js`는 정상 동작하던 HEAD~1 버전으로 되돌려 둔 상태입니다.
- 새로 만든 모듈(`app-window/index.js`, `library-window.js`, `admin-panel.js`)과 부트스트랩 유틸(`bootstrap/window-state.js`, `bootstrap/renderer-url.js`, `bootstrap/settings-broadcast.js`)은 아직 main.js에 연결되어 있지 않습니다.
- 따라서 Stage 4B-1 체크리스트는 모두 미완료 상태이며 docs/refactor-plan.md도 아직 갱신되지 않았습니다 (사용자 점검을 포함한 모든 체크가 미체크 상태).

## Next Suggested Steps
1. **계속 진행 전 검증:** 현재 `electron/main.js`는 복구된 상태입니다 (`npm run electron:dev`로 실행). 브리지 기반 기능들은 모두 정상 동작합니다.
2. **main.js 구조 분리 재개:**
   - app-window, auth, bootstrap, admin-panel, library-window 모듈을 점진적으로 연결하면서 테스트를 병행할 필요가 있습니다.
   - 특히 `createWindow`, `createAdditionalWidgetWindow`, `ensureWindowFocus`, `resolveBrowserWindowFromSender` 등은 새 모듈로 이전 후 main.js에서 가져오는 형태로 교체해야 합니다.
   - OAuth server `ensureAuthCallbackServer`, 딥링크 처리, `ipcMain.handle` 등록부도 분리 대상입니다.
3. **중간 검증 반복:** 각 단계마다 Electron을 실행해 문제없이 기동하는지 확인하고, `docs/refactor-plan.md`의 체크 항목을 반영하십시오.

## Notes for the Next Engineer
- Stage 4A-2는 이미 완료되어 있으므로 브리지 관련 수정은 건드릴 필요 없습니다.
- Stage 4B-1의 중간 작업 중 Electron이 실행되지 않는 이슈가 발생했으므로, main.js에서 추가적인 수동 수정 전에 안정적으로 리팩터링할 부분을 모듈 단위로 분리하고 테스트를 병행하는 방식으로 진행하시길 권장합니다.
- 필요 시 `git show HEAD~1:electron/main.js > electron/main.js` 명령으로 언제든 복구할 수 있습니다 (현재는 이미 복구된 상태입니다).
- 모든 진행 내용은 docs/refactor-plan.md를 기준으로 계속 업데이트해주세요.
