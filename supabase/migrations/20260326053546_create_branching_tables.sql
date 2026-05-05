
-- Nhánh viết thử (branches)
CREATE TABLE public.story_branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT 'Nhánh mới',
  description     text,
  source_branch_id uuid REFERENCES public.story_branches(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'merged', 'archived')),
  author_id       uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Chapter override trên branch
CREATE TABLE public.branch_chapters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES public.story_branches(id) ON DELETE CASCADE,
  chapter_id  uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT '',
  content     text NOT NULL DEFAULT '',
  summary     text,
  sort_order  int DEFAULT 0,
  status      text DEFAULT 'draft'
              CHECK (status IN ('draft', 'revised', 'final')),
  word_count  int DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.story_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_chapters ENABLE ROW LEVEL SECURITY;

-- Branches: owner + members xem
CREATE POLICY "Project owners can manage branches" ON public.story_branches
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Project members can view branches" ON public.story_branches
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Co-authors can create branches" ON public.story_branches
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id
    AND (
      project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
      OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role = 'co_author')
    )
  );

-- Branch chapters: same as branch access
CREATE POLICY "Branch chapter access matches branch" ON public.branch_chapters
  FOR ALL TO authenticated USING (
    branch_id IN (
      SELECT id FROM public.story_branches
      WHERE project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Members can view branch chapters" ON public.branch_chapters
  FOR SELECT TO authenticated USING (
    branch_id IN (
      SELECT id FROM public.story_branches
      WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Co-authors can edit branch chapters" ON public.branch_chapters
  FOR INSERT TO authenticated WITH CHECK (
    branch_id IN (
      SELECT sb.id FROM public.story_branches sb
      WHERE sb.author_id = auth.uid()
      OR sb.project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX idx_story_branches_project ON public.story_branches(project_id);
CREATE INDEX idx_branch_chapters_branch ON public.branch_chapters(branch_id);
CREATE INDEX idx_branch_chapters_chapter ON public.branch_chapters(chapter_id);
;
