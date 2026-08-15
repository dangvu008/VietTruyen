ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS narrative_era_register JSONB;

COMMENT ON COLUMN public.projects.narrative_era_register IS
  'Explicit per-story narrative era configuration. frame=contemporary|period|mixed; level=period-component intensity 1-5; includes optional narrator/dialogue/thought levels, confirmation provenance, and notes.';

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_narrative_era_register_object_check;

ALTER TABLE public.projects
ADD CONSTRAINT projects_narrative_era_register_object_check
CHECK (
  narrative_era_register IS NULL
  OR jsonb_typeof(narrative_era_register) = 'object'
);