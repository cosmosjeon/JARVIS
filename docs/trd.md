# Technical Requirements Document (TRD) — JARVIS v2.2 (MVP)

## 0. 문서 메타

* 작성일: 2025-09-21
* 대상: MVP (내부 배포 전 단계)
* 근거 문서: **PRD v3.1**(수정본, 로그인/동기화 포함)

---

## 1. Executive Technical Summary

* \*\*핫키 `Ctrl×2`\*\*로 플로팅 에이전트 호출 → **루트 질문 전송 시에만 1회 뷰포트 캡처** → 답변 생성 → 이후는 \*\*컨텍스트 체인(현재→루트 직선 경로)\*\*만으로 트리 확장.
* **로그인 필수(Clerk)**: 최초 실행 시 온보딩 → 로그인(Clerk 프리빌트 UI) → 이후 모든 데이터는 **클라우드와 동기화**(사용자 계정 귀속).
* **로컬 우선 + 경량 동기화**: 로컬 SQLite에 즉시 쓰고, 짧은 주기(이벤트/주기)로 서버와 **양방향 동기화**. 충돌 규칙은 **updated\_at 기준 LWW(Last-Write-Wins)**.

---

## 2. 스코프 & 원칙

### 2.1 In-Scope (MVP)

* `Ctrl×2` 핫키(폴백: `Ctrl+Space`)
* **루트 1회 캡처**, 후속 질문은 캡처 금지
* 컨텍스트 체인(형제/사촌 배제)
* 포커스 트리 뷰(부모/현재/자식, 패닝·줌 없음)
* 라이브러리 앱(전체 트리 캔버스: 패닝·줌 · 폴더/메모)
* **멀티-드래그 + Enter → Placeholder 일괄 생성**(AI 미호출)
* Placeholder 클릭→질문→AI 호출(답변 카드 전환)
* **온보딩 → 로그인(Clerk)** → 세션 유지
* **클라우드 동기화(단일 사용자 계정 귀속, 공유/협업 없음)**
* 자동 저장(즉시 커밋 + **5초 디바운스 스냅샷**), 닫기 시 자동 저장
* 1-스텝 Undo(Ctrl+Z)

### 2.2 Out-of-Scope (MVP 이후)

* 팀 공유/권한, 내보내기/가져오기, 다중 Undo/Redo(≥2), 정밀 앵커 **영역 크롭/OCR**, 인스톨러/자동 업데이트

### 2.3 설계 원칙

* **내장 API 우선**, **로컬 우선**, **Clerk 프리빌트 UI 우선**
* **CRDT/이벤트소싱/복잡 충돌해결** 금지 → **LWW**로 단순화
* 서버는 \*\*단일 REST 두 엔드포인트(pull/push)\*\*로 시작

---

## 3. 시스템 개요

### 3.1 구성(High-Level)

* **Client(Electron)**

  * Main: 창/핫키/캡처/DB/IPC
  * Renderer–Agent: 질문/포커스 뷰/답변
  * Renderer–Library: 사이드바/전체 캔버스
  * Auth: **Clerk JS(프리빌트 `<SignIn/>`)** 전용 AuthWindow
* **Sync API(경량 서버)**

  * Node(Express/Fastify) + PostgreSQL
  * Clerk JWT 검증(백엔드 미들웨어)
  * `POST /sync/pull` · `POST /sync/push`만 제공

### 3.2 윈도우

* **Agent**: 프레임리스, 항상 위, 크기조절, **호버 시 X** 노출, 커서 근처 표시(멀티 모니터 대응)
* **Library**: 기본 앱 창(사이드바 + 전체 캔버스)
* **Auth**: Clerk Sign-In 전용 소형 창(브랜딩 최소 커스텀)

---

## 4. Tech Stack (MVP 최소)

| 층         | 기술                                         | 메모         |
| --------- | ------------------------------------------ | ---------- |
| Desktop   | **Electron**                               | 캡처/핫키/윈도우  |
| Lang/UI   | **TypeScript + React**                     | 컴포넌트·안정성   |
| State     | **Zustand**                                | 경량 전역 상태   |
| Client DB | **SQLite + better-sqlite3**                | 로컬 영구 저장   |
| Canvas    | **React Flow(라이브러리 전용)**                   | 패닝·줌 기본    |
| Hotkey    | **iohook**                                 | 더블-탭 구현 필수 |
| LLM       | **OpenAI SDK(텍스트+비전 1종)**                  | 루트 캡처만 비전  |
| Auth      | **Clerk JS**(클라이언트), **JWT 검증**(서버)        | 프리빌트 UI    |
| Server    | **Node(Express/Fastify) + pg(PostgreSQL)** | REST 2개 끝  |

