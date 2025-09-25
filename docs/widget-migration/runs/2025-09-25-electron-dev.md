# 2025-09-25 – Electron Dev Run

## 환경 준비
- `libnss3`, `libnspr4` 설치 (Electron chromium 의존성)
- `libasound2t64` 등 나머지 GTK/사운드 라이브러리 설치 (오류 해결)
- Node/Electron 버전: `electron@31.2.0`, Node v22.x (시스템 기본)

## 실행 명령
```bash
npm run electron:dev
```

## 실행 결과
- CRA 개발 서버(`http://localhost:3000`) 정상 부팅
- Electron 셸 자동 기동 및 React 번들 로드 확인 (로딩 스플래시 → 패널 UI 표시)
- 주요 로그: `Main window ready`, `Loading URL http://localhost:3000`

## 비고
- 최초 실행 시 `libnss3.so`, `libasound.so.2` 누락 오류가 발생했으므로 신규 환경에서는 사전 설치 가이드 필요
- 후속 작업: 빌드 스모크 테스트(`npm run electron:build`) 및 창 옵션 QA 계획 수립 예정
