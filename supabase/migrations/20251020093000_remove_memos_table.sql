-- Remove legacy memos table now that memo data is stored on public.nodes
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.memos') IS NULL THEN
    RETURN;
  END IF;

  -- Drop policies first to avoid dependency errors
  DROP POLICY IF EXISTS "Memos are owner readable" ON public.memos;
  DROP POLICY IF EXISTS "Memos are owner writable" ON public.memos;
  DROP POLICY IF EXISTS "Memos owner update" ON public.memos;
  DROP POLICY IF EXISTS "Memos owner delete" ON public.memos;

  -- Remove the table and dependent objects
  DROP TABLE IF EXISTS public.memos CASCADE;
END;
$$;

COMMIT;
