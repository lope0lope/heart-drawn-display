CREATE OR REPLACE FUNCTION public.wipe_farm_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  LOCK TABLE public.crocs, public.inspections, public.croc_photos, public.capture_ingest_log, public.cull_records, public.feed_records, public.upload_logs IN ACCESS EXCLUSIVE MODE;
  DELETE FROM public.capture_ingest_log;
  DELETE FROM public.croc_photos;
  DELETE FROM public.inspections;
  DELETE FROM public.cull_records;
  DELETE FROM public.feed_records;
  DELETE FROM public.crocs;
  DELETE FROM public.upload_logs;
END;
$$;
REVOKE ALL ON FUNCTION public.wipe_farm_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_farm_data() TO service_role;