/**
 * Admin JSON: votes + quiz guesses (newest first).
 * Auth: Authorization: Bearer <ADMIN_SECRET>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET
 */

var LIMIT = 500;

function send(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function bearerToken(req) {
  var a = req.headers.authorization || req.headers.Authorization;
  if (!a) return null;
  a = String(a).trim();
  if (a.toLowerCase().indexOf("bearer ") !== 0) return null;
  return a.slice(7).trim();
}

async function fetchRows(supabaseUrl, serviceKey, table, columns) {
  var url =
    supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/" +
    table +
    "?select=" +
    columns +
    "&order=created_at.desc&limit=" +
    LIMIT;
  var res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
    },
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error(table + " " + res.status + " " + t.slice(0, 200));
  }
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  var secret = process.env.ADMIN_SECRET;
  if (!secret || String(secret).length < 12) {
    return send(res, 503, {
      error:
        "ADMIN_SECRET is not set on the server (min 12 chars). Add it in Vercel env and redeploy.",
    });
  }

  if (bearerToken(req) !== secret) {
    return send(res, 401, { error: "Unauthorized — use Authorization: Bearer <ADMIN_SECRET>" });
  }

  var supabaseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return send(res, 503, {
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  try {
    var votes;
    var guesses;
    try {
      votes = await fetchRows(
        supabaseUrl,
        serviceKey,
        "votes",
        "name,gender,created_at"
      );
    } catch (vErr) {
      console.error(vErr);
      votes = [];
    }
    try {
      guesses = await fetchRows(
        supabaseUrl,
        serviceKey,
        "quiz_guesses",
        "text,passed,created_at"
      );
    } catch (gErr) {
      console.error(gErr);
      guesses = [];
    }

    return send(res, 200, {
      votes: votes,
      guesses: guesses,
      limit: LIMIT,
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, {
      error: "Failed to load data",
      detail: String(err && err.message ? err.message : err).slice(0, 400),
    });
  }
};
