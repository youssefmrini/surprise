-- Run in Supabase SQL Editor if you already have public.votes
-- and only need the quiz log table.

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
