
-- ============================================================
-- 1. NEW TABLES
-- ============================================================

-- subscriptions (1-1 per user)
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'pro')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- token_usage (monthly aggregation per user)
CREATE TABLE token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL, -- e.g. '2026-03'
  tokens_used bigint DEFAULT 0,
  tokens_limit bigint NOT NULL,
  calls_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

-- author_profiles (1-1 per user, separate from profiles)
CREATE TABLE author_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  bio text,
  is_public boolean DEFAULT false,
  profile_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- project_members (collaboration)
CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('co_author', 'beta_reader', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- ============================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================

-- projects: add visibility + allow_comments
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  ADD COLUMN IF NOT EXISTS allow_comments boolean DEFAULT false;

-- chapters: add locking + word_count
ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS word_count int DEFAULT 0;

-- ============================================================
-- 3. RLS ENABLE
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- subscriptions: user reads/updates own only
CREATE POLICY "Users read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- System/Edge Function inserts subscriptions via service_role key,
-- so no INSERT policy for anon/authenticated needed here.

-- token_usage: user reads own only; Edge Function increments via service_role
CREATE POLICY "Users read own token usage"
  ON token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- author_profiles: user CRUD own, public profiles readable by all
CREATE POLICY "Users CRUD own author profile"
  ON author_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone reads public author profiles"
  ON author_profiles FOR SELECT
  USING (is_public = true);

-- project_members: owner of project can manage, members can read
CREATE POLICY "Project owner manages members"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Members read own membership"
  ON project_members FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. UPDATE EXISTING RLS: projects readable by members
-- ============================================================

-- Allow project members to read projects they're members of
CREATE POLICY "Members read shared projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
    )
  );

-- Allow co-authors to update projects
CREATE POLICY "Co-authors update shared projects"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.role = 'co_author'
    )
  );

-- Allow members to read chapters of shared projects
CREATE POLICY "Members read shared chapters"
  ON chapters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN projects p ON p.id = chapters.project_id
      WHERE pm.project_id = p.id
        AND pm.user_id = auth.uid()
    )
  );

-- Allow co-authors to edit chapters of shared projects (with locking)
CREATE POLICY "Co-authors edit shared chapters"
  ON chapters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = chapters.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'co_author'
    )
  );

-- ============================================================
-- 6. AUTO-CREATE subscription + author_profile on user signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user_platform()
RETURNS trigger AS $$
BEGIN
  -- Auto-create free subscription
  INSERT INTO subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-create empty author profile
  INSERT INTO author_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created_platform ON auth.users;
CREATE TRIGGER on_auth_user_created_platform
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_platform();

-- ============================================================
-- 7. HELPER: Get or create current month token_usage
-- ============================================================

CREATE OR REPLACE FUNCTION get_or_create_token_usage(p_user_id uuid)
RETURNS token_usage AS $$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
  usage_row token_usage;
  user_tier text;
  user_limit bigint;
BEGIN
  -- Try to get existing row
  SELECT * INTO usage_row FROM token_usage
  WHERE user_id = p_user_id AND month = current_month;

  IF usage_row IS NOT NULL THEN
    RETURN usage_row;
  END IF;

  -- Get user tier to determine limit
  SELECT tier INTO user_tier FROM subscriptions WHERE user_id = p_user_id;

  CASE user_tier
    WHEN 'pro' THEN user_limit := 5000000;
    WHEN 'basic' THEN user_limit := 500000;
    ELSE user_limit := 50000; -- free
  END CASE;

  -- Insert new row for current month
  INSERT INTO token_usage (user_id, month, tokens_limit)
  VALUES (p_user_id, current_month, user_limit)
  ON CONFLICT (user_id, month) DO NOTHING
  RETURNING * INTO usage_row;

  -- If ON CONFLICT happened, fetch it
  IF usage_row IS NULL THEN
    SELECT * INTO usage_row FROM token_usage
    WHERE user_id = p_user_id AND month = current_month;
  END IF;

  RETURN usage_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
