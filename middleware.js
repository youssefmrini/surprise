/**
 * Protect admin HTML + admin APIs with HTTP Basic Auth.
 * Set ADMIN_PASSWORD in Vercel Environment Variables (never commit it).
 *
 * Public: GET /api/reveal (main site unveil link), /api/vote, /api/guess, static assets.
 */

export const config = {
  matcher: ["/admin.html", "/ad", "/api/admin", "/api/reveal"],
};

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  var out = 0;
  for (var i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function passwordFromBasicAuth(request) {
  var h = request.headers.get("authorization");
  if (!h || h.slice(0, 6).toLowerCase() !== "basic ") return null;
  try {
    var raw = atob(h.slice(6).trim());
    var colon = raw.indexOf(":");
    return colon >= 0 ? raw.slice(colon + 1) : null;
  } catch (e) {
    return null;
  }
}

export default function middleware(request) {
  var url = new URL(request.url);
  var path = url.pathname;
  var method = request.method || "GET";

  if (method === "OPTIONS") {
    return fetch(request);
  }

  if (path === "/api/reveal" && method === "GET") {
    return fetch(request);
  }

  var expected = process.env.ADMIN_PASSWORD;
  if (!expected || String(expected).length === 0) {
    return new Response(
      "Admin auth not configured. Set ADMIN_PASSWORD in project env.",
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  var provided = passwordFromBasicAuth(request);
  if (!safeEqual(provided || "", String(expected))) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Reveal Admin"',
        "Cache-Control": "no-store",
      },
    });
  }

  return fetch(request);
}
