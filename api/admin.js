/**
 * Admin JSON: votes + quiz guesses (newest first).
 * No client secret — rely on obscure URL only (not for sensitive data).
 * Env: DATABASE_URL
 */

var LIMIT = 500;
var db = require("./_db");

function send(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function fetchVotes() {
  var r = await db.query(
    "select name, gender, created_at from public.votes order by created_at desc limit $1",
    [LIMIT]
  );
  return r.rows;
}

async function fetchGuesses() {
  var r = await db.query(
    "select text, passed, created_at from public.quiz_guesses order by created_at desc limit $1",
    [LIMIT]
  );
  return r.rows;
}

async function fetchRevealConfig() {
  var r = await db.query(
    "select reveal_gender, updated_at from public.reveal_config where id = $1 limit 1",
    ["main"]
  );
  var row = r.rows && r.rows[0] ? r.rows[0] : null;
  return {
    gender:
      row && (row.reveal_gender === "girl" || row.reveal_gender === "boy")
        ? row.reveal_gender
        : "girl",
    updated_at: row && row.updated_at ? row.updated_at : null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.DATABASE_URL) {
    return send(res, 503, {
      error: "Missing DATABASE_URL",
    });
  }

  try {
    var votes;
    var guesses;
    var reveal;
    try {
      votes = await fetchVotes();
    } catch (vErr) {
      console.error(vErr);
      votes = [];
    }
    try {
      guesses = await fetchGuesses();
    } catch (gErr) {
      console.error(gErr);
      guesses = [];
    }
    try {
      reveal = await fetchRevealConfig();
    } catch (rErr) {
      console.error(rErr);
      reveal = { gender: "girl", updated_at: null };
    }

    return send(res, 200, {
      votes: votes,
      guesses: guesses,
      reveal: reveal,
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
