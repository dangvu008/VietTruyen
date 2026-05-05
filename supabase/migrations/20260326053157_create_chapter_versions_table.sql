
-- Lịch sử version cho chapter
CREATE TABLE public.chapter_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id      uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number  int NOT NULL,
  title           text,
  content         text NOT NULL,
  summary         text,
  word_count      int DEFAULT 0,
  author_id       uuid NOT NULL REFERENCES auth.users(id),
  change_note     text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(chapter_id, version_number)
);

-- RLS
ALTER TABLE public.chapter_versions ENABLE ROW LEVEL SECURITY;

-- Project owner xem versions
CREATE POLICY "Project owners can view versions" ON public.chapter_versions
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- Project members xem versions
CREATE POLICY "Project members can view versions" ON public.chapter_versions
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

-- Authenticated users tạo versions (cho projects họ sở hữu hoặc là member)
CREATE POLICY "Users can create versions for their projects" ON public.chapter_versions
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id
    AND (
      project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
      OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role = 'co_author')
    )
  );

-- Indexes
CREATE INDEX idx_chapter_versions_chapter ON public.chapter_versions(chapter_id, version_number DESC);
CREATE INDEX idx_chapter_versions_project ON public.chapter_versions(project_id);
;
