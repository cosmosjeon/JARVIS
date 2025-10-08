# JARVIS 라이브러리 SaaS 전환 개발 계획

## 1. 비전과 범위
- **제품 비전**: 노션과 유사한 UX를 갖춘 지식 관리 플랫폼을 웹(SaaS)과 데스크톱(Electron)에서 동일한 품질로 제공하면서, 조직 단위 협업·보안·과금을 지원한다.
- **범위**: 멀티테넌시 데이터 모델, 조직 기반 권한, 공용 코드 아키텍처, 결제/운영 체계, 테스트/배포 자동화를 포함한다.
- **제약 조건**:
  - Supabase Auth/DB/Storage를 주 백엔드로 유지하며 RLS 기반 격리를 준수한다.
  - 기존 Electron 기능(클립보드 캡처, 트레이 등)은 플랫폼 전용 계층으로 캡슐화한다.
  - Clean Code/vooster 가이드에 맞춘 리팩터링과 테스트 커버리지(>80%) 확보가 필수다.

## 2. 아키텍처 원칙
1. **단일 코드베이스 다중 플랫폼**: `apps/{web,electron}`과 `packages/{core,ui,data}` 형태로 공용 로직을 재사용하고, Electron 전용 브리지(Electron IPC 등)는 어댑터로 분리한다.
2. **조직 우선 데이터 모델**: 모든 도메인 테이블에 `organization_id`를 추가하고, JWT에 주입한 `org_id` 클레임으로 RLS를 수행한다([Supabase SSO 가이드](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml) 참고).
3. **계약 기반 API**: Supabase RPC/Edge Function으로 도메인 계약을 정의하고, 프런트에서는 타입 세이프 클라이언트(예: Zod 기반)로 호출한다.
4. **Automation First**: CI에서 lint/test/build/publish 전 과정을 자동화하여 플랫폼 동등성 확인.
5. **보안/운영 기본 탑재**: 감사 로그, 알림, 백업 전략을 개발 단계에서부터 포함.

## 3. 워크스트림별 계획
### 3.1 공용 플랫폼 계층 정리
- **목표**: React 도메인 로직을 공용 패키지(`packages/core`, `packages/ui`)로 추출하고, 웹/Electron 앱은 모듈을 소비하도록 구조화.
- **핵심 작업**:
  1. `src/` 구조 평가 후 `packages/` 모듈화 설계 문서화
  2. Electron 브리지(`infrastructure/electron/bridges`)를 `platform/electron`으로 이동, 웹 대체 구현 준비
  3. CRA 빌드 출력과 Electron 렌더러 공유 파이프라인 설계
- **산출물**: 패키지 구조 다이어그램, `pnpm` 혹은 `npm workspaces` 구성, 공용 빌드 스크립트

### 3.2 멀티테넌시 백엔드 & 인증
- **목표**: 조직, 사용자-조직 매핑, 권한(RBAC) 지원. 조직 기반 RLS 적용.
- **핵심 작업**:
  1. Supabase 마이그레이션 작성: `organizations`, `user_organizations`, `organization_invitations`, 도메인 테이블 FK 추가
  2. JWT 커스텀 클레임 주입 Edge Function (로그인 시 `org_id`, `roles` 추가)
  3. SSO/SAML 멀티 프로바이더 관리 CLI/대시보드(필요 시) 구현
  4. 테스트: RLS 정책 단위 테스트, 통합 테스트 (Supabase CLI + Jest)
- **참고 문서**: Supabase Enterprise SSO, Supabase Architecture 가이드

### 3.3 웹 SaaS 경험 개선
- **목표**: 웹 전용 라우팅, 온보딩 플로우, 조직 전환 UI 제공.
- **핵심 작업**:
  1. `App.js` 모드 분기 제거 후 라우터 도입(React Router or Next.js 전환 검토)
  2. `useLibraryAppViewModel`에 `activeOrganization`, `entitlements` 상태 추가
  3. 조직 스위처, 초대 수락, 결제 연동 UI 구현
  4. 접근성/국제화 점검 및 Lighthouse 목표 수립

### 3.4 Electron 앱 패리티 유지
- **목표**: 공용 패키지 사용하면서 Electron만의 기능(트레이, 단축키, 캡처)을 유지
- **핵심 작업**:
  1. Electron 메인 프로세스 정리 (`electron/main`, `preload`) → 타입 정의, IPC 채널 명세화
  2. 플랫폼 기능 추상화: 예) `ClipboardService`, `WindowController`
  3. 데스크톱 릴리스 파이프라인(`electron-builder`) 자동화, 코드 서명 전략 수립

