
-- Fix: Set immutable search_path for security (prevents search_path injection)

CREATE OR REPLACE FUNCTION public.get_or_create_token_usage(p_user_id uuid)
 RETURNS public.token_usage
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
  usage_row public.token_usage;
  user_tier text;
  user_limit bigint;
BEGIN
  -- Try to get existing row
  SELECT * INTO usage_row FROM public.token_usage
  WHERE user_id = p_user_id AND month = current_month;

  IF usage_row IS NOT NULL THEN
    RETURN usage_row;
  END IF;

  -- Get user tier to determine limit
  SELECT tier INTO user_tier FROM public.subscriptions WHERE user_id = p_user_id;

  CASE user_tier
    WHEN 'pro' THEN user_limit := 5000000;
    WHEN 'basic' THEN user_limit := 500000;
    ELSE user_limit := 50000; -- free
  END CASE;

  -- Insert new row for current month
  INSERT INTO public.token_usage (user_id, month, tokens_limit)
  VALUES (p_user_id, current_month, user_limit)
  ON CONFLICT (user_id, month) DO NOTHING
  RETURNING * INTO usage_row;

  -- If ON CONFLICT happened, fetch it
  IF usage_row IS NULL THEN
    SELECT * INTO usage_row FROM public.token_usage
    WHERE user_id = p_user_id AND month = current_month;
  END IF;

  RETURN usage_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_platform()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Auto-create free subscription
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-create empty author profile
  INSERT INTO public.author_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
;
