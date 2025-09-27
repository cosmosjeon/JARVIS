create table if not exists public.trees (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create table if not exists public.nodes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id text not null references public.trees(id) on delete cascade,
  parent_id text,
  keyword text,
  question text,
  answer text,
  status text not null check (status in ('placeholder','asking','answered','draft')),
  order_index integer default 0,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists nodes_user_tree_idx on public.nodes(user_id, tree_id);
create index if not exists nodes_parent_idx on public.nodes(parent_id);

alter table public.trees enable row level security;
alter table public.nodes enable row level security;

-- Trees policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trees' AND policyname = 'Trees are owner readable'
  ) THEN
    CREATE POLICY "Trees are owner readable" ON public.trees
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trees' AND policyname = 'Trees are owner writable'
  ) THEN
    CREATE POLICY "Trees are owner writable" ON public.trees
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trees' AND policyname = 'Trees owner update'
  ) THEN
    CREATE POLICY "Trees owner update" ON public.trees
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trees' AND policyname = 'Trees owner delete'
  ) THEN
    CREATE POLICY "Trees owner delete" ON public.trees
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- Nodes policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nodes' AND policyname = 'Nodes are owner readable'
  ) THEN
    CREATE POLICY "Nodes are owner readable" ON public.nodes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nodes' AND policyname = 'Nodes are owner writable'
  ) THEN
    CREATE POLICY "Nodes are owner writable" ON public.nodes
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nodes' AND policyname = 'Nodes owner update'
  ) THEN
    CREATE POLICY "Nodes owner update" ON public.nodes
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nodes' AND policyname = 'Nodes owner delete'
  ) THEN
    CREATE POLICY "Nodes owner delete" ON public.nodes
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;
