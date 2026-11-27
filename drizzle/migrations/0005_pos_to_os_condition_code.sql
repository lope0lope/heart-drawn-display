DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.condition_codes WHERE code = 'OS')
     AND NOT EXISTS (SELECT 1 FROM public.condition_codes WHERE code = 'POS') THEN
    RAISE EXCEPTION 'Cannot replace POS: neither POS nor OS exists in condition_codes';
  END IF;

  IF EXISTS (SELECT 1 FROM public.condition_codes WHERE code = 'OS') THEN
    DELETE FROM public.condition_codes WHERE code = 'POS';
  ELSE
    UPDATE public.condition_codes SET code = 'OS' WHERE code = 'POS';
  END IF;
END
$$;

UPDATE public.crocs AS croc
SET condition_codes = (
  SELECT COALESCE(array_agg(mapped.code ORDER BY mapped.first_position), ARRAY[]::text[])
  FROM (
    SELECT normalized.code, MIN(normalized.ord) AS first_position
    FROM (
      SELECT
        CASE
          WHEN code = 'POS' THEN 'OS'
          WHEN code LIKE 'POS@%' THEN 'OS' || substring(code FROM 4)
          ELSE code
        END AS code,
        ord
      FROM unnest(croc.condition_codes) WITH ORDINALITY AS item(code, ord)
    ) AS normalized
    GROUP BY normalized.code
  ) AS mapped
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(croc.condition_codes) AS item(code)
  WHERE code = 'POS' OR code LIKE 'POS@%'
);

UPDATE public.inspections AS inspection
SET condition_codes = (
  SELECT COALESCE(array_agg(mapped.code ORDER BY mapped.first_position), ARRAY[]::text[])
  FROM (
    SELECT normalized.code, MIN(normalized.ord) AS first_position
    FROM (
      SELECT
        CASE
          WHEN code = 'POS' THEN 'OS'
          WHEN code LIKE 'POS@%' THEN 'OS' || substring(code FROM 4)
          ELSE code
        END AS code,
        ord
      FROM unnest(inspection.condition_codes) WITH ORDINALITY AS item(code, ord)
    ) AS normalized
    GROUP BY normalized.code
  ) AS mapped
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(inspection.condition_codes) AS item(code)
  WHERE code = 'POS' OR code LIKE 'POS@%'
);

UPDATE public.croc_photos AS photo
SET marks = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN mark->>'code' = 'POS' THEN jsonb_set(mark, '{code}', '"OS"'::jsonb)
        ELSE mark
      END
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(photo.marks) WITH ORDINALITY AS item(mark, ord)
)
WHERE jsonb_typeof(photo.marks) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(photo.marks) AS item(mark)
    WHERE mark->>'code' = 'POS'
  );