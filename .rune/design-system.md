# VietTruyen Design System

Last Updated: 2026-04-19
Platform: web desktop workspace
Domain: AI-native writing workspace
Mood: confident

## Design Direction

- Global shell is a control surface, not a marketing page.
- Project workspace is a focused production environment, not a dashboard inside a dashboard.
- Layout must separate `global orchestration` from `project execution`.
- Each screen should answer one question clearly:
  - Dashboard: "What should I do next?"
  - Projects: "Which project do I open or manage?"
  - Project tabs: "What work am I doing right now?"

## Visual Rules

- Palette: warm dark neutrals with sand accent already established in the product.
- Typography: keep existing Manrope/script pairing; avoid adding new decorative fonts.
- Emphasis goes to hierarchy and sequencing, not extra chrome.
- Use cards for grouped actions only; do not wrap every section in identical cards.

## IA Rules

- Canonical global tabs only: `dashboard`, `projects`, `adaptation`, `community`, `ai-settings`.
- Canonical project tabs only: `bible`, `characters`, `world`, `outline`, `writer`, `chapters`, `review`, `export`.
- Remove legacy entry points from the primary flow.
- Surface one recommended next step per project instead of multiple competing CTAs.

## Anti-Patterns

- Do not show a project dashboard and a page-level workspace in the same viewport.
- Do not duplicate navigation inside content panels.
- Do not place community analytics on the dashboard if `community` already owns that surface.
- Do not make users guess the next tab; always expose a recommended next action.
