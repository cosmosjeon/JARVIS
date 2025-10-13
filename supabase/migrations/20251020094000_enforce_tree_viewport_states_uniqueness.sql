-- Ensure a single viewport state per (user, tree) pair
BEGIN;

WITH duplicates AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, tree_id
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
           ) AS rn
    FROM public.tree_viewport_states
  ) ranked
  WHERE rn > 1
)
DELETE FROM public.tree_viewport_states
WHERE id IN (SELECT id FROM duplicates);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tree_viewport_states_user_tree_key'
      AND conrelid = 'public.tree_viewport_states'::regclass
  ) THEN
    DROP INDEX IF EXISTS public.idx_tree_viewport_states_user_tree;
    ALTER TABLE public.tree_viewport_states
      ADD CONSTRAINT tree_viewport_states_user_tree_key UNIQUE (user_id, tree_id);
  END IF;
END;
$$;

COMMIT;
