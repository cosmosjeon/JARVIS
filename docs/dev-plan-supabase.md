# JARVIS Supabase 통합 개발 계획 (v1.0)

## 1. 목표 및 범위
- Supabase Auth를 사용해 Google / Kakao 소셜 로그인을 제공하고 Electron 클라이언트 전 구간에서 세션을 일관되게 활용한다.
- 위젯에서 생성되는 질문·답변 트리를 동기화하기 위한 `trees`, `nodes` 스키마를 Supabase(PostgreSQL)에 구현한다.
- Supabase 중심 인증·백엔드를 설계하면서 로컬 우선 구조, LWW 동기화 규칙, 2개 엔드포인트(`pull`, `push`) 전략을 유지한다.
- 범위 밖: 멀티 테넌시, 협업 기능, Supabase Storage/Realtime 연동, MFA.

## 2. 주요 변경 사항 요약
- 인증: Supabase Auth(`@supabase/supabase-js`)를 사용해 온보딩 이후 세션 게이트를 구성한다.
- OAuth: Google, Kakao 제공. Kakao는 Supabase의 "Custom OAuth" 프로바이더 설정과 Edge Function 리디렉션 처리 필요.
- 백엔드: Node Sync API는 Supabase Edge Function 또는 Postgres RPC로 대체. 서비스 키 기반 호출로 LWW 로직 수행.
- DB: `users` 테이블은 `auth.users` 뷰로 대체. `trees`, `nodes` 테이블은 Supabase public 스키마에 생성하고 RLS로 보호.
- 환경 변수: Electron/Edge Function 모두 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, OAuth 리디렉트 URI 등을 사용.

## 3. 시스템 아키텍처 개요

### 3.1 사용자 로그인·회원가입 플로우
1. 사용자가 JARVIS 데스크톱 앱을 설치한 뒤 처음 실행하면 Main 프로세스가 Supabase 초기화와 로컬 세션 조회를 수행한다.
2. 세션이 없거나 만료된 상태이면 온보딩 슬라이드가 표시되고, 마지막 화면의 `시작하기` 버튼을 누르면 로그인/회원가입 창(WebView)이 열린다.
3. 로그인 창에는 Supabase OAuth 버튼(Google, Kakao)이 노출되며, 사용자가 선택하면 `supabase.auth.signInWithOAuth`를 호출하고 `redirectTo`는 Electron 딥링크(`jarvis://auth-callback`)로 설정한다.
4. OAuth 동의가 완료되면 Supabase가 콜백 URL로 코드를 전달하고 앱은 딥링크를 수신해 `auth.exchangeCodeForSession`으로 액세스/리프레시 토큰을 확보한다.
5. 획득한 세션은 Main 프로세스의 암호화 스토어에 저장되고 IPC를 통해 Renderer에도 공유되어 `supabase.auth.setSession`으로 즉시 반영된다.
6. 세션 준비가 끝나면 온보딩/로그인 창을 닫고 라이브러리 앱 홈으로 진입한다. 홈에는 `위젯 열기` 버튼이 있고, 사용자가 누르면 플로팅 위젯 창이 활성화된다.
7. 위젯과 라이브러리는 동일한 Supabase 세션을 사용하며, 위젯에서 생성한 질문·답변·노드 트리는 Supabase DB에 사용자 ID 기준으로 저장된다. 각 트리는 라이브러리 목록에서 루트 노드 제목으로 정리되고, 라이브러리에서 열면 위젯과 동일한 트리 UI로 이어서 질문을 확장할 수 있다.

- 클라이언트(Electron)
  - Main: 핫키, 캡처, 로컬 SQLite(오프라인), Supabase auth 세션 관리(IPC 공유).
  - Renderer-Agent/Library: Supabase Auth UI, 트리 편집, 동기화 큐.
- Supabase
  - Auth: Google, Kakao OAuth. Kakao는 Redirect Handler(Edge Function)로 토큰 교환.
  - Database: `trees`, `nodes` 테이블 + RLS 정책. 아직 미지원 기능은 Edge Function에서 서비스 키로 처리.
  - Edge Functions(선택): `sync_pull`, `sync_push`, `auth-exchange` 등 비즈니스 로직 캡슐화.

