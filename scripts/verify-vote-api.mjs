#!/usr/bin/env node
/**
 * Verify vote stack:
 *   1) Supabase REST (table reachable) — needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2) Deployed /api/vote — needs SITE_URL (e.g. https://xxx.vercel.app)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-vote-api.mjs --supabase
 *   node scripts/verify-vote-api.mjs --site https://your-app.vercel.app
 *   node scripts/verify-vote-api.mjs --site https://your-app.vercel.app --post
 */

var args = process.argv.slice(2);
var site =
  (args.includes("--site") && args[args.indexOf("--site") + 1]) ||
  process.env.SITE_URL ||
  "";
var doPost = args.includes("--post");
var doSupabase = args.includes("--supabase");

function ok(msg) {
  console.log("OK  " + msg);
}
function fail(msg) {
  console.error("FAIL " + msg);
  process.exitCode = 1;
}

async function verifySupabase() {
  var base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) {
    fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for --supabase");
    return;
  }
  var url =
    base +
    "/rest/v1/gender_predictions?select=id&gender_vote=eq.girl&limit=1";
  var res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
    },
  });
  if (!res.ok) {
    var t = await res.text();
    fail("Supabase REST " + res.status + ": " + t.slice(0, 200));
    return;
  }
  ok("Supabase: gender_predictions is readable (GET " + res.status + ")");
}

async function verifySite() {
  if (!site) {
    fail("Pass --site https://your-deployment.vercel.app or set SITE_URL");
    return;
  }
  site = site.replace(/\/$/, "");
  var getUrl = site + "/api/vote";
  var res = await fetch(getUrl, { method: "GET" });
  var text = await res.text();
  if (!res.ok) {
    fail("GET /api/vote → " + res.status + " " + text.slice(0, 200));
    return;
  }
  var j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    fail("GET /api/vote: not JSON: " + text.slice(0, 120));
    return;
  }
  if (
    typeof j.girl !== "number" ||
    typeof j.boy !== "number" ||
    typeof j.total !== "number"
  ) {
    fail("GET /api/vote: expected { girl, boy, number } got " + JSON.stringify(j));
    return;
  }
  ok(
    "GET /api/vote → { girl: " +
      j.girl +
      ", boy: " +
      j.boy +
      ", total: " +
      j.total +
      " }"
  );

  if (!doPost) return;

  var name = "verify-" + Date.now();
  var res2 = await fetch(getUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: name,
      gender_vote: "girl",
    }),
  });
  var text2 = await res2.text();
  if (res2.status !== 201) {
    fail("POST /api/vote → " + res2.status + " " + text2.slice(0, 200));
    return;
  }
  var j2 = JSON.parse(text2);
  ok("POST /api/vote (test vote) → total now " + j2.total);
}

async function main() {
  if (doSupabase) {
    await verifySupabase();
  }
  if (site || args.includes("--site") || process.env.SITE_URL) {
    await verifySite();
  }
  if (!doSupabase && !site && !process.env.SITE_URL) {
    console.log(
      "Usage:\n" +
        "  node scripts/verify-vote-api.mjs --supabase   # needs SUPABASE_* env\n" +
        "  node scripts/verify-vote-api.mjs --site https://....vercel.app [--post]"
    );
    process.exitCode = 1;
  }
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
