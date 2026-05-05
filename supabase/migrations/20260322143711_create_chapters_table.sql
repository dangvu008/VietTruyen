
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','revised','final')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own chapters" ON public.chapters FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = chapters.project_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = chapters.project_id AND user_id = auth.uid()));

CREATE INDEX idx_chapters_project_id ON public.chapters(project_id);
;
