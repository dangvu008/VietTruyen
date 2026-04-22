# PILOT-001 — Assistant Handoff V2

Objective:
Lam cho handoff tu `AiAssistant` sang page dich khong chi prefill field, ma con giu va hien duoc `clarifiedBrief` de user thay ro AI dang handoff dieu gi.

Current State:
- Stack: React 18 + TypeScript + Zustand + Vite + Tauri.
- Entry points:
  `src/components/shared/AiAssistant.tsx`
  `src/store/use_assistant_session_store.ts`
  `src/components/pages/WriterPage.tsx`
  `src/components/pages/BiblePage.tsx`
  `src/components/pages/CharactersPage.tsx`
  `src/components/pages/OutlinePage.tsx`
- Existing constraints:
  `draftPayload` da duoc set/consume.
  `clarifiedBrief`, `currentGoal`, `hasAvailableHandoff` da ton tai trong store nhung chua duoc su dung o UI page.
  Handoff route hien tai da chay cho `writer`, `bible`, `characters`, `outline`.

Allowed Scope:
- `src/store/use_assistant_session_store.ts`
- `src/components/shared/AiAssistant.tsx`
- `src/components/pages/WriterPage.tsx`
- `src/components/pages/BiblePage.tsx`
- `src/components/pages/CharactersPage.tsx`
- `src/components/pages/OutlinePage.tsx`
- test lien quan neu can thiet

Do Not Touch:
- `package.json`
- `src/lib/workflow/*`
- `src/core/checkers/*`
- schema du lieu, auth, sync, deployment

Constraints:
- Khong them dependency moi.
- Giu chat-first flow hien tai.
- Handoff van phai hoat dong cho 4 route da co.
- Brief hien len phai ngan, ro, va khong can user mo lai chat de nho AI vua chot gi.

Stop And Ask Before:
- them dependency
- doi contract route payload hien tai
- xoa file
- sua luong workflow engine hoac persistence

Done When:
- Sau khi AI route sang `writer`, `bible`, `characters`, hoac `outline`, page dich hien duoc brief vua duoc AI tong hop.
- User van nhin thay cac field prefill hien co.
- Handoff khong bi consume som den muc mat mat brief truoc khi page dich render xong.
- Khong lam vo route handoff hien tai.

Verification:
- Chay `npm run build`
- Manual:
  - Tu dashboard assistant, yeu cau AI route sang `writer`
  - Xac nhan page `writer` co field duoc dien va co brief context
  - Lap lai cho `bible`, `characters`, `outline`

Return Format:
- Summary of changes
- Files changed
- Verification run
- Residual risk
