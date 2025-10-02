-- Memos 테이블 생성
create table if not exists public.memos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tree_id text not null references public.trees(id) on delete cascade,
  node_id text not null references public.nodes(id) on delete cascade,
  content text not null,
  position_x real,
  position_y real,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

-- 인덱스 생성
create index if not exists memos_user_tree_idx on public.memos(user_id, tree_id);
create index if not exists memos_node_idx on public.memos(node_id);

-- RLS 활성화
alter table public.memos enable row level security;

-- Memos policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memos' AND policyname = 'Memos are owner readable'
  ) THEN
    CREATE POLICY "Memos are owner readable" ON public.memos
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memos' AND policyname = 'Memos are owner writable'
  ) THEN
    CREATE POLICY "Memos are owner writable" ON public.memos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memos' AND policyname = 'Memos owner update'
  ) THEN
    CREATE POLICY "Memos owner update" ON public.memos
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memos' AND policyname = 'Memos owner delete'
  ) THEN
    CREATE POLICY "Memos owner delete" ON public.memos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

