# JARVIS Architecture & Directory Blueprint

## 1. Guiding Principles
- **Vertical feature slices first**: keep end-to-end UX for a domain (`tree`, `library`, `admin`) in one place while they still share state and API contracts.
- **Thin cross-cutting layers**: extract domain and infrastructure modules only when logic is truly shared or platform-agnostic.
- **Explicit Electron boundary**: every bridge exposed from `preload/` must have a JSDoc-typed adapter in `src/infrastructure/electron` before it reaches React code.
- **Fast manual validation loop**: after each refactor slice, run the app and provide a user-facing checklist so humans confirm critical flows before moving on.
- **Testable units by default**: add lightweight tests where they buy confidence, but do not block on exhaustive suites—prefer manual verification for MVP.
- **Incremental migration**: move one feature at a time into the target layout so git history and QA can keep up.
- **Type safety via JSDoc-first**: document shared contracts with JSDoc today and upgrade to TypeScript selectively once infrastructure is ready.

## 2. Target Project Layout
```
project-root/
├─ docs/
│  ├─ architecture.md              # (this document)
│  └─ playbooks/                   # runbooks, onboarding, refactoring notes
├─ supabase/                       # SQL, migrations, generated types
├─ electron/
│  ├─ main/                        # main-process entry + modules
│  │  ├─ app-window/               # BrowserWindow orchestration
│  │  ├─ auth/                     # OAuth callback server & deep links
│  │  ├─ ipc-handlers/             # register{Agent,Settings,Logs,...}
│  │  ├─ llm/                      # OpenAI integration (pure Node modules)
│  │  ├─ settings/                 # persistent settings store
│  │  └─ tray/                     # tray + hotkey managers
│  └─ preload/
│     ├─ index.js                  # exposes bridges via contextBridge
│     └─ channels/                 # narrow IPC surface definitions
├─ scripts/                        # build/test/smoke automation
├─ public/                         # CRA static assets
├─ assets/                         # shared images, SVG, fonts
├─ src/
│  ├─ index.js
│  ├─ App.js
│  ├─ app/                         # shell (routing, providers, layout chrome)
│  │  ├─ providers/
│  │  ├─ routing/
│  │  └─ styles/
│  ├─ features/
│  │  ├─ tree/
│  │  │  ├─ ui/                    # React components for tree experience
│  │  │  ├─ state/                 # Zustand/Redux or custom hooks
│  │  │  ├─ services/              # orchestration + use cases
│  │  │  ├─ adapters/              # mapping to domain/infrastructure
│  │  │  └─ __tests__/
│  │  ├─ library/
│  │  │  ├─ ui/
│  │  │  ├─ state/
│  │  │  ├─ services/
│  │  │  ├─ adapters/
│  │  │  └─ __tests__/
│  │  └─ admin/
│  │     ├─ ui/
│  │     ├─ state/
│  │     ├─ services/
│  │     ├─ adapters/
│  │     └─ __tests__/
│  ├─ domain/                      # UI-free business rules (opt‑in per feature)
│  │  ├─ tree/
│  │  │  ├─ models/
│  │  │  └─ services/
│  │  ├─ library/
│  │  └─ common/                   # shared value objects, errors, validators
│  ├─ infrastructure/
│  │  ├─ electron/
│  │  │  ├─ bridges/               # JSDoc-typed wrappers around preload channels
│  │  │  └─ storage/               # local FS usage inside renderer
│  │  ├─ supabase/
│  │  │  ├─ client.js              # ensureSupabase + init
│  │  │  ├─ repositories/          # treeRepository, folderRepository …
│  │  │  └─ mappers/
│  │  └─ ai/
│  │     └─ openai/                # shared prompt builders, streaming utils
│  ├─ shared/
│  │  ├─ ui/                       # shadcn-based primitives
│  │  ├─ components/               # cross-feature widgets
│  │  ├─ hooks/
│  │  ├─ utils/
│  │  └─ constants/
│  └─ testing/
│     ├─ mocks/
│     └─ utils/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ config/
│  ├─ env/
│  ├─ lint/
│  ├─ jest/
│  └─ electron-builder/
├─ .env.example
├─ package.json
├─ jsconfig.json
└─ README.md
```

