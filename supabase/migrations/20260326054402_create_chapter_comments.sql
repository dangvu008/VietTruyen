
-- Thread comments trên chapter/nhánh
CREATE TABLE public.chapter_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id  uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  branch_id   uuid REFERENCES public.story_branches(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.chapter_comments(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id),
  content     text NOT NULL DEFAULT '',
  status      text DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  line_ref    int,                -- dòng đang comment (optional)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT chapter_or_branch CHECK (chapter_id IS NOT NULL OR branch_id IS NOT NULL)
);

ALTER TABLE public.chapter_comments ENABLE ROW LEVEL SECURITY;

-- Members + owner xem comments
CREATE POLICY "Project members can view comments" ON public.chapter_comments
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

-- Authenticated members tạo comment
CREATE POLICY "Members can create comments" ON public.chapter_comments
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id
    AND (
      project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
      OR project_id IN (
        SELECT project_id FROM public.project_members
        WHERE user_id = auth.uid() AND role IN ('co_author', 'beta_reader')
      )
    )
  );

-- Author hoặc owner có thể update/delete
CREATE POLICY "Comment authors manage own comments" ON public.chapter_comments
  FOR UPDATE TO authenticated USING (
    author_id = auth.uid()
    OR project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Comment authors delete own comments" ON public.chapter_comments
  FOR DELETE TO authenticated USING (
    author_id = auth.uid()
    OR project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE INDEX idx_chapter_comments_chapter ON public.chapter_comments(chapter_id);
CREATE INDEX idx_chapter_comments_branch ON public.chapter_comments(branch_id);
CREATE INDEX idx_chapter_comments_project ON public.chapter_comments(project_id);
CREATE INDEX idx_chapter_comments_parent ON public.chapter_comments(parent_id);
;
