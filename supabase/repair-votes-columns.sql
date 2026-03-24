-- Run in Supabase SQL Editor ONLY if POST /api/vote fails with a column error
-- (e.g. you created votes with different column names).

-- Example: rename legacy columns to match api/vote.js
-- alter table public.votes rename column display_name to name;
-- alter table public.votes rename column gender_vote to gender;

-- Or add missing columns and backfill (adjust to match your old names):
-- alter table public.votes add column if not exists name text;
-- alter table public.votes add column if not exists gender text;
-- update public.votes set name = display_name where name is null and display_name is not null;
-- update public.votes set gender = gender_vote where gender is null and gender_vote is not null;
