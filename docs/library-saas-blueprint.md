# 라이브러리 SaaS 전환 청사진

## 1. 현재 구조 요약
- **클라이언트**: CRA 기반 React 앱, `features/` 도메인별 구조, 상태 관리 훅(`useLibraryState`, `useLibraryHandlers`) 중심.
- **데이터 계층**: Supabase `trees`, `nodes`, `folders`, `memos`, `tree_viewport_states` 테이블을 직접 호출하는 레포지토리(`infrastructure/supabase/repositories`).
- **인증/세션**: `shared/hooks/useSupabaseAuth`에서 Supabase OAuth를 감싸고 Electron 브리지와 연동.
- **실행 모드**: `App.js`에서 `mode=library|widget|admin-panel|capture-overlay` 분기. SaaS 전환 시 `library` 모드가 웹 기본 진입점이 됨.

## 2. SaaS 제품 목표 정의
- 브라우저 기반 접근(Desktop Electron 의존도 제거), 사용자별 조직(organization)·공유·협업을 지원하는 다중 테넌트 서비스.
- 권한/역할, 데이터 격리, 결제/요금제, 운영 모니터링을 고려한 상용 서비스 수준 품질.

## 3. 아키텍처 개편 개요
### 3.1 멀티테넌시 모델
- `organizations`(조직), `user_organizations`(맵핑), `organization_invitations` 테이블 추가.
- 기존 `trees`, `folders`, `nodes`, `memos`에 `organization_id` FK 추가, `user_id` 기반 RLS를 조직 기반으로 교체.
- Supabase RLS: `auth.jwt() ->> 'org_id'` 클레임 기반 정책. 초기에는 사용자 메타데이터에 기본 조직 ID 저장.

