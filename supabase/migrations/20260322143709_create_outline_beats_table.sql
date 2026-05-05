
CREATE TABLE public.outline_beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  focus TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.outline_beats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own outline_beats" ON public.outline_beats FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = outline_beats.project_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = outline_beats.project_id AND user_id = auth.uid()));

CREATE INDEX idx_outline_beats_project_id ON public.outline_beats(project_id);
;
