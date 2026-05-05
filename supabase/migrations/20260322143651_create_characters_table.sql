
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT '',
  arc TEXT DEFAULT '',
  current_stage TEXT DEFAULT '',
  traits TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own characters" ON public.characters FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = characters.project_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = characters.project_id AND user_id = auth.uid()));

CREATE INDEX idx_characters_project_id ON public.characters(project_id);
;
