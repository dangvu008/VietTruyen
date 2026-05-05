CREATE TABLE public.shared_story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_title TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_payload JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shared_story_templates_source_fingerprint_key UNIQUE (source_fingerprint)
);

ALTER TABLE public.shared_story_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public shared templates"
  ON public.shared_story_templates FOR SELECT
  USING (is_public = true);

CREATE POLICY "Authors insert shared templates"
  ON public.shared_story_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors update own shared templates"
  ON public.shared_story_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors delete own shared templates"
  ON public.shared_story_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_shared_story_templates_user_id
  ON public.shared_story_templates(user_id);

CREATE INDEX idx_shared_story_templates_created_at
  ON public.shared_story_templates(created_at DESC);
