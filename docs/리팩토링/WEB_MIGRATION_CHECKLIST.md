# 검증 체크리스트

> **목적**: 각 작업 단계의 검증 방법 (자동/수동) 명시
> **사용법**: 각 Task 완료 후 해당 섹션의 모든 항목 체크

---

## 📋 목차

1. [자동 검증 vs 수동 검증](#자동-검증-vs-수동-검증)
2. [Phase 0 검증](#phase-0-레거시-코드-삭제-검증)
3. [Phase 1 검증](#phase-1-기반-구축-검증)
4. [Phase 2 검증](#phase-2-아키텍처-재정비-검증)
5. [Phase 3 검증](#phase-3-코드-이식-검증)
6. [최종 검증](#최종-통합-검증)

---

## 자동 검증 vs 수동 검증

### 🤖 자동 검증 (AI가 실행 가능)

```bash
# 타입 체크
npm run type-check
# → 에러 0개여야 성공

# 빌드
npm run build
# → exit code 0이어야 성공

# 테스트
npm run test
# → 모든 테스트 통과해야 성공

# Lint
npm run lint
# → 에러 0개, 경고 최소화
```

### 👤 수동 검증 (사용자가 직접 확인)

```
1. 브라우저에서 기능 동작 확인
2. UI가 올바르게 렌더링되는지 확인
3. 사용자 플로우 테스트
4. 시각적 검증 (레이아웃, 스타일)
5. 에러 메시지 확인
```

---

## Phase 0: 레거시 코드 삭제 검증

### 🤖 자동 검증

```bash
# 1. 빌드 성공 확인
npm run build
# ✅ exit code 0

# 2. 사용하지 않는 import 검사
npm run lint
# ✅ "unused import" 경고 없음

# 3. Electron 키워드 남아있는지 확인
grep -r "electron\|ipcRenderer" src/ --include="*.js" --include="*.jsx" | wc -l
# ✅ 출력: 0 (electron/ 디렉토리 제외)

# 4. 죽은 코드 태그 확인
grep -r "DEPRECATED\|@deprecated" src/ | wc -l
# ✅ 출력: 0
```

### 👤 수동 검증

```markdown
□ npm run dev 실행 시 오류 없음
□ 브라우저 콘솔에 에러 없음
□ 로그인 페이지 정상 표시
□ 기존 기능(로그인, 트리 목록) 동작 확인
```

### 체크포인트 생성

```bash
git add .
git commit -m "checkpoint: Phase 0 complete - legacy code removed"
git tag backup-phase0-complete
```

---

## Phase 1: 기반 구축 검증

### Task 1.1-1.2: Vite 프로젝트 초기화

#### 🤖 자동 검증

```bash
# 1. Vite 설정 파일 존재 확인
test -f vite.config.ts && echo "OK" || echo "FAIL"
# ✅ OK

# 2. TypeScript 설정 파일 존재
test -f tsconfig.json && echo "OK" || echo "FAIL"
# ✅ OK

# 3. package.json에 vite 존재
grep "vite" package.json
# ✅ "vite": "^6.0.0"

# 4. 개발 서버 실행
timeout 10s npm run dev &
sleep 5
curl http://localhost:3000 > /dev/null 2>&1 && echo "OK" || echo "FAIL"
# ✅ OK
```

#### 👤 수동 검증

```markdown
□ npm run dev 실행 시 Vite 로고 표시
□ http://localhost:3000 접속 시 화면 표시
□ 핫 리로드 동작 (파일 수정 시 즉시 반영)
```

### Task 1.3-1.4: 라이브러리 설치 및 TypeScript 설정

#### 🤖 자동 검증

```bash
# 1. 필수 패키지 설치 확인
npm list zustand vitest @supabase/supabase-js
# ✅ 모두 설치됨

# 2. Path alias 동작 확인
echo "import { test } from '@domain/test';" > src/test.ts
npm run type-check 2>&1 | grep "@domain/test"
rm src/test.ts
# ✅ Cannot find module (정상, 파일이 없으므로)

# 3. TypeScript strict 모드 확인
grep "\"strict\": true" tsconfig.json
# ✅ "strict": true
```

#### 👤 수동 검증

```markdown
□ node_modules/ 디렉토리 존재
□ package-lock.json 업데이트됨
□ npm run type-check 실행 시 tsconfig 읽음
```

### Task 1.5-1.7: 환경 변수 및 테스트 설정

#### 🤖 자동 검증

```bash
# 1. .env 파일 존재 및 필수 변수 확인
test -f .env && grep "VITE_SUPABASE_URL" .env && echo "OK" || echo "FAIL"
# ✅ OK

# 2. 테스트 실행
npm run test -- --run
# ✅ Tests passed

# 3. 커버리지 확인
npm run test:coverage
# ✅ Coverage report generated
```

#### 👤 수동 검증

```markdown
□ .env 파일에 Supabase URL 있음
□ .env 파일에 Supabase Anon Key 있음
□ npm run test 실행 시 Vitest UI 표시
```

### Task 1.8-1.12: 최소 React App 및 체크포인트

#### 🤖 자동 검증

```bash
# 1. 빌드 성공
npm run build
# ✅ exit code 0

# 2. dist 디렉토리 생성 확인
test -d dist && echo "OK" || echo "FAIL"
# ✅ OK

# 3. index.html 생성 확인
test -f dist/index.html && echo "OK" || echo "FAIL"
# ✅ OK

# 4. 번들 크기 확인 (1MB 이하)
du -sh dist/ | awk '{print $1}'
# ✅ < 1MB
```

#### 👤 수동 검증

```markdown
□ npm run dev 실행 후 "JARVIS Web Migration" 화면 표시
□ Tailwind CSS 스타일 적용됨 (흰색 카드, shadow)
□ 브라우저 콘솔 에러 없음
□ npm run preview 실행 시 빌드된 앱 표시
```

### Phase 1 최종 체크리스트

```markdown
✅ 자동 검증
□ npm run type-check 에러 0개
□ npm run build 성공
□ npm run test 통과 (최소 1개 테스트)
□ npm run lint 에러 0개

✅ 수동 검증
□ http://localhost:3000 접속 성공
□ "JARVIS Web Migration" 화면 표시
□ Tailwind 스타일 적용
□ 콘솔 에러 없음

✅ Git 커밋
□ git status → clean
□ git log → "Phase 1 complete" 커밋 존재
□ git tag backup-phase1-complete 생성
```

---

## Phase 2: 아키텍처 재정비 검증

### Task 2.1: Infrastructure → Features 의존성 제거

#### 🤖 자동 검증

```bash
# 1. Infrastructure에서 features import 검색
grep -r "from.*features\|from.*@features" src/infrastructure/
# ✅ 출력 없음 (0개)

# 2. Domain에서 외부 의존성 검색
grep -r "from.*react\|from.*infrastructure\|from.*features" src/domain/
# ✅ 출력 없음 (순수 TypeScript만)

# 3. ConversationService 테스트
npm run test ConversationService
# ✅ 통과
```

#### 👤 수동 검증

```markdown
□ src/domain/services/ConversationService.ts 존재
□ features/tree/utils/conversation.js 삭제됨
□ infrastructure에서 ConversationService import 확인
```

### Task 2.2: Shared 레이어 해체

#### 🤖 자동 검증

```bash
# 1. shared 디렉토리 존재하지 않음
test -d src/shared && echo "FAIL" || echo "OK"
# ✅ OK (없어야 함)

# 2. 잔여 shared import 검색
grep -r "from.*shared\|from.*@shared" src/
# ✅ 출력 없음 (모두 변경됨)

# 3. 빌드 성공
npm run build
# ✅ 성공
```

#### 👤 수동 검증

```markdown
□ src/shared/ 디렉토리 삭제됨
□ src/domain/utils/ 에 순수 유틸 이동 확인
□ src/features/shared/ 에 UI 컴포넌트 이동 확인
□ src/infrastructure/supabase/client.ts 존재 확인
```

### Task 2.3-2.4: Domain 서비스 및 Repository

#### 🤖 자동 검증

```bash
# 1. Domain 서비스 존재
test -f src/domain/services/TreeService.ts && echo "OK" || echo "FAIL"
# ✅ OK

# 2. Repository 인터페이스 존재
test -f src/domain/repositories/ITreeRepository.ts && echo "OK" || echo "FAIL"
# ✅ OK

# 3. Repository 구현체 존재
test -f src/infrastructure/supabase/repositories/SupabaseTreeRepository.ts && echo "OK" || echo "FAIL"
# ✅ OK

# 4. TreeService 테스트
npm run test TreeService
# ✅ 통과
```

#### 👤 수동 검증

```markdown
□ src/domain/services/TreeService.ts 파일 열어서 로직 확인
□ ITreeRepository 인터페이스 메서드 정의 확인
□ SupabaseTreeRepository가 ITreeRepository implement 확인
```

### Task 2.5: Zustand Store

#### 🤖 자동 검증

```bash
# 1. libraryStore 존재
test -f src/features/library/store/libraryStore.ts && echo "OK" || echo "FAIL"
# ✅ OK

# 2. Store 타입 체크
npm run type-check src/features/library/store/libraryStore.ts
# ✅ 에러 없음

# 3. Store import 테스트
echo "import { useLibraryStore } from './store/libraryStore';" > src/features/library/test.ts
npm run type-check src/features/library/test.ts
rm src/features/library/test.ts
# ✅ 성공
```

#### 👤 수동 검증

```markdown
□ libraryStore.ts 파일 열어서 state 구조 확인
□ actions, computed getters 정의 확인
□ devtools 미들웨어 설정 확인
```

### Phase 2 최종 체크리스트

```markdown
✅ 의존성 규칙 검증
□ Infrastructure → Features: 0개
□ Domain → 외부: 0개
□ Shared 디렉토리 삭제

✅ 자동 검증
□ npm run type-check 에러 0개
□ npm run build 성공
□ npm run test 통과 (TreeService, ConversationService)

✅ 수동 검증
□ DI Container 동작 확인 (container.treeService)
□ Zustand store 구조 확인

✅ Git 커밋
□ git commit "Phase 2 complete"
□ git tag backup-phase2-complete
```

---

## Phase 3: 코드 이식 검증

### Task 3.1: 인증 기능

#### 🤖 자동 검증

```bash
# 1. AuthProvider 존재
test -f src/infrastructure/supabase/auth/AuthProvider.tsx && echo "OK" || echo "FAIL"
# ✅ OK

# 2. 타입 체크
npm run type-check src/infrastructure/supabase/auth/
# ✅ 에러 없음

# 3. 빌드
npm run build
# ✅ 성공
```

#### 👤 수동 검증

```markdown
✅ 로그인 플로우
□ npm run dev 실행
□ http://localhost:3000 접속 → 로그인 페이지 표시
□ "Google로 로그인" 버튼 클릭 → Google OAuth 페이지로 이동
□ Google 계정 선택 → 로그인 완료
□ /auth/callback으로 리다이렉트 → "로그인 처리 중..." 표시
□ AuthGate 통과 → LibraryApp 표시

✅ 세션 유지
□ 새로고침 (F5) → 로그인 유지됨
□ 브라우저 재시작 → 로그인 유지됨

✅ 로그아웃
□ 로그아웃 버튼 클릭 → 로그인 페이지로 이동
□ 세션 삭제 확인 (localStorage 확인)

✅ 에러 핸들링
□ 잘못된 OAuth → 에러 메시지 표시
□ 네트워크 끊고 → 적절한 에러 메시지
```

### Task 3.2: 라이브러리 기능

#### 🤖 자동 검증

```bash
# 1. 컴포넌트 존재
test -f src/features/library/components/LibraryApp.tsx && echo "OK" || echo "FAIL"
test -f src/features/library/components/LibrarySidebar.tsx && echo "OK" || echo "FAIL"
test -f src/features/library/components/TreeList.tsx && echo "OK" || echo "FAIL"
# ✅ 모두 OK

# 2. Hooks 존재
test -f src/features/library/hooks/useLibraryData.ts && echo "OK" || echo "FAIL"
test -f src/features/library/hooks/useTreeOperations.ts && echo "OK" || echo "FAIL"
# ✅ 모두 OK

# 3. 빌드
npm run build
# ✅ 성공

# 4. 타입 체크
npm run type-check src/features/library/
# ✅ 에러 0개
```

#### 👤 수동 검증

```markdown
✅ UI 렌더링
□ 로그인 후 LibraryApp 표시
□ 왼쪽 사이드바 표시 (검은 배경)
□ 오른쪽 컨텐츠 영역 표시 (흰 배경)
□ "새 트리" 버튼 표시

✅ 트리 생성
□ "새 트리" 클릭 → prompt 표시
□ 이름 입력 (예: "테스트 트리") → Enter
□ 트리 목록에 추가됨 (상단에)
□ Supabase Dashboard에서 데이터 확인

✅ 트리 선택
□ 트리 클릭 → 파란 배경 (선택 상태)
□ 오른쪽에 트리 제목 표시
□ "노드 수: 0" 표시

✅ 트리 이름 변경
□ 트리 hover → ✏️ 버튼 표시
□ ✏️ 클릭 → prompt 표시
□ 새 이름 입력 → Enter
□ 트리 이름 변경됨

✅ 트리 삭제
□ 트리 hover → 🗑️ 버튼 표시
□ 🗑️ 클릭 → 확인 다이얼로그
□ "확인" → 트리 삭제됨
□ 목록에서 사라짐

✅ 폴더 (있는 경우)
□ 폴더 목록 표시
□ 폴더 클릭 → 해당 폴더 트리만 표시
□ 계층 구조 (▶ 버튼) 동작
```

### Task 3.3: 트리 시각화

#### 🤖 자동 검증

```bash
# 1. 파일 크기 확인 (300줄 이하)
wc -l src/features/tree/components/TreeVisualization/*.tsx
wc -l src/features/tree/hooks/*.ts
wc -l src/features/tree/services/*.ts
wc -l src/domain/services/TreeForce*.ts
# ✅ 모든 파일 < 300줄

# 2. Domain 서비스 테스트
npm run test TreeForceCalculator
npm run test TreeHierarchyBuilder
# ✅ 통과

# 3. 빌드
npm run build
# ✅ 성공
```

#### 👤 수동 검증

```markdown
✅ 시각화 렌더링
□ 트리 선택 → 트리 시각화 표시
□ SVG 캔버스 표시 (border 있음)
□ 노드가 원으로 표시됨 (파란색)
□ 링크가 선으로 표시됨 (회색)

✅ Force Simulation
□ 페이지 로드 시 노드가 움직임 (애니메이션)
□ 몇 초 후 안정화 (멈춤)
□ 루트 노드가 중앙에 배치

✅ 줌/팬
□ 마우스 휠 → 줌 인/아웃
□ 드래그 → 캔버스 이동
□ "Reset Zoom" 버튼 → 원위치

✅ 노드 드래그
□ 노드 드래그 → 위치 변경
□ 드래그 중 다른 노드 밀림 (collision)
□ 드래그 끝 → 새 위치에 안정화

✅ 노드 클릭
□ 노드 클릭 → (Task 3.4에서 QA 패널 표시)
□ 현재는 console.log 또는 아무 동작 없음
```

### Phase 3 최종 체크리스트

```markdown
✅ 자동 검증
□ npm run type-check 에러 0개
□ npm run build 성공
□ npm run test 통과
□ 모든 파일 300줄 이하

✅ 기능 검증
□ 인증 플로우 완벽 동작
□ 트리 CRUD 모두 동작
□ 트리 시각화 정상 렌더링
□ Force simulation 동작

✅ 성능 검증
□ 페이지 로드 < 3초
□ 트리 선택 시 즉시 반응
□ 줌/팬 부드러움 (60fps)

✅ Git 커밋
□ git commit "Phase 3 complete"
□ git tag backup-phase3-complete
```

---

## 최종 통합 검증

### 전체 기능 E2E 테스트

```markdown
✅ 사용자 플로우 1: 신규 사용자
□ 로그인 페이지 접속
□ Google 로그인
□ 첫 화면 (빈 라이브러리)
□ 새 트리 생성
□ 트리 선택 → 시각화 표시
□ 노드 생성 (Task 3.4에서)
□ 로그아웃
□ 재로그인 → 데이터 유지 확인

✅ 사용자 플로우 2: 기존 사용자
□ 로그인 (세션 유지됨)
□ 트리 목록 표시
□ 트리 선택
□ 노드 편집
□ 새 트리 생성
□ 폴더로 정리
□ 검색 기능

✅ 사용자 플로우 3: 에러 시나리오
□ 네트워크 끊고 → 적절한 에러 메시지
□ 잘못된 데이터 → 에러 핸들링
□ 동시 편집 충돌 → 처리
```

### 성능 검증

```bash
# Lighthouse 실행 (Chrome DevTools)
1. npm run build
2. npm run preview
3. Chrome DevTools → Lighthouse
4. "Generate report"

# 목표 점수
✅ Performance: 90+
✅ Accessibility: 90+
✅ Best Practices: 90+
✅ SEO: N/A (로그인 필요)
```

### 번들 크기 검증

```bash
npm run build

# dist/ 크기 확인
du -sh dist/
# ✅ < 2MB

# gzipped 크기
du -sh dist/**/*.js.gz
# ✅ < 1MB
```

### 브라우저 호환성 검증

```markdown
✅ Chrome (최신)
□ 모든 기능 동작
□ DevTools 콘솔 에러 없음

✅ Firefox (최신)
□ 모든 기능 동작

✅ Safari (최신)
□ 모든 기능 동작

✅ Edge (최신)
□ 모든 기능 동작

✅ 모바일 (선택)
□ Chrome Mobile
□ Safari Mobile
```

### 최종 코드 품질 검증

```bash
# 1. 타입 체크
npm run type-check
# ✅ 에러 0개

# 2. Lint
npm run lint
# ✅ 에러 0개, 경고 최소화

# 3. 테스트 커버리지
npm run test:coverage
# ✅ 80%+

# 4. 빌드 워닝
npm run build 2>&1 | grep -i "warning"
# ✅ 중요 경고 없음
```

### Clean Architecture 검증

```bash
# 1. 의존성 규칙 검증
grep -r "from.*features" src/infrastructure/ src/domain/
# ✅ 0개

# 2. Domain 순수성 검증
grep -r "from.*react\|from.*d3\|from.*supabase" src/domain/
# ✅ 0개

# 3. 파일 크기 검증
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 500 {print}'
# ✅ 500줄 이상 파일 없음
```

---

## 배포 전 최종 체크리스트

```markdown
✅ 코드 품질
□ npm run type-check 에러 0개
□ npm run lint 에러 0개
□ npm run test 모두 통과
□ npm run test:coverage 80%+
□ npm run build 성공

✅ 기능 완성도
□ 모든 기존 기능 동작
□ 새 기능 동작
□ Electron 기능 완전 제거
□ 위젯 기능 완전 제거

✅ 성능
□ Lighthouse Performance 90+
□ 번들 크기 < 1MB (gzipped)
□ First Paint < 1.5s
□ Time to Interactive < 3s

✅ 문서
□ README.md 업데이트
□ 환경 변수 가이드 (.env.example)
□ 배포 가이드 작성

✅ Git
□ 모든 변경사항 커밋
□ 커밋 메시지 명확
□ main 브랜치 병합 준비
□ 태그 생성 (v1.0.0)

✅ 환경 설정
□ .env 파일 백업
□ Supabase 프로젝트 확인
□ OAuth 리다이렉트 URL 설정
□ CORS 설정 확인

✅ 배포 준비
□ Vercel 프로젝트 생성
□ 환경 변수 설정 (Vercel)
□ 도메인 설정 (선택)
□ 배포 성공 확인
```

---

## 수동 설정 항목 상세

### 1. Supabase OAuth 설정

**위치**: Supabase Dashboard → Authentication → URL Configuration

```
Site URL: https://your-domain.vercel.app
Redirect URLs:
- http://localhost:3000/auth/callback (개발)
- https://your-domain.vercel.app/auth/callback (프로덕션)
```

**확인 방법**:
```markdown
□ Supabase Dashboard 접속
□ 프로젝트 선택
□ Authentication → Settings → URL Configuration
□ Redirect URLs에 위 URL 추가
□ Save 클릭
```

### 2. 환경 변수 설정 (로컬)

**파일**: `.env`

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

**가져오는 방법**:
```markdown
□ Supabase Dashboard → Settings → API
□ Project URL 복사 → VITE_SUPABASE_URL
□ anon public 키 복사 → VITE_SUPABASE_ANON_KEY
□ .env 파일에 붙여넣기
```

### 3. 환경 변수 설정 (Vercel)

**위치**: Vercel Dashboard → Project → Settings → Environment Variables

```
VITE_SUPABASE_URL = https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
VITE_SUPABASE_REDIRECT_URL = https://your-domain.vercel.app/auth/callback
```

**확인 방법**:
```markdown
□ Vercel Dashboard 접속
□ 프로젝트 선택
□ Settings → Environment Variables
□ Add New 클릭
□ Key, Value 입력
□ Production 선택
□ Save
□ 재배포 (Deployments → Redeploy)
```

### 4. Git 설정 (선택)

**.gitignore에 추가**:
```
.env
.env.local
.env.production
node_modules/
dist/
*.log
.DS_Store
```

**확인 방법**:
```bash
cat .gitignore
# 위 항목들이 있는지 확인
```

---

## 체크리스트 사용 예시

### 예시 1: Phase 1 완료 후

```bash
# 1. 자동 검증 실행
npm run type-check  # ✅ 통과
npm run build       # ✅ 성공
npm run test        # ✅ 1개 테스트 통과

# 2. 수동 검증
# http://localhost:3000 접속
# ✅ "JARVIS Web Migration" 표시
# ✅ Tailwind 스타일 적용
# ✅ 콘솔 에러 없음

# 3. 체크리스트 마킹
# docs/WEB_MIGRATION_CHECKLIST.md 열기
# Phase 1 섹션의 모든 □를 ✅로 변경

# 4. 커밋
git add .
git commit -m "checkpoint: Phase 1 complete - all checks passed"
git tag backup-phase1-complete
```

### 예시 2: 오류 발생 시

```bash
# 1. 자동 검증 실행
npm run build
# ❌ 에러 발생

# 2. 체크리스트에서 원인 찾기
# 실패한 항목 확인

# 3. WEB_MIGRATION_ERRORS.md에서 해결책 찾기
# 해당 오류 시나리오 검색

# 4. 해결 후 재검증
npm run build  # ✅ 성공

# 5. 체크리스트 마킹
# 이제 ✅ 체크
```

---

**관련 문서**:
- [메인 계획서](./WEB_MIGRATION_PLAN.md)
- [오류 대응](./WEB_MIGRATION_ERRORS.md)
- [Phase 3 상세](./WEB_MIGRATION_PHASE3.md)
