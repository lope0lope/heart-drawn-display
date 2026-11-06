CREATE OR REPLACE FUNCTION public.commit_capture(e jsonb, p_photo_url text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid integer; old public.crocs%ROWTYPE; cull text:=upper(coalesce(e->>'cull','')); size numeric:=nullif(e->>'size_cm','')::numeric; d date:=(e->>'date')::date; codes text[]; details text[]; moved boolean; inserted boolean:=false;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(e->>'client_id',0));
 IF EXISTS(SELECT 1 FROM capture_ingest_log WHERE client_id=e->>'client_id') THEN RETURN jsonb_build_object('client_id',e->>'client_id','status','duplicate'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(e->>'tag',1));
 IF cull IN ('NX','NEXT') THEN cull:='NXT'; END IF;
 IF cull='CULL' THEN cull:='CULLED'; END IF;
 SELECT coalesce(array_agg(DISTINCT m->>'code'),'{}') INTO codes FROM jsonb_array_elements(coalesce(e->'marks','[]')) m;
 SELECT coalesce(array_agg((m->>'code')||'@'||(m->>'zone_label')),'{}') INTO details FROM jsonb_array_elements(coalesce(e->'marks','[]')) m;
 IF cull IN ('NXT','1','2','3') THEN codes:=array_append(codes,'CULL-'||cull); END IF;
 SELECT * INTO old FROM crocs WHERE tag=e->>'tag' FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO crocs(tag,pen_id,line,pen_slot,belly_cm,condition_codes,inspection_date,cull_schedule,placement_date,placement_belly_cm,pen_since) VALUES(e->>'tag',e->>'house',upper(e->>'line'),(e->>'pen')::integer,size,codes,d,nullif(cull,''),d,size,d) RETURNING id INTO cid;
  inserted:=true;
 ELSE
  cid:=old.id;
  moved:=old.pen_id<>e->>'house' OR old.line<>upper(e->>'line') OR old.pen_slot<>(e->>'pen')::integer;
  IF old.inspection_date<=d THEN UPDATE crocs SET pen_id=e->>'house',line=upper(e->>'line'),pen_slot=(e->>'pen')::integer,belly_cm=size,condition_codes=codes,inspection_date=d,cull_schedule=nullif(cull,''),placement_date=coalesce(old.placement_date,d),placement_belly_cm=coalesce(old.placement_belly_cm,size),pen_since=CASE WHEN moved THEN d ELSE coalesce(old.pen_since,d) END WHERE id=cid; END IF;
 END IF;
 INSERT INTO inspections(croc_id,inspection_date,belly_cm,condition_codes,pen_id,line,pen_slot) VALUES(cid,d,size,details,e->>'house',upper(e->>'line'),(e->>'pen')::integer) ON CONFLICT(croc_id,inspection_date) DO UPDATE SET belly_cm=excluded.belly_cm,condition_codes=excluded.condition_codes,pen_id=excluded.pen_id,line=excluded.line,pen_slot=excluded.pen_slot;
 IF e->>'photo_path' IS NOT NULL THEN
  INSERT INTO croc_photos(croc_id,tag,inspection_date,photo_url,storage_path,belly_cm,marks) VALUES(cid,e->>'tag',d,coalesce(p_photo_url,''),e->>'photo_path',size,coalesce((SELECT jsonb_agg(jsonb_build_object('id',(e->>'client_id')||'-'||n,'zoneKey',coalesce(m->>'zone_key',''),'zoneLabel',m->>'zone_label','code',m->>'code','name',coalesce(m->>'name',m->>'code'),'mx',coalesce((m->>'x')::numeric,0),'my',coalesce((m->>'y')::numeric,0))) FROM jsonb_array_elements(coalesce(e->'marks','[]')) WITH ORDINALITY AS t(m,n)),'[]')) ON CONFLICT(storage_path) DO NOTHING;
 END IF;
 INSERT INTO capture_ingest_log(client_id,croc_id,tag,inspection_date) VALUES(e->>'client_id',cid,e->>'tag',d);
 RETURN jsonb_build_object('client_id',e->>'client_id','status','saved','croc_id',cid,'photo_url',p_photo_url,'created',inserted);
END $$;
REVOKE ALL ON FUNCTION public.commit_capture(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_capture(jsonb,text) TO service_role;