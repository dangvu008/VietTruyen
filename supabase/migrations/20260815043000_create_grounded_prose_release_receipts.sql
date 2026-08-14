-- Durable, cross-device release evidence for Grounded Prose Gate.
-- One current PASS receipt per project/chapter number. A prose edit changes
-- prose_hash and therefore requires a new audited receipt before release.

create table if not exists public.grounded_prose_release_receipts (
  project_id uuid not null references public.projects(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  prose_hash text not null check (length(trim(prose_hash)) > 0),
  gate jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (project_id, chapter_number)
);

create index if not exists grounded_prose_release_receipts_saved_at_idx
  on public.grounded_prose_release_receipts(saved_at desc);

alter table public.grounded_prose_release_receipts enable row level security;

-- Owners and project members can read release evidence for projects they can work on.
drop policy if exists "grounded prose receipts readable by project participants"
  on public.grounded_prose_release_receipts;
create policy "grounded prose receipts readable by project participants"
  on public.grounded_prose_release_receipts
  for select
  using (
    exists (
      select 1
      from public.projects p
      where p.id = grounded_prose_release_receipts.project_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.id
              and pm.user_id = auth.uid()
          )
        )
    )
  );

-- Release evidence is security-sensitive. Only the project owner may create,
-- replace or delete the canonical cloud receipt.
drop policy if exists "grounded prose receipts writable by project owner"
  on public.grounded_prose_release_receipts;
create policy "grounded prose receipts writable by project owner"
  on public.grounded_prose_release_receipts
  for all
  using (
    exists (
      select 1
      from public.projects p
      where p.id = grounded_prose_release_receipts.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = grounded_prose_release_receipts.project_id
        and p.user_id = auth.uid()
    )
  );
