-- Run this in Neon SQL Editor (or psql) once.
-- It creates required tables and seeds the old votes copied from production.

create extension if not exists pgcrypto;

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  gender text not null check (gender in ('boy', 'girl')),
  created_at timestamptz not null default now()
);

create index if not exists votes_created_at_idx
  on public.votes (created_at desc);

create table if not exists public.quiz_guesses (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 280),
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quiz_guesses_created_at_idx
  on public.quiz_guesses (created_at desc);

create table if not exists public.reveal_config (
  id text primary key,
  reveal_gender text not null check (reveal_gender in ('boy', 'girl')),
  updated_at timestamptz not null default now()
);

begin;

delete from public.votes;
delete from public.quiz_guesses;

insert into public.votes (name, gender, created_at) values
  ('Lara', 'girl', '2026-04-21T19:14:25.427168+00:00'),
  ('Taha', 'boy', '2026-04-18T23:21:02.248475+00:00'),
  ('Ghita', 'boy', '2026-04-18T19:36:54.575909+00:00'),
  ('Safaa', 'boy', '2026-04-18T18:38:47.081126+00:00'),
  ('Aymane', 'boy', '2026-04-18T18:30:28.040067+00:00'),
  ('Yassine', 'girl', '2026-04-18T18:29:20.891162+00:00'),
  ('Yasmine', 'boy', '2026-04-18T18:28:21.289811+00:00'),
  ('Marwa', 'boy', '2026-04-18T18:27:30.733992+00:00'),
  ('Oleksandra', 'girl', '2026-04-17T16:30:49.246062+00:00'),
  ('Josue', 'girl', '2026-04-17T16:19:32.400197+00:00'),
  ('Anya', 'boy', '2026-04-17T13:54:18.022153+00:00'),
  ('Hanane', 'girl', '2026-04-14T06:25:35.889341+00:00'),
  ('Nidal', 'girl', '2026-04-14T05:28:40.304115+00:00'),
  ('Ines', 'girl', '2026-04-13T07:05:20.072207+00:00'),
  ('Axel', 'girl', '2026-04-11T12:18:20.454439+00:00'),
  ('Lea', 'girl', '2026-04-11T10:56:26.749962+00:00'),
  ('Hadi', 'girl', '2026-04-11T10:38:10.053918+00:00'),
  ('Hatim', 'boy', '2026-04-11T09:59:30.462227+00:00'),
  ('Guillaume', 'boy', '2026-04-03T23:03:04.487886+00:00'),
  ('Carly :D', 'girl', '2026-03-26T15:16:21.96516+00:00'),
  ('chao', 'girl', '2026-03-26T14:49:12.894013+00:00'),
  ('Holly', 'boy', '2026-03-25T20:45:31.637827+00:00'),
  ('Quentin', 'girl', '2026-03-25T10:48:37.811808+00:00'),
  ('Rengie', 'girl', '2026-03-24T22:57:19.669031+00:00'),
  ('Yassine', 'boy', '2026-03-24T20:49:17.819985+00:00'),
  ('Youssef', 'girl', '2026-03-24T20:41:02.367569+00:00'),
  ('Jihane', 'boy', '2026-03-24T20:29:04.955406+00:00');

insert into public.reveal_config (id, reveal_gender, updated_at)
values ('main', 'girl', now())
on conflict (id) do update
  set reveal_gender = excluded.reveal_gender,
      updated_at = now();

commit;
