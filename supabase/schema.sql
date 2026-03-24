-- Supabase → SQL Editor → paste and Run once per project.
-- Vercel: add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or use Vercel’s Supabase integration).

create table if not exists public.gender_predictions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  gender_vote text not null check (gender_vote in ('boy', 'girl')),
  created_at timestamptz not null default now()
);

create index if not exists gender_predictions_created_at_idx
  on public.gender_predictions (created_at desc);

alter table public.gender_predictions enable row level security;

-- Block direct reads/writes from the browser; the Vercel API uses the service role and bypasses RLS.
-- (No policies = anon/authenticated cannot access the table.)

comment on table public.gender_predictions is 'Name + team vote from the gender reveal site (via Vercel API only).';
