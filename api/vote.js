/**
 * Vercel serverless: votes in Cloud Firestore (Firebase) via Admin SDK.
 *
 * Env (pick one credential style):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — full service account JSON string (recommended on Vercel)
 * or
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   (PRIVATE_KEY: paste with literal \n for newlines, or real newlines in Vercel multiline field)
 *
 * Firestore layout:
 *   counters/poll  → { girl: number, boy: number }
 *   votes/{autoId} → { display_name, gender_vote, createdAt }
 */

var admin = require("firebase-admin");

var COUNTERS_REF = "counters/poll";
var VOTES_COLLECTION = "votes";

function initFirebase() {
  if (admin.apps.length) {
    return admin.app();
  }
  var json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    var cred;
    try {
      cred = JSON.parse(json);
    } catch (e) {
      return null;
    }
    admin.initializeApp({
      credential: admin.credential.cert(cred),
    });
    return admin.app();
  }
  var projectId = process.env.FIREBASE_PROJECT_ID;
  var clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  var privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
    return admin.app();
  }
  return null;
}

function getDb() {
  var app = initFirebase();
  if (!app) return null;
  return admin.firestore();
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

async function readCounts(db) {
  var snap = await db.doc(COUNTERS_REF).get();
  if (!snap.exists) {
    return { girl: 0, boy: 0, total: 0 };
  }
  var d = snap.data() || {};
  var girl = Math.max(0, parseInt(d.girl, 10) || 0);
  var boy = Math.max(0, parseInt(d.boy, 10) || 0);
  return { girl: girl, boy: boy, total: girl + boy };
}

async function recordVote(db, name, vote) {
  var ref = db.doc(COUNTERS_REF);
  var votesCol = db.collection(VOTES_COLLECTION);
  await db.runTransaction(async function (tx) {
    var snap = await tx.get(ref);
    var girl = 0;
    var boy = 0;
    if (snap.exists) {
      var d = snap.data() || {};
      girl = Math.max(0, parseInt(d.girl, 10) || 0);
      boy = Math.max(0, parseInt(d.boy, 10) || 0);
    }
    if (vote === "girl") {
      girl += 1;
    } else {
      boy += 1;
    }
    tx.set(ref, { girl: girl, boy: boy }, { merge: true });
    var voteRef = votesCol.doc();
    tx.set(voteRef, {
      display_name: name,
      gender_vote: vote,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
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

  var db = getDb();
  if (!db) {
    return send(res, 503, {
      error:
        "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.",
    });
  }

  try {
    if (req.method === "GET") {
      var c = await readCounts(db);
      return send(res, 200, c);
    }

    if (req.method === "POST") {
      var body = parseJsonBody(req);
      var displayName = String((body && body.display_name) || "")
        .trim()
        .slice(0, 80);
      var vote = body && body.gender_vote;
      if (!displayName || (vote !== "boy" && vote !== "girl")) {
        return send(res, 400, {
          error: "Need display_name (1–80 chars) and gender_vote: boy or girl",
        });
      }

      await recordVote(db, displayName, vote);
      var c2 = await readCounts(db);
      return send(res, 201, c2);
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "Something went wrong" });
  }
};
