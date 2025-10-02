-- Align tree and folder management with application expectations
-- Introduces cascade soft-delete handling, auto-updating timestamps,
-- viewport state uniqueness, and memo query optimization.

BEGIN;

-- Ensure updated_at reflects the latest change moment on updates
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := CAST(EXTRACT(EPOCH FROM now()) * 1000 AS bigint);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_touch_trees ON public.trees;
CREATE TRIGGER trg_touch_trees
  BEFORE UPDATE ON public.trees
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_folders ON public.folders;
CREATE TRIGGER trg_touch_folders
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Cascade folder soft-deletes and detach trees from deleted folders
CREATE OR REPLACE FUNCTION public.folders_soft_delete_cascade()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.folders
     SET deleted_at = NEW.deleted_at,
         updated_at = NEW.updated_at
   WHERE parent_id = OLD.id
     AND deleted_at IS NULL;

  UPDATE public.trees
     SET folder_id = NULL,
         updated_at = NEW.updated_at
   WHERE folder_id = OLD.id
     AND deleted_at IS NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_folders_soft_delete ON public.folders;
CREATE TRIGGER trg_folders_soft_delete
  AFTER UPDATE OF deleted_at ON public.folders
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.folders_soft_delete_cascade();

-- Enforce a single viewport state per user/tree pair
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
    ALTER TABLE public.tree_viewport_states
      ADD CONSTRAINT tree_viewport_states_user_tree_key UNIQUE (user_id, tree_id);
  END IF;
END;
$$;

-- Improve memo lookups for active records
CREATE INDEX IF NOT EXISTS memos_tree_node_not_deleted_idx
  ON public.memos (tree_id, node_id)
  WHERE deleted_at IS NULL;

COMMIT;
