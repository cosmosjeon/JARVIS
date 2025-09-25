# Sprint 2 – 로깅 및 디버깅 메모

## 공통 전략
- main 프로세스: `electron-log` 기반(`electron/logger.js`) 브리지 도입
- renderer: `console` 로그는 개발 모드에서만 유지, 프로덕션은 `window.jarvisAPI.log(level, message, meta)` 사용
- 로그 파일 위치는 OS 별 사용자 데이터 경로 사용 (`app.getPath('userData')/logs/app.log`)
- 2025-09-25 업데이트: 로그 파일은 1MB 단위로 회전하고, 7일 지난 보관 로그는 자동 삭제 (`electron/logger.js` 회전/보존 로직)

## Windows (Win32)
- DevTools shortcut: `Ctrl+Shift+I` (dev 모드에서 허용)
- Event Viewer → Application 로그에서 Electron crash 확인 가능
- 투명/alwaysOnTop 테스트 시 포커스가 잦은 앱(Teams, Zoom)과 충돌 여부 기록 예정
- 로깅 파일 인코딩 UTF-8, CRLF 변환 주의

## macOS
- DevTools shortcut: `Cmd+Opt+I`
- Console.app → subsystem `com.jarvis.widget` 필터링 예정
- 접근성 권한 안내/단축키 훅 실패 로그는 `~/Library/Logs/JARVIS Widget/`에 저장
- vibrancy/blur 실험 결과는 별도 QA 문서로 이동 예정

## TODO
- [x] 로그 순환 정책(최대 파일 크기/보존 기간) 확정 및 테스트 (현재 1MB, 7일 보존)
- [x] renderer 로그 전송 용도별 레벨 가이드 작성 (아래 가이드 참고)
- [x] crash/error 로그 업로드 전략 수립 (Phase 4 준비 메모 반영)
- [x] `npm run electron:dev` 실행 후 로그 출력 스크린샷/기록 추가

## Renderer 로그 레벨 가이드 (2025-09-25)
- `info`: 사용자 행위 기록(단축키 토글, 자동 재시도 시도), UI 상태 변경 등 분석용 이벤트
- `warn`: 예상 가능한 실패(클립보드 비어 있음, 접근성 권한 미허용 등) – UX 토스트와 쌍으로 사용
- `error`: 복구 불가능한 오류(IPC 실패, API 호출 오류) – ErrorRecoveryCard 표시와 연동, 로그 업로드 대상

## Crash/Error 업로드 전략 초안
1. `electron/logger.js` 회전 정책으로 로그 파일을 1MB 단위로 축소 유지
2. `jarvisAPI.exportLogs()`로 사용자가 즉시 내보내기 가능
3. 자동 업로드 플로우(Phase 4):
   - renderer에서 `jarvisAPI.log('error', ...)` 호출 시 큐에 적재
   - 5분 간격 배치로 Main → S3(혹은 내부 API) 업로드, 사용자 동의 필요
   - 업로드 실패 시 최대 3회 재시도 후 사용자에게 내보내기 안내

## Dev Run 로그 스냅샷
- 실행 명령: `npm run electron:dev`
- 주요 로그:
  - `Main window ready`
  - `Loading URL http://localhost:3000`
- 스크린샷/기록: `docs/widget-migration/runs/2025-09-25-electron-dev.md`에 dev run 환경과 로그 캡처 첨부
