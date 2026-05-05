
-- Shared stories table: truyện được publish ra cộng đồng
CREATE TABLE shared_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  logline TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  sub_genre TEXT[] DEFAULT '{}',
  cover_emoji TEXT DEFAULT '📖',
  chapters JSONB NOT NULL DEFAULT '[]',
  characters JSONB DEFAULT '[]',
  chapter_count INT DEFAULT 0,
  word_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE shared_stories ENABLE ROW LEVEL SECURITY;

-- Public read for published stories
CREATE POLICY "Anyone can read published stories"
  ON shared_stories FOR SELECT
  USING (status = 'published');

-- Authors manage their own stories (all operations)
CREATE POLICY "Authors manage own stories"
  ON shared_stories FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_shared_stories_user ON shared_stories(user_id);
CREATE INDEX idx_shared_stories_created ON shared_stories(created_at DESC);
CREATE INDEX idx_shared_stories_genre ON shared_stories(genre);
;
