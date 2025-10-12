-- Ensure timestamp helpers are available
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := CAST(EXTRACT(EPOCH FROM now()) * 1000 AS bigint);
  RETURN NEW;
END;
$function$;

-- Users can sync application preferences across devices
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

CREATE TRIGGER trg_touch_user_settings
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their user settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their user settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their user settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their user settings" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_settings IS 'Stores per-user application preferences for cross-device sync.';

-- Logging assistant interactions per node for analytics and recovery
CREATE TABLE IF NOT EXISTS public.node_question_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tree_id TEXT NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'answered' CHECK (status IN ('pending', 'answered', 'failed', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'assistant' CHECK (source IN ('assistant', 'user', 'system')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  question_number INTEGER NOT NULL DEFAULT 1 CHECK (question_number >= 1),
  created_at BIGINT NOT NULL DEFAULT CAST(EXTRACT(EPOCH FROM now()) * 1000 AS bigint),
  updated_at BIGINT NOT NULL DEFAULT CAST(EXTRACT(EPOCH FROM now()) * 1000 AS bigint)
);

CREATE INDEX IF NOT EXISTS idx_node_question_history_node_created_at
  ON public.node_question_history(node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_node_question_history_user_created_at
  ON public.node_question_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_node_question_history_tree_created_at
  ON public.node_question_history(tree_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_question_history_question_number
  ON public.node_question_history(node_id, question_number);

COMMENT ON TABLE public.node_question_history IS 'Historical log of user and assistant Q/A iterations for each node.';

COMMENT ON COLUMN public.node_question_history.metadata IS 'Optional metadata such as model configuration or prompt context.';
COMMENT ON COLUMN public.node_question_history.attachments IS 'Array of attachment payloads associated with the question.';

CREATE OR REPLACE FUNCTION public.set_node_question_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_number INTEGER;
BEGIN
  IF NEW.question_number IS NULL OR NEW.question_number < 1 THEN
    SELECT COALESCE(MAX(question_number), 0) + 1
      INTO next_number
      FROM public.node_question_history
     WHERE node_id = NEW.node_id
       AND user_id = NEW.user_id;

    NEW.question_number := GREATEST(next_number, 1);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_node_question_history_assign_number
  BEFORE INSERT ON public.node_question_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_node_question_number();

CREATE TRIGGER trg_touch_node_question_history
  BEFORE UPDATE ON public.node_question_history
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.node_question_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their node question history" ON public.node_question_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their node question history" ON public.node_question_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their node question history" ON public.node_question_history
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their node question history" ON public.node_question_history
  FOR DELETE USING (auth.uid() = user_id);

-- Provide lightweight aggregates for UI bootstrapping
CREATE OR REPLACE VIEW public.node_question_stats AS
SELECT
  node_id,
  user_id,
  tree_id,
  COUNT(*)::INTEGER AS question_count,
  MAX(created_at)::BIGINT AS last_question_at
FROM public.node_question_history
GROUP BY node_id, user_id, tree_id;

COMMENT ON VIEW public.node_question_stats IS 'Aggregated question counts and last activity per node.';
