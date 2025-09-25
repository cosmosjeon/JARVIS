# Sprint 5 – 출시 준비 & QA 마무리 (2025-10-??)

## 목표
- Electron 위젯을 배포 가능한 수준으로 검증하고, 필수 QA/로그 정책을 완료한다.
- 접근성·오류 복구·단축키 설정 등 핵심 UX 흐름을 다듬고 문서를 최신 상태로 맞춘다.
- CI에서 재현 가능한 빌드/스모크 파이프라인을 구성해 다음 단계(베타 릴리스) 준비를 마친다.

## 범위 요약
1. **빌드 & 스모크 자동화**
   - `npm run electron:build` 산출물에 대한 OS별 스모크 테스트 기록 (`docs/widget-migration/runs/` 갱신)
   - Node 기반 Electron 스모크 스크립트(`scripts/smoke/run-electron-smoke.js`) 작성 및 `electron:smoke` npm 스크립트 추가
   - CI에서 사용할 `xvfb-run` 가이드와 결과 캡처 문서화
2. **QA / 접근성 / 핫키 마감**
   - Windows 투명+alwaysOnTop, macOS frameless+vibrancy QA 기록 업데이트 (`sprint2-electron-shell.md`)
   - 접근성 권한 모달/배너 실제 코드 연결 (`AccessibilityPermissionBanner`, `jarvisAPI.checkAccessibilityPermission`)
   - 핫키 설정 UI glass 스타일 마감 및 단축키 레코더 UX 검수
3. **오류 복구 & 로그 정책 완성**
   - 자동 재시도 간격/횟수 정책 정의 및 구현 (`sprint4-error-recovery.md` 참고)
   - renderer 로그 레벨 가이드, crash/error 업로드 전략, dev run 로그 캡처 문서화
4. **문서 & 운영 준비**
   - Sprint 1~4 미해결 TODO를 정리하고 스프린트별 상태 문서 업데이트
   - 릴리스 체크리스트(설정 백업, 로그 보존, 접근성 안내 등) 초안화

## 작업 항목 (WIP)
- [x] `scripts/smoke/run-electron-smoke.js` 작성 + `package.json`에 `electron:smoke`
- [x] `npm run electron:smoke` 실행 로그 확보 (WSL2 sandbox 제약으로 실패, 별도 환경 필요)
- [x] `docs/widget-migration/runs/`에 `electron:build` 스모크 결과(빌드 ID, OS별 실행 기록) 추가
- [ ] Windows: 투명+alwaysOnTop QA 기록, macOS vibrancy 실험 결과 캡처 (`sprint2-electron-shell.md`)
- [x] 접근성 권한 helper/배너 UI 실제 연결 (`src/components/AccessibilityPermissionBanner`, preload 브리지 확인)
- [x] 자동 재시도 정책 구현 및 문서화 (`sprint4-error-recovery.md`)
- [x] renderer 로그 레벨 가이드 & crash 업로드 전략 문서화 (`sprint2-logging-debug.md`)
- [x] 단축키 설정 패널 glass 스타일 마감 (`sprint3-hotkey-settings.md`)
- [x] 스프린트별 상태 문서(Sprint 1~4) 최신화 + Sprint 5 종료 보고 초안 작성 (`sprint5-status.md`)

## 완료 조건
- 스모크 스크립트가 CI에서 5분 이내 통과하고 실패 시 로그 첨부
- 주요 UX 시나리오 더블 Ctrl → 접근성 권한 안내 → 오류 재시도 → 로그 내보내기가 테스트 노트와 함께 문서화
- 로그 보존 정책(1MB 회전/7일 삭제) + renderer 레벨 가이드 + crash 업로드 전략이 정식 문서로 합의
- Sprint 5 회고에서 남은 위험 요소(네이티브 모듈 배포, 서명/노터라이즈 등) 목록화

## 참고
- 기존 TODO 트래킹: `sprint2-status.md`, `sprint2-logging-debug.md`, `sprint3-hotkey-settings.md`, `sprint3-clipboard-permissions.md`, `sprint4-error-recovery.md`
- 전역 단축키 글로벌 훅: `electron/hotkeys/windows.js`
- 로그 회전/보존 로직: `electron/logger.js`
