/**
 * Vercel serverless — no npm deps: Supabase Postgres via REST (fetch only).
 *
 * Table: public.votes
 *   name    text   — voter’s name
 *   gender  text   — 'boy' or 'girl'
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Schema: supabase/schema.sql (run in Supabase SQL Editor)
 */

var TABLE = "votes";

async function countForGender(supabaseUrl, serviceKey, gender) {
  var url =
    supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/" +
    TABLE +
    "?gender=eq." +
    encodeURIComponent(gender) +
    "&select=id";
  var res = await fetch(url, {
    method: "HEAD",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error("count failed: " + res.status + " " + t);
  }
  var cr = res.headers.get("content-range") || "";
  var m = cr.match(/\/(\d+)\s*$/);
  var n = m ? parseInt(m[1], 10) : 0;
  return isNaN(n) ? 0 : n;
}

async function getCounts(supabaseUrl, serviceKey) {
  var boy = await countForGender(supabaseUrl, serviceKey, "boy");
  var girl = await countForGender(supabaseUrl, serviceKey, "girl");
  return { boy: boy, girl: girl, total: boy + girl };
}

async function insertVote(supabaseUrl, serviceKey, name, gender) {
  var url = supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + TABLE;
  var res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: name,
      gender: gender,
    }),
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error("insert failed: " + res.status + " " + t);
  }
}

function send(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

/** Vercel may set req.body as object, string, or Buffer depending on runtime. */
function parseJsonBody(req) {
  var body = req.body;
  if (body == null || body === "") {
    return {};
  }
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
  if (typeof body === "object") {
    return body;
  }
  return {};
}

/** Fallback when body parser left req.body empty (some Vercel / POST combos). */
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

function readNameAndGender(body) {
  var name =
    (body && body.name) != null
      ? body.name
      : body && body.display_name != null
        ? body.display_name
        : "";
  name = String(name)
    .trim()
    .slice(0, 80);
  var gender = body && body.gender != null ? body.gender : body && body.gender_vote;
  gender = gender === "boy" || gender === "girl" ? gender : null;
  return { name: name, gender: gender };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") {
      return res.status(204).end();
    }
    res.statusCode = 204;
    return res.end();
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
      var c = await getCounts(supabaseUrl, serviceKey);
      return send(res, 200, c);
    }

    if (req.method === "POST") {
      var body = parseJsonBody(req);
      var parsed = readNameAndGender(body);
      if (!parsed.name || !parsed.gender) {
        body = await readStreamJson(req);
        parsed = readNameAndGender(body);
      }
      if (!parsed.name || !parsed.gender) {
        return send(res, 400, {
          error:
            "Need name (1–80 chars) and gender: boy or girl (also accepts display_name + gender_vote for older clients)",
        });
      }

      try {
        await insertVote(supabaseUrl, serviceKey, parsed.name, parsed.gender);
      } catch (insErr) {
        console.error(insErr);
        var detail = String(insErr && insErr.message ? insErr.message : insErr).slice(
          0,
          400
        );
        return send(res, 502, {
          error: "Database write failed — check Supabase table public.votes (columns name, gender).",
          detail: detail,
        });
      }
      var c2 = await getCounts(supabaseUrl, serviceKey);
      return send(res, 201, c2);
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    var outer = String(err && err.message ? err.message : err).slice(0, 400);
    return send(res, 500, { error: "Something went wrong", detail: outer });
  }
};
