CREATE OR REPLACE FUNCTION public.wipe_farm_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  LOCK TABLE public.crocs, public.inspections, public.croc_photos, public.capture_ingest_log, public.cull_records, public.feed_records, public.upload_logs IN ACCESS EXCLUSIVE MODE;
  DELETE FROM public.capture_ingest_log WHERE client_id IS NOT NULL;
  DELETE FROM public.croc_photos WHERE id IS NOT NULL;
  DELETE FROM public.inspections WHERE id IS NOT NULL;
  DELETE FROM public.cull_records WHERE id IS NOT NULL;
  DELETE FROM public.feed_records WHERE id IS NOT NULL;
  DELETE FROM public.crocs WHERE id IS NOT NULL;
  DELETE FROM public.upload_logs WHERE id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.wipe_farm_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_farm_data() TO service_role;