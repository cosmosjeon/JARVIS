# Sprint 2 – 로깅 및 디버깅 메모

## 공통 전략
- main 프로세스: `electron-log` 기반(`electron/logger.js`) 브리지 도입
- renderer: `console` 로그는 개발 모드에서만 유지, 프로덕션은 `window.jarvisAPI.log(level, message, meta)` 사용
- 로그 파일 위치는 OS 별 사용자 데이터 경로 사용 (`app.getPath('userData')/logs/app.log`)

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
- [ ] 로그 순환 정책(최대 파일 크기/보존 기간) 확정 및 테스트 (현재 512KB 스텁)
- [ ] renderer 로그 전송 용도별 레벨 가이드 작성
- [ ] crash/error 로그 업로드 전략 수립
- [ ] `npm run electron:dev` 실행 후 로그 출력 스크린샷/기록 추가
