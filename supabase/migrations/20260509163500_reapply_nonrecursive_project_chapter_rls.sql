-- File: 20260509163500_reapply_nonrecursive_project_chapter_rls.sql
-- Purpose: Re-apply non-recursive RLS helpers and policies for projects/project_members/chapters.
-- Context: Browser logs showed REST 500 on public.chapters caused by RLS policy recursion.
-- This migration is intentionally idempotent and scoped to the tables involved in chapter hydration.

begin;

create or replace function public.is_project_owner(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'co_author'
  );
$$;

revoke all on function public.is_project_owner(uuid) from public;
revoke all on function public.can_read_project(uuid) from public;
revoke all on function public.can_edit_project(uuid) from public;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.can_read_project(uuid) to authenticated;
grant execute on function public.can_edit_project(uuid) to authenticated;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.chapters enable row level security;

do $$
declare
  existing_policy record;
  target_table text;
begin
  foreach target_table in array array['projects', 'project_members', 'chapters']
  loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy.policyname, target_table);
    end loop;
  end loop;
end $$;

create policy "projects_select_access"
  on public.projects
  for select
  to authenticated
  using (public.can_read_project(id));

create policy "projects_insert_owner"
  on public.projects
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "projects_update_editor"
  on public.projects
  for update
  to authenticated
  using (public.can_edit_project(id))
  with check (public.can_edit_project(id));

create policy "projects_delete_owner"
  on public.projects
  for delete
  to authenticated
  using (public.is_project_owner(id));

create policy "project_members_select_visible"
  on public.project_members
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));

create policy "project_members_insert_owner"
  on public.project_members
  for insert
  to authenticated
  with check (public.is_project_owner(project_id));

create policy "project_members_update_owner"
  on public.project_members
  for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "project_members_delete_owner"
  on public.project_members
  for delete
  to authenticated
  using (public.is_project_owner(project_id));

create policy "chapters_select_project_access"
  on public.chapters
  for select
  to authenticated
  using (public.can_read_project(project_id));

create policy "chapters_insert_project_editor"
  on public.chapters
  for insert
  to authenticated
  with check (public.can_edit_project(project_id));

create policy "chapters_update_project_editor"
  on public.chapters
  for update
  to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

create policy "chapters_delete_project_editor"
  on public.chapters
  for delete
  to authenticated
  using (public.can_edit_project(project_id));

commit;
