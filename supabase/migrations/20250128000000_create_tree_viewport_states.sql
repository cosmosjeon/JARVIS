-- Create tree viewport states table for saving Tree2 positions and zoom levels
CREATE TABLE IF NOT EXISTS public.tree_viewport_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tree_id TEXT NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  viewport_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tree_viewport_states_user_tree ON public.tree_viewport_states(user_id, tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_viewport_states_updated_at ON public.tree_viewport_states(updated_at DESC);

-- Enable RLS
ALTER TABLE public.tree_viewport_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tree viewport states" ON public.tree_viewport_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tree viewport states" ON public.tree_viewport_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tree viewport states" ON public.tree_viewport_states
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tree viewport states" ON public.tree_viewport_states
  FOR DELETE USING (auth.uid() = user_id);

-- Add comment explaining the viewport_data structure
COMMENT ON TABLE public.tree_viewport_states IS 'Stores Tree2 viewport states including zoom level, pan position, and node positions';
COMMENT ON COLUMN public.tree_viewport_states.viewport_data IS 'JSONB containing: {zoom: {k, x, y}, pan: {x, y}, nodePositions: {nodeId: {x, y}}}';
