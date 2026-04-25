import { Client } from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

if (!DATABASE_URL) fail("Missing DATABASE_URL");
if (!SUPABASE_URL) fail("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) fail("Missing SUPABASE_SERVICE_ROLE_KEY");

async function fetchSupabaseRows(table, select) {
  const url =
    SUPABASE_URL.replace(/\/$/, "") +
    `/rest/v1/${table}?select=${encodeURIComponent(select)}&order=created_at.asc&limit=5000`;
  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${table} fetch failed: ${r.status} ${t.slice(0, 260)}`);
  }
  return r.json();
}

async function fetchRevealConfig() {
  const url =
    SUPABASE_URL.replace(/\/$/, "") +
    "/rest/v1/reveal_config?select=id,reveal_gender,updated_at&id=eq.main&limit=1";
  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) {
    return null;
  }
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

async function ensureNeonSchema(client) {
  await client.query("create extension if not exists pgcrypto");
  await client.query(`
    create table if not exists public.votes (
      id uuid primary key default gen_random_uuid(),
      name text not null check (char_length(trim(name)) between 1 and 80),
      gender text not null check (gender in ('boy', 'girl')),
      created_at timestamptz not null default now()
    )
  `);
  await client.query(
    "create index if not exists votes_created_at_idx on public.votes (created_at desc)"
  );

  await client.query(`
    create table if not exists public.quiz_guesses (
      id uuid primary key default gen_random_uuid(),
      text text not null check (char_length(text) between 1 and 280),
      passed boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(
    "create index if not exists quiz_guesses_created_at_idx on public.quiz_guesses (created_at desc)"
  );

  await client.query(`
    create table if not exists public.reveal_config (
      id text primary key,
      reveal_gender text not null check (reveal_gender in ('boy', 'girl')),
      updated_at timestamptz not null default now()
    )
  `);
}

async function run() {
  const votes = await fetchSupabaseRows("votes", "name,gender,created_at");
  const guesses = await fetchSupabaseRows("quiz_guesses", "text,passed,created_at");
  const reveal = await fetchRevealConfig();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await ensureNeonSchema(client);
    await client.query("begin");

    for (const v of votes) {
      await client.query(
        "insert into public.votes (name, gender, created_at) values ($1, $2, $3)",
        [String(v.name || "").trim().slice(0, 80), v.gender === "boy" ? "boy" : "girl", v.created_at || new Date().toISOString()]
      );
    }

    for (const g of guesses) {
      await client.query(
        "insert into public.quiz_guesses (text, passed, created_at) values ($1, $2, $3)",
        [String(g.text || "").trim().slice(0, 280), !!g.passed, g.created_at || new Date().toISOString()]
      );
    }

    const revealGender =
      reveal && (reveal.reveal_gender === "boy" || reveal.reveal_gender === "girl")
        ? reveal.reveal_gender
        : "girl";
    const revealUpdatedAt =
      reveal && reveal.updated_at ? reveal.updated_at : new Date().toISOString();
    await client.query(
      "insert into public.reveal_config (id, reveal_gender, updated_at) values ('main', $1, $2) on conflict (id) do update set reveal_gender = excluded.reveal_gender, updated_at = excluded.updated_at",
      [revealGender, revealUpdatedAt]
    );

    await client.query("commit");

    console.log(`✅ Migrated ${votes.length} vote(s), ${guesses.length} guess(es), reveal=${revealGender}`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("❌ Migration failed:", err && err.message ? err.message : err);
  process.exit(1);
});
