
CREATE TABLE public.world_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  geography TEXT DEFAULT '',
  magic_system TEXT DEFAULT '',
  tech_level TEXT DEFAULT '',
  currency TEXT DEFAULT '',
  factions TEXT[] DEFAULT '{}',
  rules TEXT DEFAULT ''
);

ALTER TABLE public.world_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own world_rules" ON public.world_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = world_rules.project_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = world_rules.project_id AND user_id = auth.uid()));
;
