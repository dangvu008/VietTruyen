CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.memory_embeddings (
  id text PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  scene_id text,
  entity_ids text[],
  arc_ids text[],
  content_type text NOT NULL,
  source_text text NOT NULL,
  source_text_hash text NOT NULL,
  embedding vector,
  chapter_index integer,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memory_embeddings_select_project_access" ON public.memory_embeddings
  FOR SELECT TO authenticated USING (can_read_project(project_id));

CREATE POLICY "memory_embeddings_insert_project_editor" ON public.memory_embeddings
  FOR INSERT TO authenticated WITH CHECK (can_edit_project(project_id));

CREATE POLICY "memory_embeddings_update_project_editor" ON public.memory_embeddings
  FOR UPDATE TO authenticated USING (can_edit_project(project_id)) WITH CHECK (can_edit_project(project_id));

CREATE POLICY "memory_embeddings_delete_project_editor" ON public.memory_embeddings
  FOR DELETE TO authenticated USING (can_edit_project(project_id));;
