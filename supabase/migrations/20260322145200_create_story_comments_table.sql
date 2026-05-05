
-- Story comments table
CREATE TABLE story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
CREATE POLICY "Anyone can read comments"
  ON story_comments FOR SELECT
  USING (true);

-- Authenticated users can post comments
CREATE POLICY "Authenticated users can comment"
  ON story_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users delete own comments"
  ON story_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_comments_story ON story_comments(story_id, created_at);
CREATE INDEX idx_comments_user ON story_comments(user_id);
;
