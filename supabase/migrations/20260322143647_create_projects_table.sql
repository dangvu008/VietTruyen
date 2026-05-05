
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Dự án mới',
  logline TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  sub_genre TEXT[] DEFAULT '{}',
  writing_style TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  style_id TEXT DEFAULT '',
  target_chapters INT DEFAULT 60,
  endgame TEXT DEFAULT '',
  main_character_count INT DEFAULT 2,
  support_character_count INT DEFAULT 3,
  character_setup TEXT DEFAULT '',
  world_setting TEXT DEFAULT '',
  main_plot TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  adaptation_type TEXT CHECK (
    adaptation_type IS NULL OR
    adaptation_type IN ('reskin','what-if','new-pov','era-shift','custom')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
;
