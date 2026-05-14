# Navigation Surface Audit (Wave 4a)

> Date: 2026-05-13
> Decision gate D-Wave4: **Dual registries canonical** (`global_page_registry.tsx` + `project_page_registry.tsx`).
> Method: `git grep` for live imports / render references; cross-checked against `src/App.tsx`.

## Classification

| File | Status | Evidence | Migration target |
|---|---|---|---|
| `src/app/global_page_registry.tsx` | **Canonical** | `App.tsx:44` imports `renderGlobalPage` | — |
| `src/app/project_page_registry.tsx` | **Canonical** | `App.tsx:45` imports `renderProjectPage` | — |
| `src/types/navigation.ts` | **Canonical** | `AppShell`, `GlobalTabId`, `ProjectTabId`, `AnyTabId` consumed by 20+ files | — |
| `src/app/page_registry.tsx` | **Canonical** | Lazy-loader registry that both registries depend on. Some exports go dead with `render_active_page.tsx` removal — pruning below. | Trim unused `Lazy*` exports |
| `src/app/render_active_page.tsx` | **Dead** | No live caller. `renderActivePage`, `isTabId`, `toTabId`, `isStandaloneTab` returned zero grep hits outside the file itself. | Delete |
| `src/components/layout/TopMenu.tsx` | **Dead component, partial type still alive** | `<TopMenu>` never rendered; `TabId` type is type-only imported by `render_active_page.tsx` (dead), `EtherealLayout.tsx` (dead), `StudioPage.tsx` (consumed only by `render_active_page.tsx`). | Delete after StudioPage retires; or move `TabId` to `types/navigation.ts` if anything else keeps it. |
| `src/components/layout/EtherealLayout.tsx` | **Dead** | `EtherealLayout` default export not imported anywhere. Only string reference is a comment in `AiAssistant.tsx`. | Delete |
| `src/components/layout/GlobalSidebar.tsx` | **Canonical** | Rendered by `GlobalShell.tsx`. Exports `SettingsTabId` consumed by `global_page_registry.tsx` and `App.tsx`. | — |
| `src/components/pages/StudioPage.tsx` | **Dead page** | Only consumer is `LazyStudioPage` → `render_active_page.tsx`. Tab `'studio'` not present in new shell tab union. | Delete |
| `src/components/pages/BrainstormPage.tsx` | **Dead page** | Only consumer is `LazyBrainstormPage` → `render_active_page.tsx`. | Delete |
| `src/components/pages/AnalyticsPage.tsx` | **Dead page** | Only consumer is `LazyAnalyticsPage` → `render_active_page.tsx`. | Delete |
| `src/components/pages/MemoryPage.tsx` | **Dead page** | Only consumer is `LazyMemoryPage` → `render_active_page.tsx`. | Delete |
| `src/components/pages/ForeshadowingPage.tsx` | **Dead page** | Only consumer is `LazyForeshadowingPage` → `render_active_page.tsx`. | Delete |
| `src/components/pages/ChuaCanonPage.tsx` | **Dead page** | Only consumer is `LazyChuaCanonPage` → `render_active_page.tsx`. | Delete |
| `src/components/pages/WritingWizardPage.tsx` | **Dead page** | Only consumer is `LazyWritingWizardPage` → `render_active_page.tsx`. | Delete |
| `src/components/pages/GenreLibraryPage.tsx` | **Dead page** | Only consumer is `LazyGenreLibraryPage` → `render_active_page.tsx`. | Delete |

## Removal order (Wave 4c)

1. Delete `render_active_page.tsx`.
2. Delete `EtherealLayout.tsx`, `TopMenu.tsx`.
3. Delete the dead `*Page.tsx` files listed above.
4. Remove dead `Lazy*` exports from `page_registry.tsx`.
5. Final grep + build + test gate.

## Caveats

- `WriterPage` is still canonical (used by both `'writer'` and `'review'` tabs in `project_page_registry`).
- `ChaptersPage`, `BiblePage`, `CharactersPage`, `WorldPage`, `OutlinePage`, `StoryMapPage`, `ExportPage` are canonical (referenced by `project_page_registry`).
- `DashboardPage`, `ProjectsPage`, `AdaptationPage`, `CommunityPage`, `AiSettingsPage`, `CreationChatPage`, `TemplateManagerPage` are canonical (referenced by `global_page_registry`).
- If anyone re-introduces a dead tab id literal in routing state (e.g., from persisted session storage of a previous build), it falls through to default — no runtime crash, but UX is silent. Mitigated by `default` clauses in both registries.
