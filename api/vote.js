/**
 * Vercel serverless: stores { display_name, gender_vote } in Supabase (Postgres).
 * Env: SUPABASE_URL (https://xxx.supabase.co), SUPABASE_SERVICE_ROLE_KEY (secret).
 */

async function countForVote(supabaseUrl, serviceKey, vote) {
  var url =
    supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/gender_predictions?gender_vote=eq." +
    encodeURIComponent(vote) +
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
  var boy = await countForVote(supabaseUrl, serviceKey, "boy");
  var girl = await countForVote(supabaseUrl, serviceKey, "girl");
  return { boy: boy, girl: girl, total: boy + girl };
}

async function insertVote(supabaseUrl, serviceKey, name, vote) {
  var url = supabaseUrl.replace(/\/$/, "") + "/rest/v1/gender_predictions";
  var res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      display_name: name,
      gender_vote: vote,
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
      var name = String((body && body.display_name) || "")
        .trim()
        .slice(0, 80);
      var vote = body && body.gender_vote;
      if (!name || (vote !== "boy" && vote !== "girl")) {
        return send(res, 400, {
          error: "Need display_name (1–80 chars) and gender_vote: boy or girl",
        });
      }

      await insertVote(supabaseUrl, serviceKey, name, vote);
      var c2 = await getCounts(supabaseUrl, serviceKey);
      return send(res, 201, c2);
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "Something went wrong" });
  }
};
