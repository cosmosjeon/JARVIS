-- Ensure user_settings table exists and include theme preference
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tray_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  zoom_on_click_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_paste_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  input_mode TEXT NOT NULL DEFAULT 'mouse' CHECK (input_mode IN ('mouse', 'trackpad')),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL DEFAULT CAST(EXTRACT(EPOCH FROM now()) * 1000 AS bigint),
  updated_at BIGINT NOT NULL DEFAULT CAST(EXTRACT(EPOCH FROM now()) * 1000 AS bigint)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_user_settings'
  ) THEN
    CREATE TRIGGER trg_touch_user_settings
      BEFORE UPDATE ON public.user_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_settings'
      AND policyname = 'Users can read their user settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read their user settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_settings'
      AND policyname = 'Users can insert their user settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their user settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_settings'
      AND policyname = 'Users can update their user settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their user settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_settings'
      AND policyname = 'Users can delete their user settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their user settings" ON public.user_settings FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'theme'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN theme TO library_theme;
  END IF;
END;
$$;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS library_theme TEXT NOT NULL DEFAULT 'light'
    CHECK (library_theme IN ('light', 'dark'));

UPDATE public.user_settings
SET library_theme = 'light'
WHERE library_theme IS NULL
   OR library_theme NOT IN ('light', 'dark');

COMMENT ON COLUMN public.user_settings.library_theme IS 'Library mode theme preference (light|dark).';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS widget_theme TEXT NOT NULL DEFAULT 'glass'
    CHECK (widget_theme IN ('glass', 'light', 'dark'));

UPDATE public.user_settings
SET widget_theme = 'glass'
WHERE widget_theme IS NULL
   OR widget_theme NOT IN ('glass', 'light', 'dark');

COMMENT ON COLUMN public.user_settings.widget_theme IS 'Widget mode theme preference (glass|light|dark).';

COMMIT;
