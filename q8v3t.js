(function () {
  "use strict";

  function dec(b) {
    try {
      return decodeURIComponent(escape(atob(b)));
    } catch (e) {
      return "";
    }
  }

  var B = [
    "VGhlIG1vbWVudCB5b3UndmUgYmVlbiB3YWl0aW5nIGZvcuKApg==",
    "SXQncyBh",
    "Qk9Z",
    "Qmx1ZSBjb25mZXR0aSwgZnVsbCBoZWFydHMsIGFuZCBhIHdob2xlIG5ldyBjaGFwdGVyIGZvciBvdXIgZmFtaWx5Lg==",
    "TXJpbmkgRmFtaWx5",
  ];

  function fill() {
    var lp = document.getElementById("lp");
    var h1a = document.getElementById("h1a");
    var h1b = document.getElementById("h1b");
    var ls = document.getElementById("ls");
    var lx = document.getElementById("lx");
    if (lp) lp.textContent = dec(B[0]);
    if (h1a) h1a.textContent = dec(B[1]);
    if (h1b) {
      var t = dec(B[2]);
      h1b.textContent = t;
      h1b.setAttribute("data-x", t);
    }
    if (ls) ls.textContent = dec(B[3]);
    if (lx) lx.textContent = dec(B[4]);
  }

  /** Full circle of 👏 for 5s, then fade out (unveil moment). */
  function startApplauseRing() {
    var host = document.getElementById("applauseRing");
    if (!host || host.childElementCount > 0) return;
    var n = 16;
    var i;
    for (i = 0; i < n; i++) {
      var slot = document.createElement("span");
      slot.className = "applause-ring__slot";
      slot.setAttribute("aria-hidden", "true");
      slot.style.setProperty("--a", (360 / n) * i + "deg");
      slot.style.setProperty("--i", String(i));
      slot.textContent = "\uD83D\uDC4F";
      host.appendChild(slot);
    }
    window.setTimeout(function () {
      host.classList.add("applause-ring--out");
    }, 5000);
    window.setTimeout(function () {
      host.setAttribute("hidden", "");
    }, 5800);
  }

  function boot() {
    fill();
    startApplauseRing();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  var canvas = document.getElementById("fx");
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canvas || !canvas.getContext || reduced) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w;
  var h;
  var parts = [];
  var colors = [
    "#4da3ff",
    "#7ec8ff",
    "#e8f4ff",
    "#5ad4e6",
    "#a8e6ff",
    "#9db4ff",
    "#ffffff",
  ];

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnBurst(n) {
    var cx = w * 0.5;
    var cy = h * 0.38;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      var sp = 6 + Math.random() * 14;
      parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 4,
        g: 0.12 + Math.random() * 0.1,
        life: 0,
        max: 3200 + Math.random() * 1800,
        s: 3 + Math.random() * 9,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        c: colors[(Math.random() * colors.length) | 0],
        type: Math.random() > 0.45 ? "rect" : "circ",
      });
    }
  }

  function spawnAmbient() {
    if (parts.length > 180) return;
    parts.push({
      x: Math.random() * w,
      y: h + 8,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -2 - Math.random() * 3,
      g: -0.02,
      life: 0,
      max: 6000 + Math.random() * 4000,
      s: 2 + Math.random() * 4,
      rot: 0,
      vr: 0,
      c: colors[(Math.random() * colors.length) | 0],
      type: "spark",
    });
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  spawnBurst(140);
  window.setInterval(function () {
    spawnAmbient();
  }, 180);

  var start = performance.now();

  function frame(now) {
    var t = now - start;
    ctx.clearRect(0, 0, w, h);
    var next = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life += 16;
      if (p.life > p.max) continue;
      next.push(p);
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      var fade = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, fade * (p.type === "spark" ? 0.55 : 0.95));
      ctx.fillStyle = p.c;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.type === "circ") {
        ctx.beginPath();
        ctx.arc(0, 0, p.s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "spark") {
        ctx.fillRect(-0.5, -p.s, 1, p.s * 2);
      } else {
        ctx.fillRect(-p.s * 0.5, -p.s * 0.7, p.s, p.s * 1.4);
      }
      ctx.restore();
    }
    parts = next;
    ctx.globalAlpha = 1;
    if (t < 8000 && Math.random() < 0.08) spawnBurst(12);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
