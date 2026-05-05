-- File: 20260501164000_fix_project_rls_recursion.sql
-- Purpose: Replace recursive project RLS policies with SECURITY DEFINER helpers.
-- Domain: Storage -> Supabase project access

begin;

create or replace function public.is_project_owner(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

create or replace function public.can_comment_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
      and pm.role in ('co_author', 'beta_reader')
  );
$$;

create or replace function public.can_read_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.story_branches b
    where b.id = target_branch_id
      and public.can_read_project(b.project_id)
  );
$$;

create or replace function public.can_edit_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.story_branches b
    where b.id = target_branch_id
      and public.can_edit_project(b.project_id)
  );
$$;

revoke all on function public.is_project_owner(uuid) from public;
revoke all on function public.can_read_project(uuid) from public;
revoke all on function public.can_edit_project(uuid) from public;
revoke all on function public.can_comment_project(uuid) from public;
revoke all on function public.can_read_branch(uuid) from public;
revoke all on function public.can_edit_branch(uuid) from public;

grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.can_read_project(uuid) to authenticated;
grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.can_comment_project(uuid) to authenticated;
grant execute on function public.can_read_branch(uuid) to authenticated;
grant execute on function public.can_edit_branch(uuid) to authenticated;

do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array[
    'projects',
    'project_members',
    'chapters',
    'characters',
    'outline_beats',
    'foreshadowings',
    'world_rules',
    'chapter_versions',
    'story_branches',
    'branch_chapters',
    'chapter_comments'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', target_table);

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

create policy "project_members_select_project_access"
  on public.project_members
  for select
  to authenticated
  using (public.can_read_project(project_id));

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

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'chapters',
    'characters',
    'outline_beats',
    'foreshadowings',
    'world_rules',
    'chapter_versions',
    'story_branches'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read_project(project_id))',
      target_table || '_select_project_access',
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_edit_project(project_id))',
      target_table || '_insert_project_editor',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id))',
      target_table || '_update_project_editor',
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_edit_project(project_id))',
      target_table || '_delete_project_editor',
      target_table
    );
  end loop;
end $$;

create policy "branch_chapters_select_branch_access"
  on public.branch_chapters
  for select
  to authenticated
  using (public.can_read_branch(branch_id));

create policy "branch_chapters_insert_branch_editor"
  on public.branch_chapters
  for insert
  to authenticated
  with check (public.can_edit_branch(branch_id));

create policy "branch_chapters_update_branch_editor"
  on public.branch_chapters
  for update
  to authenticated
  using (public.can_edit_branch(branch_id))
  with check (public.can_edit_branch(branch_id));

create policy "branch_chapters_delete_branch_editor"
  on public.branch_chapters
  for delete
  to authenticated
  using (public.can_edit_branch(branch_id));

create policy "chapter_comments_select_project_access"
  on public.chapter_comments
  for select
  to authenticated
  using (public.can_read_project(project_id));

create policy "chapter_comments_insert_commenter"
  on public.chapter_comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.can_comment_project(project_id)
  );

create policy "chapter_comments_update_author_or_editor"
  on public.chapter_comments
  for update
  to authenticated
  using (
    author_id = auth.uid()
    or public.can_edit_project(project_id)
  )
  with check (
    author_id = auth.uid()
    or public.can_edit_project(project_id)
  );

create policy "chapter_comments_delete_author_or_editor"
  on public.chapter_comments
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    or public.can_edit_project(project_id)
  );

commit;
