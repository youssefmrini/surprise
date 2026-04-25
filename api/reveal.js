/**
 * Reveal target config (singleton).
 *
 * GET  -> current gender reveal target ("girl" | "boy")
 * POST -> update target (no auth; hidden admin URL workflow)
 *
 * Table: public.reveal_config
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

var DEFAULT_GENDER = "girl";
var ROW_ID = "main";

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

async function fetchConfig(supabaseUrl, serviceKey) {
  var url =
    supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/reveal_config?select=id,reveal_gender,updated_at&id=eq." +
    encodeURIComponent(ROW_ID) +
    "&limit=1";
  var res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
    },
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error("select failed: " + res.status + " " + t.slice(0, 260));
  }
  var rows = await res.json();
  var row = rows && rows[0] ? rows[0] : null;
  var gender = normalizeGender(row && row.reveal_gender) || DEFAULT_GENDER;
  return {
    id: ROW_ID,
    gender: gender,
    updated_at: row && row.updated_at ? row.updated_at : null,
  };
}

async function saveConfig(supabaseUrl, serviceKey, gender) {
  var url =
    supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/reveal_config?on_conflict=id&select=id,reveal_gender,updated_at";
  var res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      id: ROW_ID,
      reveal_gender: gender,
    }),
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error("upsert failed: " + res.status + " " + t.slice(0, 260));
  }
  var rows = await res.json();
  var row = rows && rows[0] ? rows[0] : null;
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

  var supabaseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return send(res, 503, {
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  try {
    if (req.method === "GET") {
      var current = await fetchConfig(supabaseUrl, serviceKey);
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

    var saved = await saveConfig(supabaseUrl, serviceKey, gender);
    return send(res, 200, saved);
  } catch (err) {
    console.error(err);
    return send(res, 502, {
      error:
        "Reveal config failed — create public.reveal_config (see supabase/schema.sql).",
      detail: String(err && err.message ? err.message : err).slice(0, 400),
    });
  }
};
