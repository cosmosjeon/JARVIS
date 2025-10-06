# Renderer 구조 재정비 계획 (Stage 6)

> 목표: `src/`를 목표 아키텍처(Feature-first + Shared/Infrastructure 분리)에 맞춰 정리하고, 남아있는 레거시 디렉터리를 단계적으로 마이그레이션한다.

## 가이드라인 복습
- Feature slice 우선: `src/features/<domain>`에 UI/상태/서비스를 모은다
- Shared 계층은 진입점(디자인 시스템/공용 유틸)만 담당
- Infrastructure는 Electron/Supabase 등 외부 연동을 캡슐화
- Domain은 UI-독립 로직이 충분할 때만 승격
- 단계별 작업 시간은 30~45분 이내로 쪼갠다 (기존 refactor-plan 정책 유지)

## Stage 6 개요
1. **정리 대상 조사**  
   - `/src/components`, `/src/controllers`, `/src/services`, `/src/views`, `/src/assets` 등 기존 구조 목록화  
   - Feature별로 이미 이전된 모듈 파악 (`features/tree`, `features/library`, `features/admin` 등)  
   - Electron 브리지 사용 경로 재확인 (settings/logs/window 등 IPC 의존성)

2. **마이그레이션 원칙**  
   - 기능 단위(예: 트리, 라이브러리, 관리자)로 나누어 진행  
   - 공유 UI/유틸은 `src/shared`로 승격  
   - Supabase/Electron 호출은 `src/infrastructure`로 이동 후 feature 서비스에서 의존성 주입  
   - 기존 폴더 삭제 전 테스트/문서 업데이트 수행

3. **검증 루프**  
   - 각 서브슬라이스 종료 시 `npm run electron:dev`로 기능 확인  
   - 사용자 점검 가이드: 영향 기능 중심(트리 CRUD, 라이브러리 필터, Admin 패널 등)  
   - 문서 업데이트: `docs/architecture.md` Stage 6 섹션 추가, `docs/refactor-plan.md` Stage 6 항목 등록

## Stage 6 세부 계획

### 작업 6A – Tree Feature 정리
- [x] **6A-1 파일 매핑**: `src/components/HierarchicalForceTree`, `src/controllers/tree`, `src/services/tree` 등 트리 관련 파일 목록화 및 의존성 다이어그램 작성
- [x] **6A-2 기능 이전**: 트리 관련 UI/상태/서비스를 `src/features/tree/*` 구조로 이동 (`ui`, `state`, `services` 디렉터리 통일)
- [ ] **6A-3 인프라/도메인 분리**: Supabase/Electron 의존 코드 `src/infrastructure`로 이동, 순수 로직은 `src/domain/tree`로 승격 여부 판단
- [ ] **6A-4 테스트/문서**: 영향 함수 수동 검증, `docs/refactor-plan.md` 체크리스트 갱신

### 작업 6B – Library Feature 정리
- [ ] **6B-1 파일 매핑**: `src/components/library`, `src/views/LibraryApp` 등 조사
- [ ] **6B-2 기능 이전**: 라이브러리 관련 모듈을 `src/features/library`로 재배치, 중복 UI `src/shared/components/library`로 정리
- [ ] **6B-3 계약 확인**: 라이브러리와 Electron 브리지(`libraryBridge`) 간 채널, 설정 방송(`settings:changed`) 동작 검증
- [ ] **6B-4 사용자 점검**: 필터/정렬/동기화 흐름 체크, 문서 업데이트

### 작업 6C – Admin Feature 정리
- [ ] **6C-1 파일 매핑**: `src/components/admin`, `src/services/admin` 현황 조사
- [ ] **6C-2 기능 이전**: Admin UI/상태/서비스를 `src/features/admin`으로 통합, 공용 UI는 `src/shared/components/admin` 유지
- [ ] **6C-3 IPC 계약 검토**: `adminBridge.openAdminPanel`, `adminBridge.closeAdminPanel` 등이 Stage 4 구조와 일치하는지 확인
- [ ] **6C-4 QA**: 관리자 패널 기능 수동 확인, 문서 갱신

### 작업 6D – Shared / Infrastructure 통합
- [ ] **6D-1 Shared UI**: `src/components` 및 `src/shared/ui` 중복 컴포넌트 정비, shadcn 기반 공통 컴포넌트는 `src/shared/ui`로 집약
- [ ] **6D-2 Shared Hooks/Utils**: 중복 훅/유틸을 `src/shared/hooks`, `src/shared/utils`로 이동하고 배럴 파일 업데이트
- [ ] **6D-3 Infrastructure**: Electron/Supabase 연동이 흩어져 있는 경우 `src/infrastructure/<system>`으로 재배치, 명시적 의존성 주입 문서화

### 작업 6E – Domain 계층 정리 (선택적)
- [ ] **6E-1 로직 선별**: 트리 계산, 정렬, 데이터 머지 등 UI와 독립된 로직 후보 목록 작성
- [ ] **6E-2 Domain 모듈화**: 후보 로직을 `src/domain/<feature>`로 이동하고 JSDoc 타입 문서화
- [ ] **6E-3 테스트**: 해당 로직 단위 테스트 보강(필요 시)

### 작업 6F – 마무리 & 문서
- [ ] **6F-1 문서 업데이트**: `docs/architecture.md`에 Stage 6 결과 반영 (레이어별 책임, 디렉터리 스냅샷)
- [ ] **6F-2 README/CHANGELOG**: 핵심 변경 요약 추가
- [ ] **6F-3 사용자 점검**: 전체 흐름(위젯, 라이브러리, Admin) 및 설정/로그 기능 재확인
- [ ] **6F-4 TODO 리스트**: 남은 이슈/테크빚 문서화

## Dependencies & Risks
- Supabase 키/환경 설정이 필요하므로 사용자 환경을 미리 확인
- Renderer 빌드(CRA) 관련 WARN (rehype-harden 소스맵) 지속 → Stage 6D에서 해결 여부 검토
- Stage 6 작업 중 Electron IPC 계약 변경 시 문서 및 브리지 타입 업데이트 필수

## Acceptance Criteria
- [ ] `src/` 최상위에 legacy 폴더(`components`, `controllers`, `services`, `views`)가 비어 있거나 제거됨
- [ ] 모든 기능이 `src/features` 또는 `src/shared`/`src/infrastructure`를 통해 재구조화됨
- [ ] Electron 브리지 계약, IPC 채널 이름, 사용자 점검 가이드가 최신 상태로 유지됨
- [ ] `docs/architecture.md` Stage 6 섹션과 `docs/refactor-plan.md` Stage 6 체크리스트가 완료됨

---
이 문서는 Stage 6 진행 전에 반드시 읽고, 각 서브슬라이스 종료 시 업데이트된 진척을 `docs/refactor-plan.md`에 반영합니다.
