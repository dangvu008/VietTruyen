
CREATE TABLE public.foreshadowings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  related_entity_id TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.foreshadowings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own foreshadowings" ON public.foreshadowings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = foreshadowings.project_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = foreshadowings.project_id AND user_id = auth.uid()));

CREATE INDEX idx_foreshadowings_project_id ON public.foreshadowings(project_id);
;
