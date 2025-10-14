# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
JARVIS is a React-based hierarchical tree visualization application that runs on both Electron (desktop) and Web platforms. It features AI-powered chat, tree visualization, and a library management system with Supabase authentication.

## Development Commands

### Web Platform
```bash
# Start web development server
npm run start:web          # or npm run dev

# Build for web production
npm run build:web

# Preview web build locally
npm run preview:web

# Run web smoke tests
npm run smoke:web

# Verify environment variables
npm run check:env
```

### Electron Platform
```bash
# Start Electron in development mode
npm run electron:dev

# Start renderer process only
npm run start:renderer

# Start Electron main process (requires renderer on port 3000)
npm run start:electron

# Build Electron application
npm run electron:build

# Run Electron smoke tests
npm run electron:smoke
```

### General
```bash
# Run tests
npm test

# Build production bundle
npm run build

# Eject from Create React App (use with caution)
npm run eject
```

## Architecture

### Platform Detection (`src/shared/utils/platform.js`)
The codebase uses a runtime detection system to handle platform-specific logic:
- `getRuntime()`: Returns 'electron', 'web', or 'unknown'
- `isElectron()`: Boolean check for Electron environment
- `isWeb()`: Boolean check for web environment
- `getRuntimeLabel()`: Returns normalized runtime label (treats 'unknown' as 'web')

Detection hierarchy:
1. Environment variables (`REACT_APP_PLATFORM`, `PLATFORM`)
2. Window object (`window.jarvisAPI`, `window.process?.versions?.electron`)
3. Process object (`process?.versions?.electron`)
4. User agent string

### Application Modes
The app supports two modes controlled via URL parameter `?mode=`:
- **library** (default for web): Full library interface with tree management
- **widget**: Lightweight tree visualization (Electron only)

Mode resolution:
1. Requested mode from URL parameter
2. Runtime validation against allowed modes
3. Fallback to default mode with URL normalization

### Feature Structure (`src/features/`)
Features are organized by domain with consistent internal structure:

```
features/
├── chat/           # AI-powered chat interface
│   ├── components/ # React components
│   ├── constants/  # Chat-specific constants
│   ├── hooks/      # Custom React hooks
│   └── models/     # Data models
├── library/        # Main library management
│   ├── ui/         # UI components
│   ├── constants/  # Library constants
│   ├── hooks/      # Library-specific hooks
│   ├── services/   # Business logic
│   ├── state/      # State management
│   └── utils/      # Helper functions
├── tree/           # Hierarchical tree visualization
│   ├── ui/         # Tree UI components
│   ├── constants/  # Tree configuration
│   ├── hooks/      # Tree-specific hooks
│   ├── services/   # Tree business logic
│   ├── state/      # Tree state management
│   ├── utils/      # Tree utilities
│   └── __tests__/  # Unit tests
└── treeCanvas/     # Canvas-based tree rendering
```

### Shared Infrastructure (`src/shared/`)
Common functionality used across features:

```
shared/
├── ui/             # Reusable UI components
│   ├── shadcn-io/  # shadcn/ui component library
│   └── ai/         # AI-related UI components
├── hooks/          # Global React hooks
│   ├── SettingsContext.js    # Settings management with platform guards
│   └── useSupabaseAuth.js    # Authentication with platform-specific OAuth
├── utils/          # Utility functions
│   └── platform.js           # Platform detection utilities
└── constants/      # Global constants
```

### Infrastructure Layer (`src/infrastructure/`)
Platform-specific integrations:

```
infrastructure/
├── ai/
│   └── agentClient.js      # AI service client
├── supabase/
│   ├── mappers/            # Data mappers
│   ├── repositories/       # Data access layer
│   └── services/           # Supabase business logic
└── electron/
    └── bridges/            # Electron IPC bridges
```

### Electron Structure (`electron/`)
Desktop application implementation:

```
electron/
├── main/               # Main process modules
│   ├── index.js        # Entry point with env loading
│   └── bootstrap/      # Application bootstrap
├── preload/            # Preload scripts for renderer IPC
├── services/           # Electron-specific services
├── tray/               # System tray integration
├── accessibility.js    # Accessibility API bridge
├── clipboard.js        # Clipboard operations
└── logs.js             # Logging utilities
```

Environment loading priority (`.env` files):
1. `.env`
2. `.env.local`
3. `.env.electron`
4. `.env.electron.local`

### State Management
- **Context API**: Used for global state (Settings, Theme, Auth)
- **Local State**: Component-level state with hooks
- Feature-specific state managers in `features/*/state/`

