# Sprint 5 진행 현황 (2025-10-??)

## 완료된 항목
- Electron 패키징 빌드 파이프라인 실행 (`npm run electron:build`) 및 산출물 기록 (`docs/widget-migration/runs/2025-09-25-electron-build-smoke-linux.md`)
- Node 기반 스모크 러너 작성 및 `electron:smoke` 스크립트 추가 (sandbox 제약 하에서 실패 로그 확보)
- 접근성 권한 배너/트레이 연동, 자동 재시도 정책, 핫키 설정 UI 마감
- 로그 순환(1MB)·7일 보존 정책 및 renderer 로그 레벨/업로드 전략 문서화

## 진행 중 / 이관 항목
1. **플랫폼 QA** – Windows 투명/alwaysOnTop, macOS frameless+vibrancy 실측 및 캡처 필요 (Sprint 6 QA 트랙)
2. **스모크 파이프라인 안정화** – sandbox 허용된 CI 환경에서 `electron:smoke` 재실행, 또는 fallback 시나리오 정의
3. **릴리스 체크리스트** – 서명/노터라이즈, iohook 배포, 로그 업로드 백엔드 등 운영 태스크 정리

## 산출물 링크
- `docs/widget-migration/runs/2025-09-25-electron-build-smoke-linux.md`
- `scripts/smoke/run-electron-smoke.js`
- `electron/logger.js`, `docs/widget-migration/sprint2-logging-debug.md`
- `docs/widget-migration/sprint4-error-recovery.md`

## 메모
- WSL2에서 Electron 언팩 바이너리 실행 시 `sandbox_host_linux.cc` 오류 발생 → CI 가이드에 환경 설정(예: `sysctl kernel.unprivileged_userns_clone=1`, `xvfb-run`) 추가 필요
- 핫키 전역 훅은 iohook 설치 여부에 따라 자동 감지. 배포용 빌드에서 바이너리 서명 및 모듈 패키징 검토 필요