## 4. Supabase 프로젝트 준비
### 4.1 프로젝트 생성 & 기본 설정
1. Supabase 대시보드에서 신규 프로젝트 생성 → 조직/지역 선택.
2. 프로젝트 생성 후 `Project Settings → API`에서 `Project URL`, `anon key`, `service_role key` 확보.
3. `App Settings → URL Configuration`에 Electron 딥링크(예: `jarvis://auth-callback`)와 데스크톱 개발용 `http://localhost:3000/auth/callback` 등록.
4. `Authentication → Settings → Redirect URLs`에 위 콜백 URI를 모두 추가.

### 4.2 OAuth Provider 설정
#### Google
1. Google Cloud Console에서 OAuth 클라이언트 생성(Desktop 앱 유형).
2. 승인된 리디렉션 URI에 Supabase에서 제시하는 `https://<project>.supabase.co/auth/v1/callback` 추가.
3. Supabase Dashboard → Authentication → Providers → Google 활성화, Client ID/Secret 등록.

#### Kakao
1. Kakao Developers 콘솔에서 웹 플랫폼 앱 생성.
2. Redirect URI: Supabase에서 제공하는 `https://<project>.supabase.co/auth/v1/callback` 및 Electron 딥링크 중계용 Edge Function URI 등록.
3. Supabase Dashboard → Authentication → Providers → "Add new → Custom" 선택 후 다음 정보 입력:
   - Provider name: `kakao`
   - Authorization URL, Token URL, UserInfo URL: Kakao OAuth 문서 값 사용.
   - Client ID/Secret, Scope(`profile_nickname`, `account_email`).
4. Edge Function 또는 Custom URL Scheme로 Supabase의 `auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo }})` 호출 후 desktop 콜백 처리.

### 4.3 보안 설정
- `Authentication → Settings`에서 `Refresh Token Rotation` 활성화, 토큰 만료 시간 검토.
- 이메일 확인 미사용 시 `Disable email confirmations` 체크.
- Edge Function에서 `service_role key` 사용 시 반드시 헤더 검증(`Authorization: Bearer <service_key>`) 수행.

## 5. 데이터베이스 설계 및 마이그레이션
### 5.1 스키마 매핑
- `auth.users`가 사용자 ID 소스로 동기화 데이터를 구분한다. 별도 `users` 테이블은 생략하고 필요한 프로필 메타는 `profiles` 보조 테이블로 확장 가능.
- `trees.user_id`, `nodes.user_id`는 `uuid` 타입으로 `auth.users(id)`를 참조.
- 각 트리는 위젯에서 생성된 루트 노드 제목을 `trees.title`로 저장하고, 라이브러리 앱은 동일한 제목으로 목록에 노출한다. 라이브러리에서 트리를 열면 위젯과 동일한 노드 트리 UI가 로드되어 이어서 질문을 추가할 수 있다.
- 시간 필드는 `BIGINT`(epoch ms) 유지하여 LWW 규칙과 로컬 SQLite 호환.

### 5.2 DDL (Supabase SQL Editor 또는 migration)
```sql
create table if not exists public.trees (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create table if not exists public.nodes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id text not null references public.trees(id) on delete cascade,
  parent_id text,
  keyword text,
  question text,
  answer text,
  status text not null check (status in ('placeholder','asking','answered','draft')),
  order_index integer default 0,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists nodes_user_tree_idx on public.nodes(user_id, tree_id);
create index if not exists nodes_parent_idx on public.nodes(parent_id);
```