### 3.5 운영·보안·품질
- **목표**: SaaS 운영을 위한 관측성과 거버넌스 체계 구축
- **핵심 작업**:
  1. Stripe Billing 연동: `organization_subscriptions`, Webhook Edge Function
  2. 모니터링: Sentry, Logflare, Supabase Audit Logs 파이프라인 구성
  3. 백업/DR: Supabase PITR, Storage 버전관리, 스냅샷 자동화
  4. QA 전략: 스모크(Electron), E2E(Playwright), 단위 테스트 일괄 실행

## 4. 단계별 로드맵
| 단계 | 기간 | 주요 목표 | 산출물 |
| --- | --- | --- | --- |
| **Phase 0 – 준비** | 0~2주 | 워크스트림 킥오프, 환경 분리(.env), 공용 패키지 구조 설계 | 아키텍처 노트, 작업 백로그, CI 기본 파이프라인 | 
| **Phase 1 – 데이터/인증 토대** | 3~6주 | 조직 테이블/마이그레이션, JWT 클레임, RLS 적용, 베타 테넌트 전환 | Supabase 마이그레이션, Edge Function, 정책 테스트 리포트 |
| **Phase 2 – 프런트 리팩터링** | 6~10주 | 웹 라우팅 개편, 조직 스위처, Electron 추상화 | 새로운 앱 구조, UI 프로토타입, 플랫폼 어댑터 |
| **Phase 3 – 상용 준비** | 10~14주 | 결제/운영, 모니터링, 배포 파이프라인, 보안 점검 | Stripe 연동, 운영 runbook, 보안/성능 결과 |
| **Phase 4 – 출시 & 피드백** | 14~18주 | 선택 테넌트 온보딩, SLA 모니터링, 피드백 기반 반복 | 릴리스 노트, KPI 리포트, 개선 백로그 |

## 5. 일정 관리 & 협업 방식
- **스프린트**: 2주 단위, 각 워크스트림 대표가 스프린트 목표와 데모 책임.
- **회의**: 주간 스탠드업(15분), 스프린트 리뷰/회고, 월간 아키텍처 보드.
- **문서화**: 모든 설계/결정은 `docs/` 혹은 Notion(사내 위키)에 기록, PR에는 설계 링크 필수.
- **품질 게이트**: PR 머지 전 lint/test/빌드 모두 성공, RLS/보안 관련 변경은 2명 이상 리뷰.

## 6. 리스크 및 대응 전략
| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| 멀티테넌시 마이그레이션 실패 | 데이터 손상/다운타임 | Blue/Green 전략, 백업 복구 리허설, 단계적 백필 |
| Electron/웹 기능 파편화 | 유지보수 비용 증가 | 플랫폼 추상화 계층, 자동화 테스트에서 양 플랫폼 검증 |
| Supabase 한계(쿼터, 성능) | 서비스 장애 가능 | Supabase 모니터링, 리드 리플리카/캐시 전략, 필요 시 BFF 도입 준비 |
| 보안·컴플라이언스 부족 | 엔터프라이즈 계약 차질 | SOC2 로드맵, 비밀 관리(Vault), 감사 로그 상시 점검 |
| Stripe/Webhook 실패 | 과금 누락/중복 | 재시도 큐, Stripe CLI 테스트, 경고 알림 채널 구성 |

## 7. 성공 지표 (KPI)
- 조직 온보딩 성공률 ≥ 95%
- 멀티테넌시 전환 이후 데이터 격리 이슈 0건
- 웹/Electron CRASH-free 세션 ≥ 99%
- 신규 기능 릴리스 주기 ≤ 4주
- Stripe 결제 성공률 ≥ 99%

## 8. 즉시 실행 To-do
1. 모노레포 구조 제안(PRD) 작성 및 합의
2. Supabase 스키마 초안 설계 → ERD 공유 후 피드백 수렴
3. CI 파이프라인 초안(setup-node, lint/test/build) 추가
4. Electron 기능 리스트업(트레이, 단축키, 캡처)과 웹 대비 차이 정리
5. 보안/운영 요구사항 체크리스트 작성 (로그, 백업, 알림)

## 9. 후속 문서 & 레퍼런스
- `docs/library-saas-blueprint.md`: 상위 수준 아키텍처 로드맵
- Supabase Docs – Enterprise SSO, Architecture
- Stripe Billing 통합 가이드
- Electron 공식 가이드 (IPC, 보안 모범 사례)

---
본 계획은 2주 단위로 재검토하며, 마일스톤 달성 여부와 리스크 상태를 업데이트한다. 변경 사항은 문서와 이슈 트래커에 기록하여 모든 팀원이 최신 정보를 공유할 수 있도록 한다.
