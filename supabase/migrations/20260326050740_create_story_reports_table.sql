
-- Table báo cáo lỗi cho truyện public
CREATE TABLE public.story_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    uuid NOT NULL REFERENCES public.shared_stories(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id),
  chapter_index int,
  category    text NOT NULL DEFAULT 'typo',
  excerpt     text,
  description text NOT NULL,
  status      text NOT NULL DEFAULT 'open',
  author_note text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.story_reports ENABLE ROW LEVEL SECURITY;

-- Ai đăng nhập cũng có thể tạo report
CREATE POLICY "Users can create reports" ON public.story_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Reporter xem report của mình
CREATE POLICY "Users can view own reports" ON public.story_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- Tác giả xem report truyện mình
CREATE POLICY "Authors can view reports on their stories" ON public.story_reports
  FOR SELECT TO authenticated USING (
    story_id IN (SELECT id FROM public.shared_stories WHERE user_id = auth.uid())
  );

-- Tác giả update status/note
CREATE POLICY "Authors can update reports on their stories" ON public.story_reports
  FOR UPDATE TO authenticated USING (
    story_id IN (SELECT id FROM public.shared_stories WHERE user_id = auth.uid())
  ) WITH CHECK (
    story_id IN (SELECT id FROM public.shared_stories WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_story_reports_story_id ON public.story_reports(story_id);
CREATE INDEX idx_story_reports_reporter_id ON public.story_reports(reporter_id);
CREATE INDEX idx_story_reports_status ON public.story_reports(story_id, status);
;
