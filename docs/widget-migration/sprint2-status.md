# Sprint 2 진행 현황 (2025-10-xx)

## 완료된 항목
- Electron 셸 초기화 및 보안 옵션 적용 (`electron/main.js`, `electron/preload.js`)
- 프레임리스/투명/alwaysOnTop/skipTaskbar 토글 훅과 IPC (`window:updateConfig`)
- `jarvisAPI.log` → main logger 브리지 (`electron/logger.js`)
- IPC 계약 초안 문서 (`sprint2-ipc-contract.md`)
- 실행 가이드 및 로깅/디버깅 문서 초안 작성

## 남은 TODO
1. 실제 실행 검증 (담당 TBD)
   - [ ] `npm run electron:dev` 스타트업 로그/스크린샷 문서화 → `docs/widget-migration/runs/` 폴더 예정
   - [ ] `npm run electron:build` 산출물 smoke test 기록 → 빌드 ID, OS별 실행 결과
2. 창 옵션 QA (담당 TBD)
   - [ ] Windows: 투명+alwaysOnTop 시 포커스/텍스트 선명도 확인 (스크린샷 포함)
   - [ ] macOS: frameless+vibrancy 실험 결과 기록, 접근성 권한 안내 캡처
3. 로깅 전략 마무리
   - [ ] 로그 순환/보존 정책 확정 (현재 512KB 회전 스텁 → 목표 7일 보존?)
   - [ ] renderer 로그 레벨 가이드 작성 (info/warn/error 기준)
   - [ ] crash/error 업로드 플로우 초안 (Phase 4 연계)

## 다음 단계
- 위 TODO 완료 후 스프린트 2 종료 선언
- 스프린트 3 (단축키 + 클립보드 MVP) 진입 전, 전역 단축키 PoC 범위 확정 및 담당자 배정 필요
