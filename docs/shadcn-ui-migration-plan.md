# Shadcn UI 전체 마이그레이션 실행 계획 (노드 트리 예외)

## 1. 목적 및 배경
- 목표: 기존 UI 전반을 [shadcn/ui](https://www.shadcn.io/) 컴포넌트体系로 교체해 일관된 디자인 시스템을 구축한다.
- 예외: 노드 트리 본체 및 위젯 UI (`src/components/HierarchicalForceTree.js`, `src/components/tree/**/*`, `src/components/library/WidgetTreeViewer.js`, `src/features/tree/**/*`)는 마이그레이션 대상에서 제외한다.
- 테마 기준: **라이트 모드**는 배경을 순백(#ffffff)으로, 모든 컴포넌트 표면은 순흑(#000000) 기반으로 구성한다. 텍스트/아이콘은 대비를 맞춰 흰색 또는 밝은 회색으로 설정한다.
- 다크 모드도 제공하며, Shadcn 권장 다크 토큰을 기반으로 하되 노드 트리와 위젯 스타일은 유지한다.
- 기대효과: 재사용 가능한 컴포넌트 확보, 접근성/테마 일관성 강화, 향후 확장성 향상.

## 2. 작업 범위 요약
| 영역 | 주요 파일/디렉터리 | 비고 |
| --- | --- | --- |
| 전역 스타일 | `src/index.css`, `src/App.css`, `src/theme/**/*` | Shadcn 토큰/유틸 통합, 라이트/다크 CSS 변수 정의 |
| 공통 UI | `src/components/ui/**/*`, `src/components/common/**/*`, `src/components/WindowChrome.js` 등 | Shadcn 프리미티브 기반으로 재작성 |
| 위젯 외 패널 | `src/components/NodeAssistantPanel.js`, `src/components/SettingsPanel.js`, `src/components/TrayDebugButton.js` 등 | 레이아웃/패널 요소 Shadcn화 |
| 라이브러리 앱 | `src/components/library/**/*` (예외: `WidgetTreeViewer.js`, `TreeCanvas.js`) | 사이드바, 다이얼로그, 카드 등을 Shadcn 컴포넌트로 교체 |
| 관리자 도구 | `src/components/admin/**/*` | 테이블/폼/패널 마이그레이션 |
| 인증/외부뷰 | `src/components/auth/**/*`, `src/views/**/*` | Dialog/Form/Alert 구성 |
| 공통 서비스/훅 | `src/hooks/**/*`, `src/services/**/*` | UI 비의존 로직만 유지, UI 의존 부분은 Shadcn 컴포넌트와 연동 |

## 3. 선행 준비
1. **Shadcn CLI 도입**
   - 루트에서 `npx shadcn@latest init -d` 실행해 CRA 환경에 맞춰 설정 파일 생성.
   - `components.json` 생성 여부 확인 및 `style: "default"`, `tailwind.config` 경로 조정.
2. **Tailwind 설정 정비**
   - `tailwind.config.js`에 Shadcn 권장 preset 반영 (`tailwindcss-animate`, 색상 토큰, keyframes 등).
   - `content` 경로에 `./src/**/*.{js,jsx,ts,tsx}` 유지.
   - `theme.extend`에 라이트/다크 CSS 변수를 정의한다. 라이트 모드는 `--background: #ffffff`, `--foreground: #000000`, `--card: #000000`, `--card-foreground: #f5f5f5` 등으로 명시하고, 다크 모드는 Shadcn 기본 값을 참고해 필요 시 `--background: #0a0a0a`, `--foreground: #f5f5f5` 등으로 맞춘다.
   - Shadcn 컴포넌트가 참조하는 추가 컬러 토큰(`--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--popover` 등)도 라이트/다크 모두 선언하고, 흰 배경/검은 컴포넌트 요구사항에 맞춘 명도 대비 값을 표로 정리한다.
3. **전역 스타일 초기화**
   - `src/index.css` 혹은 `src/theme/glass.css`에 있는 reset 및 glass 효과를 재검토해 Shadcn 기본 reset(`@layer base`)과 병합.
   - 라이트/다크 모드 CSS 변수가 문서 루트(`:root`, `.dark`)에 정확히 선언되도록 조정한다.
4. **유틸리티 함수 배치**
   - `shadcn/ui` 기본 구조에 맞춰 `src/lib/utils.ts`(또는 `.js`)에 `cn` 함수 정의.
   - 현존하는 `clsx`, `tailwind-merge` 사용처를 `cn`으로 정리.
5. **기존 컴포넌트 인벤토리**
   - `docs/shadcn-ui-migration-log.md` 초안에 기존 주요 UI 컴포넌트와 대응할 Shadcn 컴포넌트를 1:1 매트릭스로 정리한다.
   - 각 항목에 우선순위와 특이사항(커스텀 애니메이션, glass 효과 등)을 기록해 스프린트 계획에 반영한다.
6. **회귀 기준 캡처**
   - Jest/Testing Library 스냅샷을 최신화하고 주요 화면 스크린샷을 `docs/widget-migration` 이하에 보관해 이후 시각 회귀 비교 기준을 마련한다.
   - `npm run electron:smoke`와 기본 빌드를 선점 실행해 실패 항목을 로그에 남기고, 마이그레이션 중 회귀 여부를 추적한다.

## 4. 설계 원칙
- **디자인 토큰 우선**: 색상/간격/타이포를 CSS 변수 기반으로 통일하고 Shadcn theme 값에 매핑. 라이트 모드 배경(#ffffff)과 컴포넌트(#000000) 대비를 유지하고, 다크 모드는 Shadcn 기본 스케일을 응용한다.
- **모드 일관성**: 모든 신규 컴포넌트는 `.dark` 클래스 토글 방식으로 라이트/다크 테마를 즉시 반영해야 한다.
- **접근성 보장**: Radix 기반 컴포넌트 사용 시 aria 속성/키보드 내비게이션 유지. 라이트/다크 모드 모두 대비 비율이 WCAG AA 이상이 되도록 확인한다.
- **로직 격리**: UI 교체 시 비즈니스 로직, 상태 관리 훅은 그대로 두고 프리젠테이션 레이어만 교체.
- **점진적 이행**: 공통 컴포넌트 → 레이아웃 → 기능별 화면 순서로 마이그레이션, 각 단계마다 시각/동작 회귀 테스트 수행.

## 5. 작업 단계 세부 가이드
### 5.1 아키텍처/환경 정비 (스프린트 0)
1. Shadcn CLI 설치 및 `components.json` 커스터마이즈.
2. `tailwind.config.js` 업데이트 후 `npm run dev`로 빌드 확인.
3. `src/index.css`에서 기존 reset과 충돌하는 부분 제거. 덮어쓰기 대신 Shadcn 기본 레이어에 포함.
4. `src/theme` 내 glass/테마 토큰을 Shadcn 토큰이 사용하는 CSS 변수 체계로 리팩터.
5. 전역 테마 스위처(라이트/다크 토글) 요구 사항을 정의하고 `ThemeProvider`에 반영 계획 수립.
6. 스토리북 대체 수단이 없다면 `docs/widget-migration` 아래 시각 스냅샷 가이드를 작성(필요시).

### 5.2 공통 프리미티브 구축 (스프린트 1)
1. Shadcn CLI로 `button`, `input`, `label`, `textarea`, `form`, `card`, `separator`, `scroll-area`, `sheet`, `dialog`, `dropdown-menu`, `tabs`, `accordion`, `alert`, `tooltip`, `toast` 등 핵심 컴포넌트를 추가.
2. 추가된 컴포넌트를 `src/components/ui/*` 경로로 이동하거나 CLI 설정에서 기본 경로 맞춤.
3. 각 컴포넌트에 라이트/다크 테마 변수(Class toggle) 적용 후, 라이트 모드에서 컴포넌트 배경이 #000000, 텍스트가 밝은 색을 유지하는지 확인.
4. 글로벌 레이아웃(`src/App.js`, `src/components/WindowChrome.js`)에서 공용 프리미티브를 사용하도록 기본 정리.
5. 기존 `src/components/common` 소비처에는 Shadcn 기반으로 래핑한 어댑터 컴포넌트를 우선 제공해 점진적으로 import 경로를 교체한다.

### 5.3 공통 레이아웃/패널 마이그레이션 (스프린트 2)
1. `NodeAssistantPanel`, `SettingsPanel`, `ChatWindow`, `ErrorRecoveryCard` 등 공통 패널을 Shadcn `Card`, `Tabs`, `ResizablePanel` 조합으로 재작성.
2. 라이트 모드 시 카드 배경(#000000)과 텍스트 대비, 다크 모드 시 카드 배경/텍스트가 Shadcn 다크 변수와 맞물리는지 검증.
3. 마이그레이션 후 컴포넌트 테스트(`npm run test -- NodeAssistantPanel` 등) 갱신.

### 5.4 라이브러리 앱 마이그레이션 (스프린트 3)
1. `Sidebar` → Shadcn `NavigationMenu` 또는 `Accordion`으로 대체, 폴더 트리 토글 로직 유지.
2. `CreateDialog` → `Dialog`, `Form`, `Button`으로 리팩터; Supabase 연동 로직 유지.
3. `LibraryConversationPanel`/`LibraryQAPanel` → `Tabs`, `ScrollArea`, `Card`로 재구성.
4. 각 화면에서 라이트/다크 테마 토글을 수동으로 확인하고, 색상 대비 체크리스트 업데이트.
5. `LibraryTreeVisualization` 주변 UI 컨테이너만 Shadcn화(실제 트리 위젯은 그대로 유지).

### 5.5 관리자/인증 화면 (스프린트 4)
1. `AdminWidgetPanel` → Shadcn `DataTable` 패턴 참고, 필터/정렬 UI 교체.
2. `SupabaseAuthGate`, `OAuthCallbackPage` → `Card`, `Alert`, `Skeleton` 등으로 피드백 UI 정리.
3. 상태 피드백/토스트는 Shadcn `useToast`로 통합.
4. 라이트/다크 모드 UI 캡처를 남겨 QA용 문서에 첨부.

### 5.6 테마/다크모드/모션 검증 (스프린트 5)
1. `ThemeProvider`에서 CSS 변수 업데이트 로직을 Shadcn 테마 토글 패턴과 통합.
2. 라이트 모드 기본값이 배경 흰색, 카드/컴포넌트 검은색으로 유지되는지 시각 검증.
3. 다크 모드 토글 시 Shadcn 다크 토큰이 적용되고 대비가 유지되는지 체크.
4. 다크 모드에서 노드 트리 UI가 기존 스타일과 충돌하지 않는지 확인.
5. 다크 모드, 고대비 모드, 모션 축소(`prefers-reduced-motion`)를 실제 장치 설정으로 수동 검증.
6. 기존 glass 효과가 필요한 구간은 Shadcn `Card` + 커스텀 class로 유지 여부 결정.

### 5.7 QA 및 안정화 (스프린트 6)
1. 단위 테스트/스냅샷 갱신 (`npm run test`).
2. `npm run electron:smoke`로 전반 흐름 확인.
3. Lighthouse, axe-core로 접근성 회귀 검사 (라이트/다크 각각 실행).
4. 스크린샷 비교(수동 또는 도구)로 노드 트리 UI 변동이 없는지 확인.
5. 문서화: 변경된 컴포넌트 카탈로그 및 사용 가이드를 `docs/widget-migration` 또는 신규 문서에 기록.
6. 색상 대비 측정 결과와 회귀 테스트 로그를 `docs/shadcn-ui-migration-log.md`에 요약해 QA/디자인 팀과 공유.

## 6. 파일 및 커밋 관리 지침
- 작업 단위별 브랜치 분리: `feat/shadcn-core`, `feat/shadcn-library`, `feat/shadcn-admin` 등.
- 각 단계 완료 후 `docs/shadcn-ui-migration-log.md`(신규) 또는 본 문서에 진행 상황 업데이트.
- 기존 git 변경사항 확인 후 무관 변경은 건드리지 않는다.

## 7. 위험 요소 및 완화 전략
- **Radix 의존성 충돌**: 기존에 사용 중인 `@radix-ui` 패키지 버전을 Shadcn CLI가 설치하는 버전과 맞추어 중복 설치 방지.
- **스타일 충돌**: 기존 `glass.css` 등에서 전역 클래스가 Shadcn 기본 스타일을 덮어쓰지 않도록 클래스 스코핑.
- **명도 대비 이슈**: 라이트 모드의 흰/검 조합이 텍스트 가독성을 해치지 않도록 `color-contrast` 검사 수행.
- **퍼포먼스**: 불필요한 애니메이션 제거 및 tree 위젯 render path에 영향 없도록 분리.
- **테스트 공백**: Shadcn 컴포넌트는 DOM 구조가 달라질 수 있으므로 Testing Library 셀렉터 업데이트 필요.
- **토큰 누락**: Shadcn 기본 컴포넌트가 기대하는 CSS 변수가 선언되지 않으면 기본값으로 되돌아가므로, 선행 준비 단계에서 토큰 체크리스트를 유지한다.

## 8. 완료 기준 (Definition of Done)
- 노드 트리 관련 화면 시각/행동 동일.
- 라이트 모드에서 배경 흰색, 컴포넌트 검은색 테마가 일관되게 적용.
- 다크 모드 토글이 모든 신규 컴포넌트에 적용되고 접근성 기준을 충족.
- Shadcn UI 컴포넌트만으로 구성된 공통 UI 레이어와 라이브러리/관리자/인증 화면 구현.
- 테스트 스위트 및 smoke 테스트 통과.
- 문서 및 컴포넌트 카탈로그 최신화.
- Shadcn 토큰 매트릭스 및 컴포넌트 대응표가 `docs/shadcn-ui-migration-log.md`에 최신 상태로 유지.

## 9. 참고 자료
- Shadcn 공식 문서: https://www.shadcn.io/docs
- Radix UI 접근성: https://www.radix-ui.com/docs/primitives/overview/introduction
- Tailwind + Shadcn 초기화 가이드: https://www.shadcn.io/docs/installation
- 접근성 검사 도구: https://www.deque.com/axe/

이 문서는 다른 AI 또는 개발자가 순차적으로 실행할 수 있도록 단계별로 구성되어 있으며, 각 단계에서 필요한 명령어와 검증 절차를 포함한다.