> 의도적으로 **Prisma/Redux/CRDT/메시지큐** 등 불채택.

---

## 5. 데이터 모델 & 스키마

### 5.1 공통 Node(논리)

* `id: string`
* `keyword: string` — 라벨(멀티-드래그 추출)
* `question: string|null` — Placeholder면 `null`
* `answer: string|null`
* `parentId: string|null`
* `status: 'placeholder'|'asking'|'answered'`
* `orderIndex: number` — 형제 순서
* `createdAt: number`(epoch ms)
* `updatedAt: number`(epoch ms)
* `deletedAt: number|null` — **소프트 삭제**(동기화용)

### 5.2 클라이언트(DB: SQLite)

```sql
CREATE TABLE IF NOT EXISTS trees (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  parent_id TEXT,
  keyword TEXT,
  question TEXT,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'placeholder',
  order_index INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_nodes_tree   ON nodes(tree_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
```

### 5.3 서버(DB: PostgreSQL)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY -- Clerk userId
);

CREATE TABLE trees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  parent_id TEXT,
  keyword TEXT,
  question TEXT,
  answer TEXT,
  status TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT
);

CREATE INDEX idx_nodes_user_tree ON nodes(user_id, tree_id);
```

---

## 6. 인증 & 온보딩 (PRD 6.0 정합)

### 6.1 흐름

1. **최초 실행 → 온보딩 슬라이드**(건너뛰기 허용)
2. **시작하기** → **Clerk `<SignIn/>` 모달/창**
3. 로그인 성공 → **userId 세션 보관** → 라이브러리 진입
4. 플로팅 에이전트는 **세션 없으면 차단**(로그인 유도)

### 6.2 구현

* Renderer에서 Clerk JS 로드, **프리빌트 UI 그대로 사용**
* Main/Server는 **Bearer JWT** 검증(서버 미들웨어)
* 세션 만료 시 Clerk가 UI 재요청 → 앱은 보호 화면 전환

---

## 7. 기능 사양 (핵심 정책 1:1 적용)

### 7.1 핫키 & 창

* 기본: `Ctrl×2`(iohook), 폴백: `Ctrl+Space`(설정)
* 커서 있는 디스플레이 기준으로 Agent 표시/루트 캡처

### 7.2 캡처

* **루트 질문 전송 시 1회만** 뷰포트 캡처(해당 디스플레이)
* 이미지 버퍼는 **요청 직후 파기**(LLM 전송 포함 시 일시 보관)

### 7.3 컨텍스트 체인

* 현재→루트 **직선 경로 Q/A만** 배열로 구성(형제/사촌 배제)
* 슬라이딩 윈도우 **최근 N개(예: 6)** 제한

### 7.4 멀티-드래그 → Placeholder

* 답변 카드에서 다중 선택 → **Enter** → 자식 Placeholder N개 생성
* Placeholder는 `keyword`만, `question=null`, **AI 미호출**

### 7.5 Placeholder 활성화

* 클릭 → 질문 입력 → Enter → LLM 호출 → `answered`로 전환

### 7.6 라이브러리

* 전체 캔버스(React Flow): 패닝/줌, 폴더/메모 관리
* 메모 제목: **루트 질문으로 자동 부여(초기 1회)**, 사용자 수정 가능

### 7.7 자동 저장 & Undo

* 데이터 변경 시 **즉시 커밋** + **5초 스냅샷**
* **1-스텝 Undo**: 마지막 작업(Placeholder 생성/삭제 등)만 롤백

---

## 8. 동기화(Cloud Sync) — **경량 설계**

### 8.1 트리거

* 즉시 트리거: **노드/트리 커밋 직후 1회**
* 배치 트리거: **5초 스냅샷 시점**
* 앱 종료/시작 시 1회, 수동 동기화 버튼(라이브러리 우상단)

### 8.2 엔드포인트

* `POST /sync/pull`

  * req: `{ since: number }`(epoch ms), **Authorization: Bearer <Clerk JWT>**
  * res: `{ trees:[], nodes:[], serverTime:number }`(since 이후 변경분)
* `POST /sync/push`

  * req: `{ trees:[], nodes:[] }`(로컬 변경분)
  * res: `{ ok:true, applied:{trees:n, nodes:n} }`

### 8.3 충돌 규칙

* **LWW(updated\_at)**: 서버/클라 모두 `updated_at` 큰 값 채택
* 삭제 우선: `deleted_at`이 존재하면 해당 레코드로 정착
* 서버는 수신 시 `user_id` = Clerk userId로 강제 귀속

### 8.4 오프라인

* 로그인 세션이 유효하면 **오프라인 작업 가능**(로컬만 저장)
* 네트워크 재개 시 동기화 큐 처리

---

## 9. IPC & API 계약 요약

### 9.1 IPC (Main ↔ Renderer)

* `hotkey.registerDoubleCtrl()`
* `agent.askRoot({ treeId, question })` → `{ node, screenshotUsed:true }`
* `agent.askChild({ treeId, parentId, question })` → `{ node }`
* `agent.createPlaceholders({ treeId, parentId, keywords[] })` → `{ nodes[] }`
* `agent.activatePlaceholder({ nodeId, question })` → `{ node }`
* `sync.push()` / `sync.pull({ since })`
* `auth.require()` — 세션 없으면 Auth 창 호출

### 9.2 Server REST

* `POST /sync/pull` / `POST /sync/push` (본문: 위 8.2)
* 모든 요청 **Clerk JWT 필수**

---

## 10. 저장/복구

* **즉시 저장**: 노드/트리 변경마다 트랜잭션 커밋
* **5초 스냅샷**: 뷰·세션 메타(성능 & 복구)
* **크래시 복구**: 마지막 커밋 + 최근 스냅샷 로드

> **5초 자동 저장 이유**: 자주 변하는 비핵심 상태를 묶어 저장 → I/O 부하 감소 + 동기화 배치 최적화.

---

## 11. 성능 목표

* 핫키 → 창 표시 **≤ 200ms**
* 질문 → 첫 토큰 **≤ 2s**(정상 네트워크)
* 라이브러리 100노드 렌더 **≤ 500ms**
* 앱 구동 **≤ 3s**
* 동기화 100개 변경 전송/적용 **≤ 1.5s**

---

## 12. 보안/프라이버시

* 캡처 이미지는 **요청 처리 직후 즉시 파기**
* 전송은 HTTPS, 서버에서 **JWT 검증** 필수
* API 키/시크릿: `electron-store(암호화)`(개발/테스트 수준), 서버는 환경변수(.env)
* 로깅 최소화(PII 미수집), 에러는 해시된 식별자만

---

## 13. 개발 순서(Roadmap)

**Phase 0 — 데모(2주)**

1. 더블-Ctrl 핫키(+폴백) / Agent 창
2. 루트 질문 → **1회 캡처** → 비전+텍스트 LLM → 답변 카드
3. 컨텍스트 체인/자식 질문 → 저장(로컬)
4. 온보딩/로그인(Clerk 프리빌트) — 세션 게이팅

**Phase 1 — MVP(추가 4주)**
5\) 멀티-드래그→Placeholder(+Enter), 활성화 흐름
6\) 라이브러리(패닝·줌/폴더/메모) + 1-스텝 Undo
7\) **Sync API(서버)** 최소 구현(`pull/push`) + LWW + 삭제 동기화
8\) 자동 저장(즉시+5초), 시작/종료/주기 동기화 트리거

**Phase 2 — 개선(선택)**

* 정밀 앵커 **영역 크롭/OCR**, 다중 Undo/Redo, 내보내기/가져오기, 인스톨러/자동 업데이트

---

## 14. 리스크 & 완화

* **iohook 빌드/권한 이슈** → 폴백 단축키/설정 토글
* **시계 드리프트로 인한 LWW 오류** → `pull` 응답에 `serverTime` 제공, 클라 로그 보정(정보용)
* **JWT 검증 실패/만료** → Clerk UI 재호출, 오프라인 읽기만 허용(쓰기 큐 보류)
* **네트워크 불안** → 로컬 우선·큐잉·재시도 지수 백오프(최대 3회)

---

## 15. 성공 지표

* 로그인 후 첫 질의까지 **≤ 60초**(신규 사용자)
* 핫키 → Agent 표시 **≤ 200ms** 95%
* 루트 첫 토큰 **≤ 2s** 90%
* 동기화 충돌 이슈 **0건(내부 테스트 50회)**
* 크래시 후 데이터 손실 **0건**

---

### 부록 A. 최소 의존성

`electron, react, react-dom, zustand, better-sqlite3, iohook, openai, reactflow, electron-store, express/fastify, pg, jsonwebtoken(검증 헬퍼)`
(Clerk JS/서버 미들웨어는 제공 SDK 사용)

---

**요약**: 본 TRD v2.2는 수정된 PRD의 **로그인 필수·Clerk 인증·클라우드 동기화** 요구를 **최소 복잡도로** 흡수했습니다. 로컬-우선 아키텍처를 유지하며, **REST 2개 엔드포인트 + LWW**만으로 안정적인 1인 사용자 동기화를 달성합니다.
