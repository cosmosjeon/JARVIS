# 2025-09-25 – Electron 빌드 & 스모크 (Linux WSL)

## 빌드
- 명령: `npm run electron:build`
- 결과: **성공**
  - React 프로덕션 빌드 완료
  - `electron-builder`가 `dist/linux-unpacked/`, `.AppImage`, `.snap` 산출물 생성
  - 로그 요약:
    - `packaging platform=linux arch=x64 electron=31.7.7`
    - `building target=snap` / `target=AppImage`
    - 경고: 아이콘/카테고리 기본값 사용 (향후 업데이트 필요)

## 스모크 테스트
- 명령: `npm run electron:smoke`
- 목적: 언팩 바이너리(`dist/linux-unpacked/hierarchical-force-tree-react`) 기동 후 `Main window ready` 로그 감지
- 실행 환경: WSL2 (Linux 6.6.87.2), headless, sandbox 제한 적용
- 결과: **실패**
  - 오류: `[FATAL:sandbox_host_linux.cc(41)] Check failed: . shutdown: Operation not permitted (1)`
  - 조치: `--no-sandbox`, `--disable-setuid-sandbox`, `--no-zygote`, `ELECTRON_DISABLE_SANDBOX=1` 등 플래그 추가 후 재시도했으나 동일 오류 → CI/WSL의 seccomp 제약으로 추정
  - 다음 단계 제안: CI에서는 `xvfb-run` + `sysctl kernel.unprivileged_userns_clone=1`가 허용되는 환경에서 재시도하거나, smoke 스크립트에 “sandbox unavailable” 경로를 추가해 Dev 환경에서는 `npm run electron:dev` 기반으로 대체 검증

## 산출물
- 언팩 경로: `dist/linux-unpacked/`
- 배포 이미지: `dist/hierarchical-force-tree-react-1.0.0.AppImage`, `dist/hierarchical-force-tree-react_1.0.0_amd64.snap`

## 메모
- 패키지 아이콘/카테고리 설정 필요 (`build` 필드 업데이트)
- WSL2에서 Electron 패키지 실행 시 sandbox 관련 추가 설정이 요구됨 → Sprint 5 QA 트랙에서 환경별 가이드 문서화 필요
