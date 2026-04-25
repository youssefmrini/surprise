/**
 * Reveal target config (singleton).
 *
 * GET  -> current gender reveal target ("girl" | "boy")
 * POST -> update target (no auth; hidden admin URL workflow)
 *
 * Table: public.reveal_config
 * Env: DATABASE_URL
 */

var DEFAULT_GENDER = "girl";
var ROW_ID = "main";
var db = require("./_db");

function send(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function normalizeGender(v) {
  return v === "boy" || v === "girl" ? v : null;
}

function parseJsonBody(req) {
  var body = req.body;
  if (body == null || body === "") return {};
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8") || "{}");
    } catch (e) {
      return {};
    }
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body || "{}");
    } catch (e) {
      return {};
    }
  }
  if (typeof body === "object") return body;
  return {};
}

function readStreamJson(req) {
  return new Promise(function (resolve) {
    if (!req || typeof req.on !== "function") {
      resolve({});
      return;
    }
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      try {
        var raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", function () {
      resolve({});
    });
  });
}

async function fetchConfig() {
  var r = await db.query(
    "select reveal_gender, updated_at from public.reveal_config where id = $1 limit 1",
    [ROW_ID]
  );
  var row = r.rows && r.rows[0] ? r.rows[0] : null;
  var gender = normalizeGender(row && row.reveal_gender) || DEFAULT_GENDER;
  return {
    id: ROW_ID,
    gender: gender,
    updated_at: row && row.updated_at ? row.updated_at : null,
  };
}

async function saveConfig(gender) {
  var r = await db.query(
    "insert into public.reveal_config (id, reveal_gender) values ($1, $2) on conflict (id) do update set reveal_gender = excluded.reveal_gender, updated_at = now() returning reveal_gender, updated_at",
    [ROW_ID, gender]
  );
  var row = r.rows && r.rows[0] ? r.rows[0] : null;
  return {
    id: ROW_ID,
    gender: normalizeGender(row && row.reveal_gender) || gender,
    updated_at: row && row.updated_at ? row.updated_at : null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.DATABASE_URL) {
    return send(res, 503, {
      error: "Missing DATABASE_URL",
    });
  }

  try {
    if (req.method === "GET") {
      var current = await fetchConfig();
      return send(res, 200, current);
    }

    var body = parseJsonBody(req);
    var gender = normalizeGender(body && body.gender);
    if (!gender) {
      body = await readStreamJson(req);
      gender = normalizeGender(body && body.gender);
    }
    if (!gender) {
      return send(res, 400, { error: "Need gender: boy or girl" });
    }

    var saved = await saveConfig(gender);
    return send(res, 200, saved);
  } catch (err) {
    console.error(err);
    return send(res, 502, {
      error: "Reveal config failed — create public.reveal_config in Neon.",
      detail: String(err && err.message ? err.message : err).slice(0, 400),
    });
  }
};
