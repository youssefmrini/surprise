-- Postgres schema (Neon or Supabase) — run once in your SQL editor.
-- Vercel env should now use DATABASE_URL for API routes.

create extension if not exists pgcrypto;

-- One row per vote: the person's name and whether they picked boy or girl.
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  gender text not null check (gender in ('boy', 'girl')),
  created_at timestamptz not null default now()
);

create index if not exists votes_created_at_idx on public.votes (created_at desc);

alter table public.votes enable row level security;

-- No policies: only the service role (Vercel API) can read/write; browsers cannot access the table directly.

comment on table public.votes is 'Gender reveal poll: voter name + boy or girl.';
comment on column public.votes.name is 'Voter display name.';
comment on column public.votes.gender is 'Either boy or girl.';

-- Every quiz submission (correct or not), for admin review.
create table if not exists public.quiz_guesses (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 280),
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quiz_guesses_created_at_idx
  on public.quiz_guesses (created_at desc);

alter table public.quiz_guesses enable row level security;

comment on table public.quiz_guesses is 'Gender reveal quiz: raw guesses + whether they unlocked the reveal.';

-- Admin-controlled target for the Unveil button (singleton row id='main').
create table if not exists public.reveal_config (
  id text primary key,
  reveal_gender text not null check (reveal_gender in ('boy', 'girl')),
  updated_at timestamptz not null default now()
);

alter table public.reveal_config enable row level security;

insert into public.reveal_config (id, reveal_gender)
values ('main', 'girl')
on conflict (id) do nothing;

comment on table public.reveal_config is 'Singleton reveal target used by /api/reveal (girl or boy).';
comment on column public.reveal_config.reveal_gender is 'Which hidden reveal page should open from the Unveil button.';

-- ---------------------------------------------------------------------------
-- Optional: migrate from legacy table gender_predictions (same database only)
-- ---------------------------------------------------------------------------
-- insert into public.votes (name, gender, created_at)
-- select display_name, gender_vote, created_at from public.gender_predictions;
-- drop table if exists public.gender_predictions;