### Key Differences From Current Layout
1. `src/features/<domain>` replaces the current mix of `components/`, `services/`, `controllers/`, and `views/`, giving each domain ownership of its UI + orchestration.
2. `domain/` and `infrastructure/` exist but stay lean until we have logic worth hoisting out of a single feature. They are optional during MVP but give us a clear promotion path.
3. Electron code is split into `main/` and `preload/` submodules so OAuth, logging, hotkeys, etc. stop living in a single file.
4. Shared view primitives must go through `shared/ui` (wrapping shadcn) and `shared/components`. Direct imports from `components/ui` disappear.
5. A root-level `tests/` directory houses Jest/Vitest, Playwright, and smoke specs so we can separate unit vs. integration vs. e2e while still allowing `features/**/__tests__` for co-located cases.

## 3. Layer Responsibilities
| Layer | Responsibility | Notes |
|-------|----------------|-------|
| **app** | bootstraps providers (theme, auth, settings), routing, and top-level layouts | should stay framework-centric (React specifics) |
| **features** | end-to-end slices handling UI events, local state, and coordination | every feature exports a public `index.js` to keep imports stable |
| **domain** | pure logic, state machines, and policies that survive outside React/Electron | only migrate modules here once they have test coverage |
| **infrastructure** | outer-world adapters (Supabase, IPC, OpenAI, file system) | all IPC calls flow through JSDoc-typed bridges so tests can mock them easily |
| **shared** | design system + cross-feature utilities | refuse feature-specific logic here; prefer promotion once shared |
| **tests** | scenario-driven suites (integration/e2e) plus helpers | reuse mocks from `src/testing` to avoid duplication |

## 4. Electron Boundary
- `electron/preload/index.js` exports the minimum set of channels.
- Renderer code must consume them via `src/infrastructure/electron/bridges/<name>Bridge.js` to keep mocking straightforward.
- Each IPC handler in `electron/main/ipc-handlers` lives in its own module and registers itself via a `registerXyzHandlers(ipcMain, services)` helper. 현재 구현된 모듈은 `agent`, `system`, `settings`, `logs`, `window`, `library`, `admin`으로 구성되며, 기존 채널 명(`agent:askRoot`, `window:toggleVisibility`, `auth:oauth-callback` 등)은 변경되지 않는다.
- `registerIpcHandlers`는 메인 엔트리(`electron/main/index.js`)에서 단일 호출로 IPC 모듈을 초기화하며, `tray`/`globalShortcut`/`accessibility` 초기화와 충돌하지 않도록 의존성을 명시적으로 주입한다.

## 5. Testing & Validation Strategy
- Use lightweight unit tests where they provide clear value (e.g., pure utilities, domain rules).
- Prefer fast manual verification for complex UI flows: after each slice, run the Electron build and confirm behaviour using the checklists defined in the refactor plan.
- Maintain smoke automation (`npm run electron:smoke`) as a safety net, but do not gate changes on exhaustive coverage during MVP.
- Test utilities (factories, mock responses) live under `src/testing/` so both RTL and manual demo data stay consistent.

## 6. Migration Playbook (Incremental)
1. **Stabilise contracts**: define shared contracts via JSDoc typedefs today and introduce TypeScript interfaces once tooling is in place.
2. **Extract feature module**: pick one domain (e.g., `tree`) and move existing components + services into `src/features/tree`, introducing adapters for Supabase/IPC.
3. **Introduce bridges**: wrap every `window.jarvisAPI.*` call in `infrastructure/electron/bridges` with dependency injection into feature services.
4. **Promote pure logic**: once behaviour is covered by lightweight tests or proven via checklist runs, migrate the business logic portion into `src/domain/<feature>`.
5. **Align tests**: co-locate any focused unit tests beside the new modules and create integration tests only when manual checks are too costly.
6. **Repeat per feature**: once `tree` is stable, repeat for `library` and `admin`, refactoring shared pieces into `shared/` or `domain/common/` as patterns emerge.

## 7. MVP Guardrails
- Keep the codebase JavaScript-first while slices stabilise; document shapes with JSDoc for now and only promote modules to TypeScript once the tooling and build scripts are ready.
- Each refactor ships with a user-facing validation script (manual checklist) plus optional screenshots/log bundles.
- Avoid creating empty directories—only spin up `domain/` or `infrastructure/` subfolders when the first real module moves in.

## 8. Manual Validation Loop
1. Complete a small refactor slice (≤1 hour of work).
2. Build/run via `npm run electron:dev` or relevant script.
3. Follow the feature-specific checklist (see `docs/refactor-plan.md`) with the user, confirming UI flows and noting any regressions.
4. Record findings in the PR description or task notes before moving to the next slice.

---
This blueprint balances the long-term layered architecture with MVP pragmatism: we grow vertical slices first, rely on tight human feedback loops, and promote well-tested logic into domain/infrastructure as it matures.
