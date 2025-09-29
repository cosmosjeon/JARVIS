# Shadcn UI Migration Log

## 2025-09-29 — Core setup refresh
- Added `components.json` to mirror shadcn CLI defaults for this CRA workspace.
- Rebased design tokens in `src/index.css` around the white background / black surface mandate while keeping dark mode parity.

## Component migration map
| Area | Legacy module | Target shadcn primitives | Status | Notes |
| --- | --- | --- | --- | --- |
| Assistant chat | src/components/ChatWindow.js | dialog, card, scroll-area, textarea, button, badge, avatar, dropdown-menu, tooltip, command, separator, skeleton | Complete | Rebuilt AI workspace with shadcn primitives, white/black token rules, and quick prompt tooling. |
| Library workspace | src/components/library/**/* (excl. TreeCanvas.js, WidgetTreeViewer.js) | card, scroll-area, button, badge, dropdown-menu, tooltip | Complete | Reskinned library shell with token-driven sidebar, two-panel layout, and shadcn interactions while keeping node tree untouched. |

## 2025-09-29 — Conversational AI workspace
- Introduced the shadcn.io AI two-panel experience for `ChatWindow`, blending conversation history and live chat.
- Added prompt library command palette, tooltip actions, copy handling, and skeleton loading with the new token palette.
- Tuned textarea composer and quick prompts to obey the white background / black surface guideline.

## 2025-09-29 — Library workspace modernization
- Rebuilt `LibraryApp` navigation and main surface with shadcn cards, scroll areas, and badges across a Notion-inspired palette.
- Converted library QA/conversation panels and Voran Box manager to use shared tokens, removing bespoke slate-based styling.
- Wired drag/drop affordances, theme switcher, and soft hover/active states into the sidebar + drop zone layout.
