# Sprint 2 진행 현황 (2025-10-xx)

## 완료된 항목
- Electron 셸 초기화 및 보안 옵션 적용 (`electron/main.js`, `electron/preload.js`)
- 프레임리스/투명/alwaysOnTop/skipTaskbar 토글 훅과 IPC (`window:updateConfig`)
- `jarvisAPI.log` → main logger 브리지 (`electron/logger.js`)
- IPC 계약 초안 문서 (`sprint2-ipc-contract.md`)
- 실행 가이드 및 로깅/디버깅 문서 초안 작성

## 남은 TODO (Sprint 3로 이관)
1. 실제 실행 검증 (담당 TBD)
   - [x] `npm run electron:dev` 스타트업 로그/스크린샷 문서화 → `docs/widget-migration/runs/2025-09-25-electron-dev.md`
   - [ ] `npm run electron:build` 산출물 smoke test 기록 → **WSL 환경 sandbox 제약으로 실패 (2025-09-25 실행 기록 참고)**
2. 창 옵션 QA (담당 TBD)
   - [ ] Windows: 투명+alwaysOnTop 시 포커스/텍스트 선명도 확인 (스크린샷 포함) – Sprint 3 QA 트랙으로 이동
   - [ ] macOS: frameless+vibrancy 실험 결과 기록, 접근성 권한 안내 캡처 – Sprint 3 QA 트랙으로 이동
3. 로깅 전략 마무리
   - [x] 로그 순환/보존 정책 확정 (1MB 회전 + 7일 보존) – `electron/logger.js` 반영
   - [x] renderer 로그 레벨 가이드 작성 (info/warn/error 기준) – `sprint2-logging-debug.md` 갱신
   - [x] crash/error 업로드 플로우 초안 (Phase 4 연계) – `sprint2-logging-debug.md`에 전략 기재

## 스프린트 종료 메모 (2025-09-25)
- Electron dev run 검증 완료, 런북 `runs/2025-09-25-electron-dev.md` 작성
- 빌드 스모크 테스트 및 창 옵션 QA는 Sprint 3 착수 시 처리 예정
- 로깅 정책·업로드 플로우 정의는 Sprint 3 문서화 트랙으로 편성

## 다음 단계 (Sprint 3 준비)
- Sprint 3 킥오프 시 `npm run electron:build` 스모크 테스트 및 결과 기록
- Windows/macOS QA 담당자 배정 후 체크리스트 초안 작성
- 로깅 정책/renderer 레벨 가이드 초안화 후 리뷰 요청
- 전역 단축키 PoC 범위 확정 및 담당자 배정
