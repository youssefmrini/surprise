/**
 * Log quiz gate submissions (every guess, pass or fail).
 *
 * Table: public.quiz_guesses — text, passed, created_at (default now())
 * Env: DATABASE_URL
 */

var db = require("./_db");

function send(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
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

async function insertGuess(text, passed) {
  await db.query(
    "insert into public.quiz_guesses (text, passed) values ($1, $2)",
    [text, !!passed]
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.DATABASE_URL) {
    return send(res, 503, {
      error: "Missing DATABASE_URL",
    });
  }

  try {
    var body = parseJsonBody(req);
    var raw =
      body && body.text != null
        ? String(body.text)
        : body && body.guess != null
          ? String(body.guess)
          : "";
    raw = raw.trim().slice(0, 280);
    if (!raw) {
      body = await readStreamJson(req);
      raw =
        body && body.text != null
          ? String(body.text).trim().slice(0, 280)
          : body && body.guess != null
            ? String(body.guess).trim().slice(0, 280)
            : "";
    }
    if (!raw) {
      return send(res, 400, { error: "Need non-empty text (max 280 chars)" });
    }

    var passed =
      body.passed === true ||
      body.passed === "true" ||
      body.unlocked === true;

    try {
      await insertGuess(raw, passed);
    } catch (insErr) {
      console.error(insErr);
      var detail = String(
        insErr && insErr.message ? insErr.message : insErr
      ).slice(0, 400);
      return send(res, 502, {
        error:
          "Database write failed — create public.quiz_guesses in Neon.",
        detail: detail,
      });
    }

    return send(res, 201, { ok: true });
  } catch (err) {
    console.error(err);
    return send(res, 500, {
      error: "Something went wrong",
      detail: String(err && err.message ? err.message : err).slice(0, 400),
    });
  }
};