### 3.2 인증 및 온보딩
- 기본: 이메일/소셜 OAuth → 조직 생성/초대 플로우 추가.
- 엔터프라이즈: Supabase SSO(SAML) 멀티 프로바이더 구성([Supabase Multi-tenant SSO 가이드](https://supabase.com/docs/guides/auth/enterprise-sso)) 참고, `sso_provider_id`를 조직과 매핑.
- 토큰 클레임 확장: 로그인 시 Edge Function 혹은 Postgres 트리거로 `jwt`에 `org_id`, `roles` 주입.

### 3.3 백엔드 계층
- **옵션 A**: Supabase RPC/Edge Function으로 도메인 로직 래핑 (간단, Supabase 에코시스템 활용).
- **옵션 B**: 별도 BFF(Node/Next.js API) 추가 → React 앱은 BFF를 통해 Supabase 접근. 복잡하지만 감사/캐싱/레이트리밋 용이.
- 초기 릴리스는 옵션 A로 시작 후 요구에 따라 B로 확장.

### 3.4 프론트엔드 구조
- 전역 상태에 `activeOrganization`, `roles`, `entitlements` 추가.
- `LibraryApp` 뷰 모델에서 조직 전환, 공유된 트리 목록, 역할별 UI 통제 포함.
- Electron 커스텀 브릿지 제거, 웹 우선 UX로 전환. 데스크톱 필요 시 추후 래퍼 제공.

## 4. 단계별 전환 로드맵
1. **준비 단계**: 환경 분리(`.env` 웹 전용), 모드 기본값을 `library`로 설정, Electron 의존 로직 가드.
2. **데이터 계층 확장**: 조직 테이블/컬럼 추가, 마이그레이션 작성, 샘플 데이터 마이그레이션 스크립트.
3. **RLS 및 인증 확장**: 조직 기반 정책, Edge Function으로 JWT 클레임 주입, 초대/가입 플로우 구현.
4. **프론트 리팩터링**: 조직 스위처 UI, 라이브러리 API 호출 파라미터에 `organization_id` 적용, 상태/훅 개선.
5. **운영 기능**: 결제(Stripe Billing) 통합, 감사 로깅, 에러 모니터링(Sentry), 피쳐 플래그 도입.
6. **배포 및 인프라**: 프런트(예: Vercel), Edge Functions(예: Supabase Functions), 이미지/파일은 Supabase Storage.
7. **테넌트 온보딩**: 문서, 관리자 콘솔(조직/사용자 관리), SLA/백업 전략 수립.

## 5. 데이터 모델 세부 설계
| 테이블 | 주요 컬럼 | 설명 |
| --- | --- | --- |
| organizations | id(uuid), name, plan, created_at, owner_id | 테넌트 메타데이터 |
| user_organizations | user_id, organization_id, role(enum) | 사용자-조직 매핑, 역할 기반 권한 |
| trees/folders/nodes/memos | organization_id FK 추가 | 조직 기준 데이터 격리 |
| organization_settings | org_id, key, value | 플랜별 설정/제한치 저장 |

- 마이그레이션 시 기존 데이터는 사용자의 기본 조직 생성 후 모두 해당 조직으로 마이그레이션.
- RLS 예시: `using (organization_id = auth.jwt() ->> 'org_id')`.

## 6. 인증/권한 플로우
1. 사용자 가입 → 기본 조직 생성 또는 초대 수락.
2. `user_organizations` 기준으로 활성 조직 설정, JWT에 `org_id`, `roles` 삽입.
3. 프런트 `SupabaseProvider`에서 세션 로드시 조직 메타데이터 로드 후 컨텍스트에 저장.
4. 엔터프라이즈 고객은 SAML SSO 설정 후 `sso_provider_id` 기준 조직 매핑.

## 7. 프론트엔드 구현 가이드
- `useLibraryAppViewModel`에 `organization` 상태 주입, `libraryRepository` 호출 시 `organization_id` 전달.
- `LibrarySidebar`에 조직 전환 드롭다운, 권한 없는 메뉴는 비활성화.
- 새로 추가되는 API 호출은 공통 `fetchWithOrg` 래퍼를 통해 org 스코프 적용.
- 테스트: `@testing-library/react` 기반으로 조직 전환, 권한 별 UI 가시성 테스트 추가.

## 8. 결제 및 계정 관리
- Stripe Billing: 제품/요금제 정의 → `organization_subscriptions` 테이블과 Webhook Edge Function으로 상태 동기화.
- 사용량 측정: Supabase `usage` 테이블 또는 Edge Functions 로깅으로 일별 active user/트리 카운트 저장.
- 플랜 제한: API 호출 전 `organization_settings` 검증.

## 9. 배포 및 운영 전략
- **환경**: 개발(로컬 Supabase CLI), 스테이징, 프로덕션 분리. 웹 배포는 Vercel/Netlify, Edge Functions는 Supabase.
- **관측성**: Sentry/Logflare, Supabase Audit Logs 활용. 조직 ID 포함 로그 표준화.
- **백업**: Supabase PITR 활성화, 주기적 스냅샷 및 스토리지 백업.
- **성능**: `trees/nodes` 쿼리에는 `organization_id` + `updated_at` 인덱스 추가.

## 10. 위험 요소 및 대응
- **데이터 마이그레이션 리스크**: 무중단 이전을 위해 `organization_id` nullable 추가 → 백필 → not null 제약 순서로 진행.
- **클라이언트 분기 복잡도**: `mode` 파라미터 사용처 점검 후 웹 전용 라우터 도입.
- **SSO 메타데이터**: 조직별 Provider 관리 자동화 필요 → 관리용 UI/CLI 준비.
- **보안**: RLS 적용 후 모든 테이블에 `anon` 권한 제거, Edge Function 인증 헤더 검증.

## 11. 체크리스트
- [ ] 조직/역할 모델 마이그레이션 완료 및 백필 검증
- [ ] Supabase RLS/정책 테스트 자동화
- [ ] 프론트 조직 스위처 및 권한 제어 UI 배포
- [ ] Stripe/Webhook 연동 및 E2E 과금 시뮬레이션
- [ ] 모니터링/로깅/알림 채널 구성
- [ ] 고객 온보딩/지원 프로세스 문서화

---
이 로드맵을 기준으로 각 단계별 구현 이슈를 생성하고, 완료 시 체크리스트를 갱신하면 SaaS 전환 진행 상황을 추적할 수 있습니다.
