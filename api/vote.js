/**
 * Vercel serverless vote API backed by Neon Postgres.
 *
 * Table: public.votes
 *   name    text   — voter’s name
 *   gender  text   — 'boy' or 'girl'
 *
 * Env: DATABASE_URL
 */

var db = require("./_db");

async function getCounts() {
  var r = await db.query(
    "select gender, count(*)::int as n from public.votes group by gender"
  );
  var boy = 0;
  var girl = 0;
  r.rows.forEach(function (row) {
    if (row.gender === "boy") boy = Number(row.n) || 0;
    if (row.gender === "girl") girl = Number(row.n) || 0;
  });
  return { boy: boy, girl: girl, total: boy + girl };
}

async function insertVote(name, gender) {
  await db.query("insert into public.votes (name, gender) values ($1, $2)", [
    name,
    gender,
  ]);
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

  if (!process.env.DATABASE_URL) {
    return send(res, 503, {
      error: "Missing DATABASE_URL",
    });
  }

  try {
    if (req.method === "GET") {
      var c = await getCounts();
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
        await insertVote(parsed.name, parsed.gender);
      } catch (insErr) {
        console.error(insErr);
        var detail = String(insErr && insErr.message ? insErr.message : insErr).slice(
          0,
          400
        );
        return send(res, 502, {
          error: "Database write failed — check Neon table public.votes (columns name, gender).",
          detail: detail,
        });
      }
      var c2 = await getCounts();
      return send(res, 201, c2);
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    var outer = String(err && err.message ? err.message : err).slice(0, 400);
    return send(res, 500, { error: "Something went wrong", detail: outer });
  }
};
