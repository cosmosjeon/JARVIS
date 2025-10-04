# 현재 리팩터링 진행 상황 (2025-10-04)

## 개요
- **작업 범위 요약**
  - 공용 UI: `src/components/ui` / `src/src/components/ui` → `src/shared/ui` 로 통합 완료
  - 공용 훅/유틸: `src/hooks`, `src/utils`, `src/lib` → `src/shared/{hooks,utils,lib}` 로 통합 완료
  - Admin 위젯: 상태 훅(`useAdminWidgetState`) 및 컨트롤 바(`AdminWidgetControlBar`) 분리 완료
  - 라이브러리 상태: `useLibraryState` 슬라이스/selector 재구성 완료
- **미해결 핵심 이슈**
  - Electron preload 모듈 분리 후 빌드가 sandbox에서 실패 → `window.jarvisAPI` 미노출 → 위젯/AI 기능 비활성화 상태

## 최근 작업 상세
1. **Shared 레이어 정비**
   - 모든 shadcn UI 컴포넌트를 `shared/ui`로 이동하고 배럴(`shared/ui/index.js`) 작성
   - 테스트/컴포넌트 import 경로를 `shared/*` 로 일괄 교체
   - 기존 `components/ui`, `src/src/components/ui`, `hooks`, `utils`, `lib` 디렉터리 삭제
2. **Admin 리팩터링**
   - 서비스 호출을 `features/admin/services/adminWidgetService`로 일원화
   - 상태 훅(`useAdminWidgetState`) 도입 및 `AdminWidgetPanel` 슬림화
   - 공용 컨트롤 바 컴포넌트(`AdminWidgetControlBar`) 분리
3. **Electron preload 분해 (진행 중)**
   - `electron/preload/index.js` + `electron/preload/channels/*.js` 구조 신설
   - Main 프로세스에서 모든 BrowserWindow가 `preload/index.js`를 사용하도록 경로 변경

## 현상 및 재현 방법
- `npm run electron:dev` 실행 시 렌더러 콘솔에 다음 오류 표시
  ```
  Unable to load preload script: .../electron/preload/index.js
  Error: module not found: path
  ```
- `window.jarvisAPI` 미노출 → 라이브러리 앱에서 "VORAN API를 사용할 수 없습니다. Electron 환경에서 실행해주세요." 메시지 출력
- 트리 위젯 새 창 생성/열기가 전부 실패 (새 트리 만들기, 트리 더블클릭, Admin NEW 버튼 등)

## 원인 파악
- Electron sandbox에서 preload 번들링 시 Node 내장 `path` 모듈 사용이 차단됨
- 기존 sandbox 대비 preload 모듈 위치가 바뀌면서 캐시/빌드 스텁이 맞지 않을 가능성도 존재 (CRA 개발 서버 단독 실행 시에도 `window.jarvisAPI` 미노출)
- 새 구조가 제대로 번들되지 않으면 Electron이 fallback 없이 빈 API를 노출하지 않음 → 전 기능이 비활성화됨

## 다음 담당자 가이드
1. **환경 재시작**
   ```bash
   npm install
   npm run build
   npm run electron:dev
   ```
   - Electron DevTools 콘솔에서 `[preload] jarvisAPI ready [...]` 로그가 찍히는지 확인
2. **preload 디버깅**
   - `electron/preload/index.js`에서 `contextBridge.exposeInMainWorld` 호출 전후로 `console.log` 추가하여 로딩 여부 확인
   - 필요한 경우 모듈 경로를 절대경로(`path.join`) 대신 정적 `require('./channels/...')` 방식으로 유지 (이미 static map 사용 중)
   - sandbox 옵션 검토: `webPreferences.sandbox`를 임시로 `false` 로 바꾸고 동작 확인 → 문제가 sandbox 때문인지 분리할 수 있음
3. **fallback 전략**
   - preload 모듈 분리가 급하지 않다면, 단일 `preload.js`(동작하던 버전)으로 일시 되돌리고, 추후 sandbox 대응 가능할 때 다시 분리
   - 또는 preload 모듈을 CommonJS로 번들링하도록 `electron-builder`/`electron-forge` 설정 확인 (현재 CRA + `electron .` 구조이므로 직접 require만 가능)
4. **테스트 항목**
   - 라이브러리: 새 트리 생성, 트리 더블 클릭 → 위젯 창 생성 여부
   - Admin 패널: NEW 버튼 동작, 라이브러리 열기
   - Chat/Library Q&A: 메시지 전송 및 응답 렌더링(이전 warning 해결 여부 포함)

## 참고 파일
- `electron/preload/index.js`
- `electron/preload/channels/*.js`
- `electron/main.js` (preload 경로 설정)
- `src/services/treeCreation.js` (`window.jarvisAPI.openWidget` 사용)
- `docs/refactor-plan.md` (Stage 4A-1 체크박스 반영 필요)

## 최근 수정 사항 (2025-10-04)
1. **Sandbox 임시 비활성화**
   - 모든 BrowserWindow의 `sandbox: true` → `sandbox: false`로 변경
   - 문제 원인 격리를 위한 임시 조치
   - 향후 sandbox 호환 수정 후 다시 활성화 예정

2. **Preload 디버깅 로그 강화**
   - `electron/preload/index.js`에 상세 로그 추가
   - 각 채널 모듈 로드 상태 추적
   - API 빌드 과정 가시화

## TODO 요약
- [x] Electron sandbox 임시 비활성화하여 preload 로드 테스트
- [x] Preload 스크립트에 상세 디버깅 로그 추가
- [ ] **[긴급] 사용자 테스트 필요**: 앱 실행 후 위젯 생성 기능 확인
- [ ] `window.jarvisAPI` 노출 성공 시 라이브러리/위젯 플로우 회귀 테스트
- [ ] Sandbox 호환 수정 후 다시 활성화
- [ ] 필요 시 preload 분리 작업을 Stage 4A-1 완료로 문서 반영
