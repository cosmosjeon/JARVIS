-- Create folders table for organizing trees
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000,
  deleted_at BIGINT NULL
);

-- Ensure base knowledge tree tables exist before later migrations add dependencies
CREATE TABLE IF NOT EXISTS public.trees (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.nodes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tree_id TEXT NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  parent_id TEXT,
  keyword TEXT,
  question TEXT,
  answer TEXT,
  status TEXT NOT NULL CHECK (status IN ('placeholder','asking','answered','draft')),
  order_index INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT
);

-- Add folder_id column to trees table
ALTER TABLE IF EXISTS public.trees
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id) WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF to_regclass('public.trees') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_trees_folder_id
      ON public.trees(folder_id)
      WHERE deleted_at IS NULL;
  END IF;
END;
$$;

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for folders
CREATE POLICY "Users can view their own folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);
