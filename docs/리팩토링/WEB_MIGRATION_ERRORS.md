# 오류 시나리오 및 대응 방안

> **목적**: 대규모 리팩토링 중 발생 가능한 모든 오류 시나리오와 대응 방법
> **중요도**: ★★★★★ (필수 숙지)

---

## 📋 목차

1. [오류 방지 원칙](#오류-방지-원칙)
2. [Phase별 오류 시나리오](#phase별-오류-시나리오)
3. [기술별 오류 대응](#기술별-오류-대응)
4. [롤백 전략](#롤백-전략)
5. [긴급 복구 가이드](#긴급-복구-가이드)

---

## 오류 방지 원칙

### 🛡️ 5대 안전 원칙

1. **잦은 커밋**: 작업 단위마다 즉시 커밋
2. **점진적 변경**: 한 번에 1개 파일만 수정
3. **즉시 검증**: 수정 후 즉시 빌드/테스트
4. **롤백 준비**: 항상 이전 커밋으로 돌아갈 수 있게
5. **백업 유지**: 주요 단계마다 태그 생성

### 📐 작업 흐름

```
작업 전
├─ 1. Git 상태 확인 (모두 커밋됨?)
├─ 2. 백업 태그 생성
└─ 3. npm run build 성공 확인

작업 중
├─ 4. 1개 파일 수정
├─ 5. npm run type-check (타입 에러 확인)
├─ 6. npm run build (빌드 성공 확인)
└─ 7. npm run dev (실행 확인)

작업 후
├─ 8. 관련 테스트 실행
├─ 9. 수동 기능 테스트
├─ 10. Git 커밋
└─ 11. 다음 작업으로

오류 발생 시
├─ A. 증상 기록 (스크린샷, 에러 메시지)
├─ B. 이 문서에서 해결책 찾기
├─ C. 해결 안 되면 롤백
└─ D. 원인 파악 후 재시도
```

---

## Phase별 오류 시나리오

### Phase 0: 레거시 코드 삭제

#### 오류 1: 실제로 사용 중인 코드 삭제

**증상**:
```
npm run build

Module not found: Error: Can't resolve './deleted-file'
```

**원인**:
- 사용 여부 분석 실수
- 동적 import 놓침
- JSX에서 컴포넌트 사용 (export 검색으로 못 찾음)

**대응**:
```bash
# 1. 삭제한 파일 확인
git diff HEAD~1

# 2. 해당 파일 복구
git checkout HEAD~1 -- src/path/to/deleted-file.js

# 3. 사용처 정확히 검색
grep -r "deleted-file" src/

# 4. 실제 사용처 확인 후 판단
```

**예방**:
```bash
# 삭제 전 사용처 검색 (파일명 + export 이름)
grep -r "MyComponent\|myFunction" src/ --include="*.js" --include="*.jsx"

# 0개 결과여야 안전
```

#### 오류 2: Electron 분기 제거 시 웹 로직도 손상

**증상**:
```typescript
// ❌ 잘못된 제거
if (isElectron()) {
  // Electron 로직
  doElectronStuff();
} else {
  // 웹 로직 (이것도 함께 삭제됨)
  doWebStuff();  // ← 사라짐!
}
```

**대응**:
```typescript
// ✅ 올바른 제거
// Electron 분기 전체 제거 후 웹 로직만 유지
doWebStuff();
```

**예방**:
- `if (isElectron())` 검색 후 `else` 블록 확인
- 웹 로직은 반드시 유지

---

### Phase 1: Vite 프로젝트 구축

#### 오류 3: 환경 변수 로드 실패

**증상**:
```
console.log(import.meta.env.VITE_SUPABASE_URL);
// 출력: undefined
```

**원인**:
1. `.env` 파일 누락
2. `VITE_` prefix 누락
3. `.env` 파일 위치 잘못됨

**대응**:
```bash
# 1. .env 파일 위치 확인 (프로젝트 루트에 있어야 함)
ls -la .env
# -rw-r--r--  1 user  staff  123 Oct 18 10:00 .env

# 2. 내용 확인
cat .env
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=xxx

# 3. prefix 확인 (VITE_로 시작해야 함)
grep "^VITE_" .env

# 4. 개발 서버 재시작 (필수!)
npm run dev
```

**예방**:
- `.env.example` 파일 생성해서 가이드 제공
- 환경 변수 없으면 명확한 에러 던지기:
```typescript
const url = import.meta.env.VITE_SUPABASE_URL;
if (!url) {
  throw new Error('VITE_SUPABASE_URL is required in .env file');
}
```

#### 오류 4: Path Alias 동작 안 함

**증상**:
```typescript
import { Tree } from '@domain/entities';
// Error: Cannot find module '@domain/entities'
```

**원인**:
1. `tsconfig.json`에 paths 설정 누락
2. `vite.config.ts`에 alias 설정 누락
3. 둘 중 하나만 설정됨

**대응**:
```typescript
// 1. tsconfig.json 확인
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"]  // ← 있어야 함
    }
  }
}

// 2. vite.config.ts 확인
export default defineConfig({
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain')  // ← 있어야 함
    }
  }
});

// 3. 개발 서버 재시작
npm run dev
```

**검증**:
```bash
# 테스트 파일 생성
echo "import { Tree } from '@domain/entities';" > src/test.ts

# 타입 체크
npm run type-check
# 에러 없으면 성공

# 정리
rm src/test.ts
```

#### 오류 5: Tailwind CSS 스타일 적용 안 됨

**증상**:
```jsx
<div className="bg-blue-500">Hello</div>
// 파란 배경 안 나옴
```

**원인**:
1. `index.css`에 Tailwind directives 누락
2. `tailwind.config.js` 누락
3. PostCSS 설정 누락

**대응**:
```css
/* src/index.css - 확인 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```javascript
// tailwind.config.js - 확인
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",  // ← 경로 확인
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

```javascript
// postcss.config.js - 확인
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**검증**:
```bash
# 브라우저 개발자 도구
# Elements 탭에서 해당 div 확인
# Computed 탭에서 background-color 확인
# rgb(59, 130, 246) 나와야 함 (blue-500)
```

---

### Phase 2: 아키텍처 재정비

#### 오류 6: 순환 의존성 (Circular Dependency)

**증상**:
```
Warning: Circular dependency detected:
src/domain/services/TreeService.ts ->
src/infrastructure/supabase/repositories/SupabaseTreeRepository.ts ->
src/domain/services/TreeService.ts
```

**원인**:
```typescript
// domain/services/TreeService.ts
import { SupabaseTreeRepository } from '@infrastructure/...';  // ❌

// infrastructure/supabase/repositories/SupabaseTreeRepository.ts
import { TreeService } from '@domain/services/TreeService';  // ❌
```

**대응**:
```typescript
// ✅ 올바른 구조

// domain/repositories/ITreeRepository.ts (인터페이스만)
export interface ITreeRepository {
  findByUserId(userId: string): Promise<Tree[]>;
}

// domain/services/TreeService.ts (인터페이스 의존)
import type { ITreeRepository } from '../repositories/ITreeRepository';

export class TreeService {
  constructor(private repository: ITreeRepository) {}
  // ...
}

// infrastructure/supabase/repositories/SupabaseTreeRepository.ts (구현)
import type { ITreeRepository } from '@domain/repositories/ITreeRepository';

export class SupabaseTreeRepository implements ITreeRepository {
  // ...
}

// infrastructure/di/container.ts (조립)
import { TreeService } from '@domain/services/TreeService';
import { SupabaseTreeRepository } from '../supabase/repositories/SupabaseTreeRepository';

const treeRepository = new SupabaseTreeRepository(supabase);
const treeService = new TreeService(treeRepository);
```

**예방**:
- Domain은 절대 Infrastructure import 금지
- Interface로 의존성 역전 (DIP)

#### 오류 7: Zustand store에서 무한 루프

**증상**:
```typescript
// 컴포넌트가 무한 리렌더링
// 브라우저 멈춤
```

**원인**:
```typescript
// ❌ 잘못된 사용
function MyComponent() {
  const store = useLibraryStore();  // 전체 store 구독
  // store 변경 → 리렌더 → store 읽기 → 리렌더 → ...
}
```

**대응**:
```typescript
// ✅ 필요한 state만 선택적 구독
function MyComponent() {
  const trees = useLibraryStore(state => state.trees);  // trees만 구독
  const setTrees = useLibraryStore(state => state.setTrees);

  // trees 변경 시에만 리렌더
}
```

**예방**:
- 항상 selector 함수 사용: `(state) => state.specificValue`
- 전체 store 구독 금지

#### 오류 8: DI Container에서 null 참조

**증상**:
```
TypeError: Cannot read property 'loadUserTrees' of undefined
container.treeService.loadUserTrees(...)
```

**원인**:
```typescript
// ❌ 순서 문제
export const container = {
  treeService: new TreeService(container.treeRepository),  // ← 이 시점에 treeRepository 없음
  treeRepository: new SupabaseTreeRepository(supabase),
};
```

**대응**:
```typescript
// ✅ 순서 조정 또는 lazy 초기화
const supabaseClient = createSupabaseClient();

const treeRepository = new SupabaseTreeRepository(supabaseClient);
const folderRepository = new SupabaseFolderRepository(supabaseClient);

export const container = {
  // Repositories 먼저
  treeRepository,
  folderRepository,

  // Services 나중 (repository 사용)
  treeService: new TreeService(treeRepository),
  folderService: new FolderService(folderRepository),
};
```

**또는**:
```typescript
// Lazy 초기화
class Container {
  private _treeService?: TreeService;

  get treeService(): TreeService {
    if (!this._treeService) {
      this._treeService = new TreeService(this.treeRepository);
    }
    return this._treeService;
  }
}
```

---

### Phase 3: 코드 이식

#### 오류 9: TypeScript 타입 에러 대량 발생

**증상**:
```
src/features/library/components/TreeList.tsx:15:23
Error: Property 'treeData' does not exist on type 'Tree'

(100개 이상의 타입 에러)
```

**원인**:
- JS → TS 변환 시 타입 정의 불완전
- `any` 남발로 타입 체크 우회

**대응 (우선순위)**:
```typescript
// 1순위: 임시로 any 사용 (빌드 통과시키기)
const tree: any = selectedTree;
tree.treeData.nodes.forEach(...);

// 2순위: 점진적으로 정확한 타입으로 교체
const tree: Tree = selectedTree;
if ('treeData' in tree) {
  tree.treeData.nodes.forEach(...);
}

// 3순위: 타입 가드 함수 작성
function isTree(obj: any): obj is Tree {
  return obj && typeof obj.id === 'string' && 'treeData' in obj;
}

if (isTree(selectedTree)) {
  selectedTree.treeData.nodes.forEach(...);
}
```

**예방**:
- 처음부터 interface 정의 완성
- `any` 사용 시 주석으로 TODO 표시
- 점진적으로 any 제거

#### 오류 10: D3 시뮬레이션이 멈춤

**증상**:
```
// 노드가 움직이지 않음
// Force simulation 동작 안 함
```

**원인**:
```typescript
// ❌ useEffect 의존성 배열 문제
useEffect(() => {
  const simulation = createSimulation(nodes, links);
  simulation.on('tick', () => {
    setSimulationNodes([...simulation.nodes()]);
  });
}, []); // ← nodes, links 변경 시 재생성 안 됨
```

**대응**:
```typescript
// ✅ 의존성 배열에 nodes, links 추가
useEffect(() => {
  const simulation = createSimulation(nodes, links);

  simulation.on('tick', () => {
    setSimulationNodes([...simulation.nodes()]);
  });

  return () => {
    simulation.stop();  // cleanup
  };
}, [nodes, links]);  // ← 의존성 추가
```

**예방**:
- ESLint react-hooks/exhaustive-deps 규칙 활성화
- 의존성 배열 경고 무시하지 말기

#### 오류 11: Supabase 데이터 로딩 무한 루프

**증상**:
```
// Network 탭에서 같은 요청이 계속 반복
// GET /trees?user_id=xxx (수백 번)
```

**원인**:
```typescript
// ❌ useEffect 의존성 문제
useEffect(() => {
  container.treeService
    .loadUserTrees(user.id)
    .then(trees => {
      setTrees(trees);  // ← state 변경
    });
}, [trees]);  // ← trees 변경 → 재실행 → trees 변경 → ...
```

**대응**:
```typescript
// ✅ user만 의존성으로
useEffect(() => {
  if (!user) return;

  container.treeService
    .loadUserTrees(user.id)
    .then(setTrees);
}, [user]);  // ← user 변경 시에만 재로딩
```

**예방**:
- State를 의존성 배열에 넣지 말 것
- Setter 함수는 안정적 (React가 보장)

#### 오류 12: 컴포넌트 분할 시 props 누락

**증상**:
```typescript
// LibraryApp에서 TreeList로 분리
// TreeList에서 deleteTree 함수 사용 불가

TypeError: deleteTree is not a function
```

**원인**:
```typescript
// ❌ LibraryApp에서 TreeList로 props 전달 안 함
<TreeList trees={trees} />  // deleteTree 안 넘김
```

**대응**:
```typescript
// ✅ 필요한 모든 props 전달
<TreeList
  trees={trees}
  onDelete={deleteTree}
  onRename={renameTree}
  onSelect={selectTree}
/>

// 또는 Zustand store 직접 사용
function TreeList({ trees }: { trees: Tree[] }) {
  const deleteTree = useLibraryStore(state => state.deleteTree);
  // ...
}
```

**예방**:
- TypeScript interface로 props 명시
- 컴파일러가 누락 알려줌

---

## 기술별 오류 대응

### TypeScript 관련

#### 타입 정의 찾을 수 없음

**증상**:
```
Could not find a declaration file for module 'd3'
```

**대응**:
```bash
npm install --save-dev @types/d3
npm install --save-dev @types/react
npm install --save-dev @types/node
```

#### noUncheckedIndexedAccess 에러

**증상**:
```typescript
const tree = trees[0];  // Type: Tree | undefined
tree.title;  // Error: Object is possibly 'undefined'
```

**대응**:
```typescript
// ✅ 옵셔널 체이닝
const title = trees[0]?.title;

// ✅ Nullish coalescing
const tree = trees[0] ?? defaultTree;

// ✅ 타입 가드
if (trees[0]) {
  trees[0].title;  // OK
}
```

### Vite 관련

#### HMR (Hot Module Replacement) 동작 안 함

**증상**:
```
// 코드 수정해도 브라우저 자동 새로고침 안 됨
```

**대응**:
```bash
# 1. 개발 서버 재시작
npm run dev

# 2. 캐시 삭제
rm -rf node_modules/.vite

# 3. 완전 재빌드
npm run build
npm run dev
```

### Zustand 관련

#### State 변경이 반영 안 됨

**증상**:
```typescript
setTrees([...newTrees]);
// UI에 변경 안 보임
```

**대응**:
```typescript
// ✅ 불변성 확인 (새 배열 생성)
setTrees([...newTrees]);  // OK

// ❌ 직접 수정 (Zustand 감지 못함)
trees.push(newTree);  // NG
setTrees(trees);  // 참조가 같아서 업데이트 안 됨
```

### Supabase 관련

#### CORS 에러

**증상**:
```
Access to fetch at 'https://xxx.supabase.co' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**대응**:
```bash
# Supabase Dashboard에서 설정
1. Project Settings → API
2. "Allowed origins" 확인
3. http://localhost:3000 추가
```

#### Auth 세션 만료

**증상**:
```
// 새로고침 후 로그아웃됨
```

**대응**:
```typescript
// AuthProvider에서 persistSession 확인
createClient(url, key, {
  auth: {
    persistSession: true,  // ← true여야 함
    autoRefreshToken: true,
  }
});
```

---

## 롤백 전략

### 레벨 1: 파일 단위 롤백

```bash
# 특정 파일만 복구
git checkout HEAD -- src/path/to/file.ts
```

### 레벨 2: 커밋 단위 롤백

```bash
# 마지막 커밋 취소 (변경사항 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (변경사항 삭제)
git reset --hard HEAD~1
```

### 레벨 3: 태그로 롤백

```bash
# 백업 태그 목록 확인
git tag | grep backup

# 특정 태그로 완전 복구
git reset --hard backup-before-vite-20251018
```

### 레벨 4: 새 브랜치에서 재시작

```bash
# 현재 작업 임시 저장
git stash

# 이전 안정 버전에서 새 브랜치
git checkout -b web-refactor-v2 backup-phase1-complete

# 작업 다시 시작
```

---

## 긴급 복구 가이드

### 상황 1: 빌드 완전 실패, 원인 모름

```bash
# 1. 패닉하지 말기
# 2. 마지막 성공 커밋으로 복구
git log --oneline -10
git reset --hard <마지막-성공-커밋-해시>

# 3. 확인
npm run build
# 성공하면 OK

# 4. 실패한 변경사항 다시 시도
# 이번엔 한 줄씩 신중하게
```

### 상황 2: 데이터베이스 데이터 손상

```bash
# Supabase는 자동 백업 제공
# Supabase Dashboard → Database → Backups
# 최근 백업에서 복구
```

### 상황 3: node_modules 꼬임

```bash
# 완전 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시도 삭제
rm -rf node_modules/.cache
rm -rf node_modules/.vite
```

### 상황 4: Git 충돌 해결 실패

```bash
# 병합 취소
git merge --abort

# 또는 리베이스 취소
git rebase --abort

# 깨끗한 상태로 되돌리기
git reset --hard HEAD
```

---

## 예방 체크리스트

작업 전 반드시 확인:

```
□ Git에 모든 변경사항 커밋됨
□ npm run build 성공
□ npm run test 통과
□ 백업 태그 생성 완료
□ .env 파일 백업 완료
□ 작업 계획 명확함
□ 롤백 방법 숙지함
□ 충분한 시간 확보 (중단 시 중간 저장 가능)
```

작업 후 반드시 확인:

```
□ npm run type-check 에러 없음
□ npm run build 성공
□ npm run test 통과
□ npm run dev 실행됨
□ 브라우저에서 기능 동작 확인
□ 콘솔 에러 없음
□ Git 커밋 완료
□ 커밋 메시지 명확함
```

---

## 도움 요청 시 제공할 정보

문제 발생 시 다음 정보 수집:

```bash
# 1. 환경 정보
node --version
npm --version
git branch
git log --oneline -5

# 2. 에러 메시지
# 전체 에러 스택 복사

# 3. 재현 단계
# 1. npm run dev
# 2. 브라우저 http://localhost:3000
# 3. 로그인 클릭
# 4. 에러 발생

# 4. 스크린샷
# 에러 화면 캡처

# 5. 관련 코드
# 문제 발생 파일의 해당 부분 복사
```

---

**다음 문서**: [WEB_MIGRATION_CHECKLIST.md](./WEB_MIGRATION_CHECKLIST.md)
