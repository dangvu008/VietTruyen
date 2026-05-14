# Build Baseline — 2026-05-13

> Captured before Wave 1 of `plans/optimization-plan.md`
> Full log: `plans/baseline/build-2026-05-13.txt`
> Vite version + manualChunks already in place (`vite.config.ts:37`)

## Top-line numbers

| Chunk | Raw | Gzip | Note |
|---|---|---|---|
| `index-*.js` (entry) | **323.43 kB** | **97.74 kB** | Main app entry — smaller than plan assumed (was guessed ~875 kB) |
| `vendor-docs` | **812.99 kB** | 219.08 kB | ⚠️ Heaviest single chunk — `mammoth`, `docx`, `@llamaindex/liteparse`, `jszip` |
| `vendor-pdf` | 453.37 kB | 134.70 kB | `pdfjs-dist` — only loaded on document import paths |
| `use_template_store` | **186.36 kB** | 77.11 kB | ⚠️ Suspiciously large for a Zustand store — likely bundles template data |
| `vendor-supabase` | 176.02 kB | 46.17 kB | `@supabase/supabase-js` |
| `WriterPage` | 154.12 kB | 49.14 kB | Heaviest route chunk |
| `vendor-react` | 137.57 kB | 44.58 kB | React + ReactDOM + Zustand |
| `CreationChatPage` | 121.43 kB | 35.26 kB | |
| `chapter_writer_ai` | 77.09 kB | 29.37 kB | |
| `vendor-icons` | 71.03 kB | 14.99 kB | `lucide-react` |

## Warnings observed

- 3 chunks > 600 kB minified (Vite warning threshold): `vendor-docs`, `vendor-pdf` (only over when raw), `use_template_store` (below threshold)
- No "mixed static and dynamic import" warnings logged in this run — earlier note about `supabase_client.ts` may have already been fixed by current manualChunks config

## Revised targets for Wave 1 + chunk tuning

Original plan said "main ≤ 400 kB gzipped" — already met (98 kB gzip). The bottlenecks are different:

| Metric | Baseline | Revised Target | Rationale |
|---|---|---|---|
| Main entry (`index-*.js`) gzip | 97.74 kB | ≤ 80 kB | Modest tightening; needs Wave 1 subscription slice fix to verify |
| `vendor-docs` raw | 812.99 kB | ≤ 600 kB (under warning threshold) | Investigate tree-shaking opportunities for `mammoth`/`docx` |
| `vendor-pdf` raw | 453.37 kB | unchanged | `pdfjs-dist` is hard to shrink; ensure it's lazy-loaded |
| `use_template_store` raw | 186.36 kB | ≤ 50 kB | Template data should live in JSON, not in JS chunk |
| Chunks > 600 kB | 1 (`vendor-docs`) | 0 | Or document why each remaining is unavoidable |

## Observations worth a follow-up task

1. **`use_template_store` is too big.** A store should not be 186 kB. Likely the template seed/library data is imported statically. Worth splitting data to `/public` JSON or lazy import.
2. **`vendor-docs` is 1 MB raw.** Whether all 4 packages (`mammoth`, `docx`, `@llamaindex/liteparse`, `jszip`) need to be in the same chunk — and whether they're loaded only when user opens import/export flow — needs checking.
3. **`index-CTx8QKEz.js`** at 323 kB raw is not the main entry duplicated — it's the entry. Reasonable for an app this size.
