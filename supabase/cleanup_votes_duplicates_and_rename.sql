-- Run once in Supabase → SQL Editor (review, then execute).
-- 1) Remove duplicate vote rows that match on name + gender + created_at (keeps lowest id).
-- 2) Rename Hollard → Holly, Jade → Quentin (case-insensitive on name).

-- ---------------------------------------------------------------------------
-- Step 1: delete duplicates
-- ---------------------------------------------------------------------------
DELETE FROM public.votes
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY lower(trim(name)), gender, created_at
        ORDER BY id
      ) AS rn
    FROM public.votes
  ) d
  WHERE d.rn > 1
);

-- ---------------------------------------------------------------------------
-- Step 2: renames
-- ---------------------------------------------------------------------------
UPDATE public.votes
SET name = 'Holly'
WHERE lower(trim(name)) = 'hollard';

UPDATE public.votes
SET name = 'Quentin'
WHERE lower(trim(name)) = 'jade';

-- Optional: verify
-- SELECT name, gender, created_at, count(*) FROM public.votes GROUP BY 1,2,3 HAVING count(*) > 1;
-- SELECT * FROM public.votes WHERE lower(name) IN ('holly', 'quentin') ORDER BY created_at DESC;
