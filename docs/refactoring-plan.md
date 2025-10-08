# 리팩터링 마스터 플랜

## 1. 배경 및 문제 요약
- `src/components`와 `src/src/components`가 이중화되어 UI 컴포넌트 import 경로가 분산됨.
- `ForceDirectedTree`(약 2,300줄)와 `LibraryApp`(약 1,200줄) 등 대형 컴포넌트가 유지보수성과 테스트성을 크게 저해함.
- 라이브러리/트리 영역에 문자열 인코딩 문제가 반복되어 한글 UI가 깨짐.
- 서비스·뷰·Electron 브리지 계층이 분리되지 않아 도메인 경계가 모호하고, 테스트 커버리지가 매우 낮음.

## 2. 리팩터링 목표
1. UI 컴포넌트 경로와 사용처를 단일화하여 import 일관성을 확보한다.
2. 대형 컴포넌트를 역할별 모듈로 분리해 가독성과 테스트 가능성을 높인다.
3. 한글 문자열 인코딩 오류를 제거하고 국제화 대비를 준비한다.
4. 핵심 도메인(트리·라이브러리)의 서비스 계층을 명확히 정의하고 테스트 커버리지를 확장한다.
5. Supabase·Electron·문서·빌드 파이프라인을 최신 구조에 맞게 정비한다.

## 3. 작업 스트림 및 세부 과제
### 3.1 UI 컴포넌트 경로 통합
- `src/src/components/ui` → `src/components/ui`로 병합하거나 배럴(`components/ui/index.js`)을 추가해 단일 경로로 통일.
- 중복된 Shadcn 컴포넌트 compare/merge 후 삭제 대상 식별.
- 경로 변경 영향도 분석: CRA/Electron 빌드, Storybook/테스트 import 수정.
- 완료 기준: lint/test 빌드 성공 & 모든 import 경로 검색(`rg "src\/src\/components\/ui"`)에서 제로 결과.

### 3.2 대형 컴포넌트 분해
- `ForceDirectedTree` 분해 제안
  - `hooks/forceTree/useSimulation`, `hooks/forceTree/useContextMenu`, `components/tree2/panels/*`, `components/tree2/renderers/*` 등으로 책임 분리.
  - 서비스 호출(예: `DataTransformService`, `QuestionService`) 어댑터를 생성하고 UI는 인터페이스만 참조.
- `LibraryApp`
  - 상태 관리 훅 도입(`useLibraryState`, `useDragManager`).
  - 폴더 네비게이션, 우측 패널, 헤더를 별도 프레젠테이션 컴포넌트로 분리.
- 분해 단계마다 Jest + React Testing Library 스냅샷/동작 테스트 추가.

### 3.3 인코딩 및 문자열 정비
- 한글이 깨진 파일 목록 수집 (`rg "?�" -n src` 등) → UTF-8 재저장.
- Supabase에서 내려오는 문자열 인코딩 확인(백엔드 스키마/클라이언트 fetch 시 `charset` 검토).
- 추후 i18n 대비를 위해 문자열 리소스 모듈(`src/locale/ko.json` 등) 도입 고려.

### 3.4 서비스·도메인 경계 재정비
- `services` → `features`별 어댑터 분리. 예: `treeCanvas` Feature가 내부적으로만 쓰는 서비스는 `src/features/treeCanvas/services`로 이동.
- Supabase API 호출(`supabaseTrees`)을 도메인 모델(`TreeRepository`, `FolderRepository`) 형태로 래핑.
- Electron 브리지 호출(`window.jarvisAPI`) 중앙화: `lib/electronBridge.js` 신설 후 전역에서 해당 모듈만 참조.
- IPC 계약 변경 시 테스트: preload 모킹한 통합 테스트 마련.

### 3.5 테스트 및 자동화 강화
- 우선순위 컴포넌트 테스트: `TreeCanvas`, `ForceDirectedTree` 서브컴포넌트, `LibraryTreeVisualization` 인터랙션.
- 서비스 단위 테스트: `TreeLayoutService`, `TreeSummaryService`, `supabaseTrees` 어댑터.
- Electron smoke(`scripts/smoke/run-electron-smoke.js`) 보강: 주요 IPC 경로 검증 추가.
- CI 워크플로(없다면 GitHub Actions 도입)에서 `npm test -- --watch=false` 및 smoke 실행.

### 3.6 문서 및 빌드/배포 정비
- `docs/`, `vooster-docs/` 문서를 최신 구조로 업데이트 (폴더 구조, 개발 흐름, 코드 스타일 변경 반영).
- Tailwind/테마(`src/theme/glass.css`) 재검토 후 공통 토큰 정의 문서화.
- Electron 패키징 스크립트 및 Supabase 마이그레이션 가이드 최신화.

## 4. 우선순위 및 일정 제안
| 단계 | 범위 | 예상 기간 | 의존성 |
| --- | --- | --- | --- |
| 1 | UI 경로 통합 + 문자열 인코딩 정비 | 1주 | 낮음 |
| 2 | `ForceDirectedTree` 1차 분해 및 테스트 | 2주 | 단계1 완료 후 병행 가능 |
| 3 | `LibraryApp` 분해 + 상태 훅 도입 | 2주 | 단계1 병행 가능, 단계2 일부 의존 |
| 4 | 서비스 경계 재정립 + Electron/Supabase 어댑터 | 1~2주 | 단계2·3 산출물 활용 |
| 5 | 테스트 자동화 확장 + 문서/빌드 정비 | 1주 | 선행 단계 정리 후 |

## 5. 리스크 및 대응
- **변경 범위 확대로 인한 회귀**: 단계별 커밋/PR, 테스트 강화로 대응.
- **Electron/Supabase 연동 중단**: 어댑터 계층 도입으로 API 계약 유지, smoke 테스트로 조기 감지.
- **팀 공유 지연**: `docs/`, `vooster-docs/`에 변경사항 즉시 기록, 주간 공유 세션 권장.

## 6. 검증 체크리스트
- [ ] `src/src/components` 제거 또는 빈 상태 확인.
- [ ] 리팩터링 이후 CRA/Electron 빌드 및 smoke 테스트 통과.
- [ ] 주요 트리/라이브러리 플로우 RTL 테스트 작성 완료.
- [ ] Supabase/Electron API 계약 문서화.
- [ ] 새 구조 반영한 개발자 온보딩 문서 업데이트.