### 5.3 RLS 정책
```sql
alter table public.trees enable row level security;
alter table public.nodes enable row level security;

create policy "Trees are owner readable" on public.trees
  for select using (auth.uid() = user_id);
create policy "Trees are owner writable" on public.trees
  for insert with check (auth.uid() = user_id)
  using (auth.uid() = user_id);
create policy "Trees owner update" on public.trees
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Nodes are owner readable" on public.nodes
  for select using (auth.uid() = user_id);
create policy "Nodes are owner writable" on public.nodes
  for insert with check (auth.uid() = user_id)
  using (auth.uid() = user_id);
create policy "Nodes owner update" on public.nodes
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
- `deleted_at` 처리를 위해 soft delete 시에도 UPDATE 정책이 적용되도록 `delete` 대신 UPDATE로 마킹.
- 필요 시 `auth.role() = 'service_role'` 조건을 추가해 Edge Function이 전체 레코드에 접근하도록 별도 정책 작성.

### 5.4 마이그레이션 운영 절차
1. 로컬 SQL 작성 → `supabase db remote commit` 또는 SQL Editor 적용.
2. `supabase/functions` 디렉터리에 Edge Function 추가 시 `supabase deploy` 사용.
3. 마이그레이션 버전 관리 필요 시 `supabase migration new create_trees_nodes` 명령으로 스크립트 생성.

## 6. 동기화 API 전략
- 기존 `POST /sync/pull`, `POST /sync/push` 계약 유지.
- 구현 대안
  1. **Edge Function**: `sync_pull`/`sync_push` 작성. Supabase JS(service role)로 DB 액세스, LWW 로직 처리.
  2. **Postgres RPC**: `pull_changes(since)` 함수와 `upsert_changes(json)` 함수 작성 후 PostgREST 사용. (Edge Function보다 빠르지만 로직 복잡도↑)
- 권장: Phase 1에서 Edge Function으로 빠르게 이행 후 필요 시 RPC로 이전.

### 6.1 sync_pull(Edge Function)
- 입력: `{ since: number }` (ms)
- 출력: `{ trees: Tree[], nodes: Node[], serverTime: number }`
- 로직: `since`가 0이면 전체, 아니면 `updated_at > since OR deleted_at > since` 조건으로 조회.
- 인증: `verifyJwt(req)` → `auth.getUser()`로 user_id 추출.

### 6.2 sync_push(Edge Function)
- 입력: `{ trees: Tree[], nodes: Node[] }`
- 로직: 각 레코드에 대해 `user_id = auth.uid()` 강제, `updated_at` 비교로 LWW 처리. Postgres `INSERT ... ON CONFLICT DO UPDATE` + `WHERE excluded.updated_at >= nodes.updated_at` 조건 사용.
- 출력: `{ ok: true, applied: { trees: number, nodes: number } }`
- 오류 처리: 유효성 검사(상태 enum, parent 존재 여부 등) 후 400 응답.

### 6.3 호출 경로
- Electron Renderer → IPC → Main → Supabase `functions.invoke('sync_pull')` / `sync_push` 호출 (anon key 사용).
- 오프라인 시 로컬 큐에 저장 → 재연결 시 일괄 호출.

## 7. Electron 앱 수정 계획
1. **의존성 정리**: `@supabase/supabase-js` 추가 및 기존 인증 모듈 정리.
2. **세션 게이트**
   - Main 프로세스에서 Supabase Auth 클라이언트 생성.
   - IPC 채널 `auth.require` → 세션 유무 확인, 없으면 Auth 창 띄움.
3. **Auth UI**
   - 온보딩 후 커스텀 로그인 창 구현: Supabase Auth UI(프레임리스 WebView) 혹은 직접 버튼 구성.
   - `signInWithOAuth({ provider: 'google' | 'kakao', options: { redirectTo }})` 호출 → 딥링크/중계.
4. **딥링크 처리**
   - macOS: `app.setAsDefaultProtocolClient('jarvis')`; Windows: `registry` 등록.
   - 콜백 URI 수신 시 Supabase `auth.exchangeCodeForSession` 호출 후 세션 저장.
5. **세션 공유**
   - 세션 정보(`access_token`, `refresh_token`, `expires_at`)는 `electron-store`(암호화) 사용.
   - Renderer는 IPC `auth.getSession`으로 토큰 획득, `supabase.auth.setSession` 호출.
6. **동기화 계층 업데이트**
   - `Authorization: Bearer <access_token>` 헤더로 Edge Function 호출.
   - 토큰 만료 시 `auth.refreshSession` 호출 후 재시도.
7. **로깅 & 에러 처리**
   - Edge Function 오류 메시지를 IPC로 전달하여 사용자에게 표시.
   - Kakao OAuth 실패 대비 재시도 버튼 제공.

## 8. 인프라 & 배포
- Supabase Edge Function 로컬 개발: `supabase functions serve sync_pull --env-file supabase/.env`.
- 프로덕션 배포: `supabase functions deploy sync_pull` 등.
- 환경 구성 공유: `.env.development`, `.env.production`에 Supabase 키/리디렉트 URI 관리. Git에 커밋 금지.
- 모니터링: Supabase Logs → Edge Functions + Auth. 이상 징후 슬랙 알림 연동 고려.

## 9. 테스트 전략
- **단위 테스트**: Edge Function LWW 로직(노드 덮어쓰기, soft delete 등)을 Vitest/Jest로 커버.
- **통합 테스트**: Supabase 테스트 프로젝트에서 실제 OAuth 플로우 검증(특히 Kakao).
- **클라이언트 테스트**: 오프라인→온라인 시나리오, 동시 편집(두 기기) LWW 충돌, 토큰 만료 재로그인.
- **QA 체크리스트**: 로그인 시 60초 내 첫 질의, 동기화 후 라이브러리 앱 반영, Placeholder 흐름.

## 10. 일정 제안 (3단계)
1. **Phase A (1주)**: Supabase 프로젝트 셋업, OAuth(Google/Kakao) 검증, 기본 DB 마이그레이션.
2. **Phase B (2주)**: Edge Function `sync_pull/push` 개발, RLS 정책 완성, Electron Auth 창/세션 연동.
3. **Phase C (1주)**: 전체 통합 테스트, 오프라인 큐/재시도, 문서화 및 배포 자동화.

## 11. 리스크 & 대응
- Kakao OAuth 정책 변경 → Edge Function에 로그 남기고, 만료 토큰 리프레시 전략 마련.
- Electron 딥링크 실패(Windows 관리자 권한 이슈) → 폴백으로 임시 로컬 HTTP 서버 리디렉트 제공.
- RLS 오구성으로 동기화 실패 → 테스트 프로젝트에서 정책 검증, 서비스 키 전용 정책 별도 분리.
- Supabase 요금제 제한(QPS) → 초기엔 Free Tier 범위. 동기화 주기 최적화 및 배치 처리 유지.

## 12. 산출물
- Supabase SQL 마이그레이션(`supabase/migrations/...`)
- Edge Functions 코드(`supabase/functions/sync_pull/index.ts`, `sync_push/index.ts`, `auth-exchange/index.ts`)
- Electron Auth 모듈(`src/main/auth/supabase.ts`, `src/renderer/auth/LoginWindow.tsx`)
- 운영 문서: 환경 변수 표, Kakao/Google 콘솔 설정값, 테스트 케이스 결과.

## 13. 실행 가이드
1. Supabase SQL Editor에서 5.2절의 DDL과 5.3절의 RLS 정책을 순서대로 실행한다. `trees.id`, `nodes.id`는 문자열(text) 타입으로 생성한다.
2. Supabase Authentication → Settings → Redirect URLs에 `jarvis://auth-callback`, `http://localhost:3000`, `http://localhost:3000/auth/callback`, `http://127.0.0.1:54545/auth/callback` 네 항목을 모두 추가한다.
3. 루트에 `.env.local`을 만들고 다음 값을 저장한다.
   ```
   REACT_APP_SUPABASE_URL=https://gkdiarpitajgbfpvkazc.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZGlhcnBpdGFqZ2JmcHZrYXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MDAxMjUsImV4cCI6MjA3NDQ3NjEyNX0.enWOIuHmOo4exIs2Uk2F3iDnEF92ligVkx_gARoIRsQ
   ```
   Electron 환경에서도 동일 키를 참조하도록 `process.env.NEXT_PUBLIC_*`를 fallback으로 지원한다.
4. `npm install` 실행 후 `npm run electron:dev`로 렌더러와 위젯을 동시에 띄운다. 최초 구동 시 로그인 화면이 뜨며 Google/Kakao 버튼 중 하나로 로그인한다.
5. 라이브러리 앱에서 위젯 열기 버튼을 누르면 선택된 트리가 `jarvis.activeTreeId` 로컬 스토리지 키에 기록되고 위젯에서 동일 트리를 로드한다.
6. Supabase 콘솔에서 데이터가 저장되는지 확인하고 필요 시 테스트 프로젝트에서 Kakao/Google OAuth 승인 절차를 검증한다.
