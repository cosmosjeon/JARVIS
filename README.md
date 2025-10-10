# JARVIS Renderer

Electron 기반 지식 트리·라이브러리를 렌더링하는 React 애플리케이션입니다. Stage 6 리팩터링을 통해 feature-first 구조, shared/infrastructure 계층 분리, Electron 브리지 캡슐화를 완료했습니다.

## ✨ 주요 기능

- **트리 위젯** (`features/tree`)
  - Force/Tidy 레이아웃 구성, 노드 편집·드래그, 대화 이력 확인
  - Supabase 동기화 및 Electron 위젯 브리지 연동
- **라이브러리 모드** (`features/library`)
  - 저장된 트리/폴더 관리, Q/A 대화 재활용, Voran Box 드래그 관리
- **Electron 브리지** (`infrastructure/electron/bridges`)
  - preload 채널을 JSDoc-타입 어댑터로 노출 (`libraryBridge`, `settingsBridge`, ...)
- **OpenAI 연동** (`infrastructure/ai/agentClient.js`)
  - 브리지 경유 호출 + HTTP fallback(Supabase/환경변수 기반)
- **Shared Design System** (`shared/ui`, `shared/components/**`)
  - shadcn 기반 UI 프리미티브와 공용 컴포넌트 (`markdown/MarkdownMessage` 등)

## 🚀 개발 시작

```bash
npm install
npm run electron:dev
```

필수 환경 변수는 `.env`에 정의합니다.

```
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
# 선택: Electron 없이 OpenAI fallback을 사용하려면 아래 키 지정
REACT_APP_OPENAI_API_KEY=...
```

## 📁 Stage 6 이후 디렉터리 스냅샷

```
src/
├─ App.js
├─ features/
│  ├─ tree/
│  │  ├─ ui/
│  │  ├─ state/
│  │  ├─ services/
│  │  └─ utils/
│  └─ library/
│     ├─ ui/
│     ├─ state/
│     └─ services/
├─ infrastructure/
│  ├─ electron/
│  │  └─ bridges/
│  ├─ supabase/
│  │  └─ repositories/
│  └─ ai/
│     └─ agentClient.js
├─ shared/
│  ├─ components/
│  │  └─ markdown/
│  ├─ hooks/
│  ├─ ui/
│  └─ utils/
└─ domain/
   └─ library/
```

자세한 구조 및 리팩터 진행 상황은 다음 문서를 참고하세요.

- `docs/architecture.md` – 계층 책임, Stage 6 스냅샷
- `docs/render-refactor-plan.md` – 단계별 체크리스트
- `docs/render-refactor-status.md` – 최신 진행 상황 및 사용자 점검 가이드

## 🛠️ 유용한 스크립트

- `npm run electron:dev` – Electron + React 개발 서버 실행
- `npm run build` – 생산용 번들 생성
- `npm run lint` – ESLint 검사(구성된 경우)
- `npm run test` – 단위 테스트 실행(구성된 경우)

## ✅ 수동 점검 루프

Stage 6 리팩터 이후 각 기능 변경 시 다음 절차를 따릅니다.

1. `npm run electron:dev`로 앱 실행
2. `docs/render-refactor-status.md`에 정의된 사용자 점검 가이드를 따라 UI 플로우 검증
3. 결과/이슈를 문서화한 뒤 다음 작업으로 이동

---

Stage 7에서는 초대형 컴포넌트(`HierarchicalForceTree`, `LibraryApp`, `VoranBoxManager`)를 커스텀 훅/서비스로 세분화하고 도메인 계층 승격을 진행할 예정입니다.