### Authentication Flow
Platform-specific authentication via Supabase:
- **Electron**: Uses Electron OAuth bridge with custom protocol handlers
- **Web**: Standard OAuth redirect flow with dynamic URL configuration
- Redirect URLs configured via environment matrix (local/preview/production)
- OAuth callback handled at `/auth/callback` route

## Development Guidelines

### Three-Phase Development Process
This codebase follows a mandatory three-phase workflow defined in `.cursor/rules/sbs.mdc`:

1. **Phase 1: Codebase Exploration & Analysis**
   - Systematically discover all relevant files and modules
   - Document coding conventions and architecture patterns
   - Identify framework/library usage patterns

2. **Phase 2: Implementation Planning**
   - Create detailed implementation roadmap
   - Define specific tasks and acceptance criteria
   - Break complex tasks into manageable steps

3. **Phase 3: Implementation Execution**
   - Implement following the plan
   - Verify all acceptance criteria
   - Ensure code adheres to established conventions

### Clean Code Principles (`.cursor/rules/cleancode.mdc`)
Core principles enforced:
- **DRY, KISS, YAGNI, SOLID**: Follow rigorously
- **Functions**: Max 20 lines (prefer <10), max 3 parameters
- **Naming**: Intention-revealing, classes as nouns, methods as verbs
- **Testing**: TDD when possible, AAA pattern, >80% coverage
- **Cyclomatic complexity**: <10
- **Max nesting depth**: 3 levels

### Platform Guards
Always wrap platform-specific code:
```javascript
import { isElectron, isWeb } from 'shared/utils/platform';

if (isElectron()) {
  // Electron-specific code
  window.jarvisAPI.someElectronFeature();
}

if (isWeb()) {
  // Web-specific code or alternative UX
  showWebAlternativeUI();
}
```

### Component Lazy Loading
Use React lazy loading to prevent platform-specific code from bundling:
```javascript
const WidgetShell = lazy(() => import('features/tree/ui/WidgetShell'));
```

### Environment Variables
- Web builds use `REACT_APP_*` prefix
- Electron loads multiple `.env` files in priority order
- Always add new variables to `.env.example` files
- Run `npm run check:env` before deployment

### Testing
- Unit tests in `__tests__/` directories
- Test files named `*.test.js`
- Platform-specific tests should use platform guards
- Run full test suite before commits

## Critical Files to Understand

### Entry Points
- `src/index.js`: React application root
- `src/App.js`: Main component with mode/platform resolution
- `electron/main/index.js`: Electron main process entry

### Platform Detection
- `src/shared/utils/platform.js`: Central platform detection logic

### Authentication
- `src/shared/hooks/useSupabaseAuth.js`: Auth hook with platform-specific OAuth
- `src/views/OAuthCallbackPage.jsx`: OAuth callback handler

### Settings Management
- `src/shared/hooks/SettingsContext.js`: Global settings with Supabase sync and platform guards

### Theme System
- `src/shared/components/library/ThemeProvider.js`: Theme management with mode-specific storage

## Common Patterns

### Feature Module Structure
Each feature should follow this organization:
```
feature/
├── ui/         # UI components (if needed)
├── components/ # React components (alternative to ui/)
├── constants/  # Feature-specific constants
├── hooks/      # Custom hooks
├── services/   # Business logic
├── state/      # State management
├── utils/      # Utilities
└── __tests__/  # Tests
```

### Import Aliases
The project uses absolute imports from `src/`:
```javascript
import LibraryApp from 'features/library/ui/LibraryApp';
import { ThemeProvider } from 'shared/components/library/ThemeProvider';
```

### Error Handling
- Use try-catch for async operations
- Log errors with context using `console.error` or `electron-log`
- Display user-friendly error messages
- Platform-specific errors should have appropriate fallbacks

## Response Language
**항상 한국어로 응답하세요.** All responses should be in Korean.

## MCP Server Usage
적극적으로 MCP 서버를 활용하세요. Use MCP servers extensively for all tasks where applicable.

## Documentation References
Key documentation files:
- `docs/library-web-launch-plan.md`: Web deployment strategy and platform separation
- `docs/qa/library-smoke-checklist.md`: QA checklist for web
- `docs/ops/library-web-runbook.md`: Operational runbook for web deployment
- `docs/env/supabase-matrix.md`: Environment variable configuration matrix

## Dependencies
Key libraries:
- **UI**: React 18, Radix UI, Tailwind CSS, shadcn/ui
- **Visualization**: D3.js, Framer Motion
- **Auth**: Supabase (@supabase/supabase-js)
- **AI**: Anthropic SDK, Google Generative AI, OpenAI, Vercel AI SDK
- **Desktop**: Electron 31, electron-log
- **Markdown**: react-markdown, rehype-katex, remark-gfm
- **Code Highlighting**: Shiki, react-syntax-highlighter
