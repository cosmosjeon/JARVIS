# Repository Guidelines

## Project Structure & Module Organization
This repository pairs a React renderer with an Electron shell. Core UI code lives in `src/`, with reusable widgets in `src/components`, view-level compositions in `src/views`, and shared hooks/utilities under `src/hooks`, `src/lib`, and `src/utils`. Visualization assets and theme tokens live in `src/assets` and `src/theme`. Automated tests reside in `src/__tests__`, while Electron process logic is grouped in `electron/` (IPC services, preload, tray integration). Supabase configuration and SQL assets live under `supabase/`, and high-level process documentation sits in `vooster-docs/`.

## Build, Test, and Development Commands
- `npm install`: install all renderer and Electron dependencies.
- `npm run dev`: launch the Create React App dev server for quick UI iteration.
- `npm run electron:dev`: start renderer and Electron shells together for end-to-end desktop testing.
- `npm run build`: produce an optimized production bundle consumed by Electron packaging.
- `npm run electron:smoke`: execute smoke checks defined in `scripts/smoke/` to validate core flows.

## Coding Style & Naming Conventions
Write modern React (v18) functional components with hooks, using 2-space indentation and semicolons. Name components and files that export components in `PascalCase`, shared helpers in `camelCase`, and constants in `UPPER_SNAKE_CASE`. Keep components focused, extracting logic into hooks or utilities when they exceed a single responsibility. Tailwind utility classes are merged with `tailwind-merge`; prefer co-located CSS modules only when necessary.

## Testing Guidelines
Jest with React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`) powers unit and integration coverage. Place tests alongside the features they exercise inside `src/__tests__`, name files using `*.test.js`, and follow the `should_<behavior>_when_<context>` convention. Aim for ≥80% coverage, mock Supabase or Electron bridges as needed, and run `npm test -- --watch=false` before submitting.

## Commit & Pull Request Guidelines
Write concise, imperative commit messages (e.g., “Add node memo dialog toggles”), optionally localized as shown in recent history. Reference related issues with `Fixes #ID` where applicable. Pull requests must summarize intent, list validation (tests, smoke runs), and include UI screenshots or screen captures for visual changes. Keep PRs focused and request reviews from domain owners promptly.

## Agent Workflow Expectations
Agents interacting with this repo must follow the three-phase delivery process and clean-code standards described in `vooster-docs/`. Always document analysis, planning, and validation steps when contributing to maintain a predictable automation workflow.
