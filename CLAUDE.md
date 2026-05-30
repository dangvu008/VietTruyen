# VietTruyen - Claude Code Guidelines

## Optimization & Token Saving
- **Disable Large Contexts**: Limit context to 200k tokens unless performing full-repo architectural refactoring.
- **Prune Inputs**: Use text-based tools (e.g., `grep`, `cat` for specific lines) over reading entire files.
- **PDF Handling**: Always convert PDFs to text using `pdftotext` before reading. Avoid rendering as images.
- **Web Browsing**: Prefer accessibility tree snapshots or `WebFetch` text-only views over full visual page renders.

## Subagent Delegation
- Offload mechanical tasks (e.g., translation string formatting, simple tests) to cheaper subagents (Haiku/Sonnet).
- Parent agent maintains overall architectural consistency and logic boundaries.

## VietTruyen Architecture & Code Maxims
- **Domain Bounded**: Keep UI and DB logic strictly separated. No mixed layers.
- **File Limits**: Prefer micro-files (100-250 lines). Avoid creating or growing files beyond 350 lines. Split them.
- **Semantic Naming**: Files must use `verb_noun_condition.ext` naming pattern. No generic files like `utils.js` or `main.js`.
- **Strict Types**: Always enforce strict TypeScript contracts. Avoid using `any` completely.
- **Header Docs**: Every file must contain a header comment:
  `/** File: X | Purpose: Y | Layer: Z | Domain: W | Deps: U */`
- **Memory Systems**: Integrate memory extraction logic via `src/lib/memory`. Do not mix it with legacy logic under `src/core`.

## UI & Styling Standards
- Use Vanilla CSS for maximum flexibility. Do not use TailwindCSS unless explicitly requested.
- Ensure all interactive elements have unique, descriptive IDs for browser testing.
- UI elements must support 4 interactive states and adhere to WCAG AA guidelines.
