(function () {
  "use strict";

  /* Party countdown + when the Unveil button activates (same moment). */
  var TARGET = new Date(2026, 4, 23, 15, 0, 0);
  var POLL_KEY = "jihaneGenderPollCounts";
  var VOTE_KEY = "jihaneGenderMyVote";
  var SESSION_UNLOCK = "jihaneRevealOk";
  var VOTE_BANNER_KEY = "jihaneVoteBanner";
  var voteMeta =
    typeof document !== "undefined" &&
    document.querySelector('meta[name="vote-api"]');
  var voteApiRaw = voteMeta && voteMeta.getAttribute("content");
  var API_VOTE =
    voteApiRaw && String(voteApiRaw).trim()
      ? String(voteApiRaw).trim().replace(/\/$/, "")
      : "/api/vote";
  var pollUiRef = null;
  var unveilClickGuardBound = false;

  function b64utf8(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function fillRevealHeadline() {
    var line = document.getElementById("v0t");
    var sub = document.getElementById("v0s");
    if (!line || !sub || line.textContent) return;
    line.textContent = b64utf8("SmloYW5lIGlzIHByZWduYW50");
    sub.textContent = b64utf8("V2XigJlyZSBzbyBoYXBweSBpdCBhbG1vc3QgZG9lc27igJl0IGZlZWwgcmVhbA==");
  }

  function bindUnveilClickGuard() {
    var el = document.getElementById("u0z");
    if (!el || unveilClickGuardBound) return;
    unveilClickGuardBound = true;
    el.addEventListener("click", function (e) {
      if (el.classList.contains("buv-x")) {
        e.preventDefault();
      }
    });
  }

  function voteLocked() {
    try {
      return sessionStorage.getItem("jihaneVoteSubmitted") === "1";
    } catch (e) {
      return false;
    }
  }

  function setVoteLocked() {
    try {
      sessionStorage.setItem("jihaneVoteSubmitted", "1");
    } catch (e) {
      /* ignore */
    }
  }

  function saveVoteBanner(name, vote) {
    try {
      sessionStorage.setItem(
        VOTE_BANNER_KEY,
        JSON.stringify({ n: name, v: vote })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function readVoteBanner() {
    try {
      var raw = sessionStorage.getItem(VOTE_BANNER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  var hintMessages = [
    "Colder: think less ‘we bought a couch,’ more ‘we might need a smaller couch.’",
    "You’re not wrong to guess big life stuff—just… smaller shoes involved.",
    "If it helps: the kind of secret you tell your mom and she screams a little.",
    "Still stuck? Think life update that usually comes with a plus-one on the family tree.",
  ];
  var hintIndex = 0;

  function normalizeAnswer(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function passesExpectation(raw) {
    var a = normalizeAnswer(raw);
    if (a.length < 2) return false;

    /* Anything clearly about a baby or pregnancy passes (incl. common typos/slang). */
    var strong = [
      "baby",
      "babies",
      "babi",
      "babby",
      "babie",
      "bebe",
      "bebes",
      "beb",
      "pregnant",
      "pregnancy",
      "pregnan",
      "pregnat",
      "pregent",
      "pregrent",
      "preagnant",
      "pregancy",
      "pregrenacy",
      "prego",
      "preggers",
      "preggy",
      "preg",
      "prenatal",
      "postpartum",
      "expecting",
      "expectant",
      "newborn",
      "infant",
      "neonat",
      "fetus",
      "foetus",
      "womb",
      "conceive",
      "conception",
      "impregn",
      "gravida",
      "gestation",
      "gestate",
      "trimester",
      "ultrasound",
      "sonogram",
      "nursery",
      "stork",
      "maternity",
      "midwife",
      "doula",
      "lactation",
      "breastfeed",
      "bump",
      "cradle",
      "onesie",
      "pacifier",
      "diaper",
      "nappy",
      "lullab",
      "toddler",
      "enceinte",
      "grossesse",
      "embaraz",
      "embarazo",
      "schwanger",
      "zwanger",
      "hamil",
      "bundle of joy",
      "little one",
      "little bundle",
      "knocked up",
      "baby bump",
      "babybump",
      "with child",
      "giving birth",
      "give birth",
      "childbirth",
      "due date",
      "duedate",
      "mum to be",
      "mom to be",
      "mother to be",
      "dad to be",
      "father to be",
      "parent to be",
      "parents to be",
      "going to be a dad",
      "going to be a mom",
      "going to be a mum",
      "going to be parents",
      "we re having",
      "we are having",
      "were having",
      "were havin",
      "were gonna have",
      "gonna have a baby",
      "having a baby",
      "have a baby",
      "have another baby",
      "first baby",
      "second baby",
      "third baby",
      "unborn",
      "in utero",
    ];

    var i;
    for (i = 0; i < strong.length; i++) {
      var k = normalizeAnswer(strong[i].replace(/é/g, "e"));
      if (k && a.indexOf(k) !== -1) return true;
    }

    if (a.indexOf("little one") !== -1) return true;
    if (/\blittle\b/.test(a) && /\bone\b/.test(a)) return true;

    if (
      a.indexOf("having a") !== -1 &&
      /\b(baby|bebe|babi|kid|child)\b/.test(a)
    )
      return true;

    if (
      a.indexOf("having") !== -1 &&
      /\b(baby|bebe|babi|babies)\b/.test(a)
    )
      return true;

    if (
      a.indexOf("going to be") !== -1 &&
      /\b(parent|dad|mom|mum|father|mother|papa|mama|parents)\b/.test(a)
    )
      return true;

    if (a.indexOf("expect") !== -1) {
      if (/\b(baby|bebe|babi|child|kid|born)\b/.test(a)) return true;
      if (a.indexOf("little one") !== -1) return true;
    }

    if (
      a.indexOf("on the way") !== -1 &&
      /\b(baby|bebe|babi|kid|child|little)\b/.test(a)
    )
      return true;

    if (
      /\b(we|you|she|they|he|jihane|ihane)\b/.test(a) &&
      a.indexOf("preg") !== -1
    )
      return true;

    if (a.indexOf("preg") !== -1) return true;

    return false;
  }

  function burstConfetti() {
    var canvas = document.getElementById("confetti");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    var colors = [
      "#ffd6e8",
      "#cfefff",
      "#c8f5e4",
      "#fff3c4",
      "#e8ddff",
      "#ff8fb8",
      "#7ec8ff",
    ];
    var n = 96;
    var parts = [];
    for (var p = 0; p < n; p++) {
      parts.push({
        x: w * 0.5 + (Math.random() - 0.5) * 120,
        y: h * 0.22 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 14 - 4,
        g: 0.22 + Math.random() * 0.12,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        s: 4 + Math.random() * 7,
        c: colors[(Math.random() * colors.length) | 0],
        life: 0,
      });
    }

    var start = performance.now();
    function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, w, h);
      var alive = false;
      for (var i = 0; i < parts.length; i++) {
        var q = parts[i];
        q.life = t;
        if (t > 4200) continue;
        alive = true;
        q.vy += q.g;
        q.x += q.vx;
        q.y += q.vy;
        q.rot += q.vr;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.c;
        ctx.globalAlpha = Math.max(0, 1 - t / 4000);
        ctx.fillRect(-q.s * 0.5, -q.s * 0.5, q.s, q.s * 1.4);
        ctx.restore();
      }
      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }

  var countdownTimer = null;
  var pollBound = false;

  function renderBars(ui, c) {
    var g = c.girl || 0;
    var b = c.boy || 0;
    var total = g + b;
    var pg = total ? Math.round((g / total) * 100) : 0;
    var pb = total ? 100 - pg : 0;
    if (total === 0) {
      pg = 0;
      pb = 0;
    }
    ui.fillGirl.style.width = pg + "%";
    ui.fillBoy.style.width = pb + "%";
    ui.pctGirl.textContent = pg + "%";
    ui.pctBoy.textContent = pb + "%";
  }

  function syncYouMessage(ui) {
    var banner = readVoteBanner();
    if (voteLocked() && banner && banner.n && ui.nameInput) {
      ui.nameInput.value = banner.n;
    }
    if (
      voteLocked() &&
      banner &&
      banner.n &&
      (banner.v === "girl" || banner.v === "boy")
    ) {
      ui.you.textContent =
        "You’re in: " +
        banner.n +
        (banner.v === "girl" ? " — team pink" : " — team blue") +
        " ✓";
      return;
    }
    ui.you.textContent = "";
  }

  function applyVoteLockState(ui) {
    var locked = voteLocked();
    ui.buttons.forEach(function (btn) {
      btn.classList.toggle("is-locked", locked);
      btn.disabled = locked;
    });
    if (ui.nameInput) ui.nameInput.readOnly = locked;
  }

  function fetchVoteApi(method, jsonBody) {
    var init = { method: method || "GET", headers: {} };
    if (jsonBody != null) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(jsonBody);
    }
    return fetch(API_VOTE, init)
      .then(function (r) {
        return r.text().then(function (text) {
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              data = null;
            }
          }
          return {
            ok: r.ok,
            status: r.status,
            data: data,
            raw: text,
          };
        });
      })
      .catch(function () {
        return { ok: false, status: 0, data: null, raw: "", networkError: true };
      });
  }

  function revealDebugOn() {
    try {
      return (
        /[?&]debug=1(?:&|$)/.test(location.search) ||
        localStorage.getItem("reveal_debug") === "1"
      );
    } catch (e) {
      return false;
    }
  }

  function scoreboardOfflineHint(res) {
    if (location.protocol === "file:") {
      return revealDebugOn()
        ? "Open via npx vercel dev with .env.local (see .env.example)."
        : "Open this page from your published link — file:// won’t load the vote tally.";
    }
    if (res && res.networkError) {
      return revealDebugOn()
        ? "Can’t reach " +
            API_VOTE +
            '. Set <meta name="vote-api" to your /api/vote URL if the site is not on Vercel.'
        : "Can’t reach the vote server — counts here are only on this device.";
    }
    if (res && res.status === 503 && res.data && res.data.error) {
      var er = String(res.data.error);
      if (er.indexOf("SUPABASE") !== -1) {
        return revealDebugOn()
          ? "Vercel: add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Settings → Environment Variables), redeploy."
          : "Shared scoreboard isn’t on yet — you’ll only see counts saved on this device.";
      }
      return revealDebugOn()
        ? "Vote API: " + er.slice(0, 120)
        : "Vote server is unavailable — try again later.";
    }
    if (res && res.status === 404) {
      return revealDebugOn()
        ? "No /api/vote here — deploy on Vercel or set meta vote-api."
        : "Vote tally isn’t available on this address.";
    }
    if (res && res.status) {
      return revealDebugOn()
        ? "Vote API HTTP " +
            res.status +
            " — check Vercel logs; ensure public.votes exists (supabase/schema.sql)."
        : "Something went wrong loading the tally — try again later.";
    }
    return revealDebugOn()
      ? "No live scoreboard — vercel dev + .env.local or fix Vercel env vars."
      : "Live tally isn’t available — offline counts on this device only.";
  }

  function refreshPollTotals() {
    if (!pollUiRef) return;
    var ui = pollUiRef;
    var statusEl = document.getElementById("a0z");

    fetchVoteApi("GET").then(function (res) {
      if (
        res.ok &&
        res.data &&
        typeof res.data.girl === "number" &&
        typeof res.data.boy === "number"
      ) {
        renderBars(ui, { girl: res.data.girl, boy: res.data.boy });
        if (statusEl) {
          statusEl.className = "poll-status poll-status--ok";
          statusEl.textContent =
            res.data.total > 0
              ? "Live tally — " +
                res.data.total +
                " vote" +
                (res.data.total === 1 ? "" : "s") +
                " so far"
              : "Live tally — be the first to vote";
        }
        applyVoteLockState(ui);
        syncYouMessage(ui);
        return;
      }
      renderBars(ui, getPollCounts());
      if (statusEl) {
        statusEl.className = "poll-status poll-status--warn";
        statusEl.textContent = res.ok
          ? "Vote API returned an unexpected response (expected girl/boy counts)."
          : scoreboardOfflineHint(res);
      }
      applyVoteLockState(ui);
      syncYouMessage(ui);
    });
  }

  function postVote(name, vote) {
    return fetchVoteApi("POST", { name: name, gender: vote }).then(function (
      res
    ) {
      if (res.ok && res.data) return res.data;
      return Promise.reject(res);
    });
  }

  function unveilPreviewOn() {
    try {
      if (
        /[?&]unveil_preview=1(?:&|$)/.test(location.search) ||
        /[?&]unveil_preview=true(?:&|$)/i.test(location.search)
      ) {
        return true;
      }
      if (localStorage.getItem("unveil_preview") === "1") return true;
    } catch (e) {
      /* ignore */
    }
    return false;
  }

  function syncUnveilButton() {
    var el = document.getElementById("u0z");
    var hint = document.getElementById("w0z");
    if (!el) return;

    var ready = unveilPreviewOn() || Date.now() >= TARGET.getTime();

    if (ready) {
      el.classList.remove("buv-x");
      el.setAttribute("aria-disabled", "false");
      el.removeAttribute("tabindex");
      if (hint) hint.hidden = true;
    } else {
      el.classList.add("buv-x");
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
      if (hint) hint.hidden = false;
    }
  }

  function startCountdown(els) {
    function pad(n) {
      return String(n).padStart(2, "0");
    }
    function tick() {
      var now = Date.now();
      var diff = Math.max(0, TARGET.getTime() - now);
      var s = Math.floor(diff / 1000);
      var days = Math.floor(s / 86400);
      s -= days * 86400;
      var hours = Math.floor(s / 3600);
      s -= hours * 3600;
      var minutes = Math.floor(s / 60);
      var seconds = s - minutes * 60;

      if (els.days) els.days.textContent = String(days);
      if (els.hours) els.hours.textContent = pad(hours);
      if (els.minutes) els.minutes.textContent = pad(minutes);
      if (els.seconds) els.seconds.textContent = pad(seconds);
      syncUnveilButton();
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function setupPhotoReveal(frame) {
    if (!frame) return;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              frame.classList.add("is-visible");
              io.unobserve(frame);
            }
          });
        },
        { threshold: 0.18 }
      );
      io.observe(frame);
    } else {
      frame.classList.add("is-visible");
    }
  }

  function getPollCounts() {
    try {
      var raw = localStorage.getItem(POLL_KEY);
      if (!raw) return { girl: 0, boy: 0 };
      var o = JSON.parse(raw);
      return {
        girl: Math.max(0, parseInt(o.girl, 10) || 0),
        boy: Math.max(0, parseInt(o.boy, 10) || 0),
      };
    } catch (e) {
      return { girl: 0, boy: 0 };
    }
  }

  function savePollCounts(c) {
    localStorage.setItem(POLL_KEY, JSON.stringify({ girl: c.girl, boy: c.boy }));
  }

  function getMyVote() {
    var v = localStorage.getItem(VOTE_KEY);
    if (v === "girl" || v === "boy") return v;
    return null;
  }

  function setMyVote(v) {
    if (v) localStorage.setItem(VOTE_KEY, v);
    else localStorage.removeItem(VOTE_KEY);
  }

  function bindPoll() {
    var fillGirl = document.getElementById("j0a");
    var fillBoy = document.getElementById("j0b");
    var pctGirl = document.getElementById("t0a");
    var pctBoy = document.getElementById("t0b");
    var you = document.getElementById("y0z");
    var nameInput = document.getElementById("n0z");
    var nameHint = document.getElementById("h0z");
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll("[data-p]")
    );

    if (!fillGirl || !fillBoy || !buttons.length) return;

    var ui = {
      fillGirl: fillGirl,
      fillBoy: fillBoy,
      pctGirl: pctGirl,
      pctBoy: pctBoy,
      you: you,
      buttons: buttons,
      nameInput: nameInput,
    };

    pollUiRef = ui;
    refreshPollTotals();

    if (pollBound) return;
    pollBound = true;

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (voteLocked()) return;

        var p = btn.getAttribute("data-p");
        if (p !== "0" && p !== "1") return;
        var choice = p === "0" ? "girl" : "boy";

        var name = nameInput ? nameInput.value.trim() : "";
        if (!name) {
          if (nameHint) nameHint.hidden = false;
          if (nameInput) {
            nameInput.classList.remove("poll__name-input--shake");
            void nameInput.offsetWidth;
            nameInput.classList.add("poll__name-input--shake");
          }
          return;
        }
        if (nameHint) nameHint.hidden = true;

        postVote(name, choice)
          .then(function (data) {
            renderBars(ui, { girl: data.girl, boy: data.boy });
            setVoteLocked();
            saveVoteBanner(name, choice);
            setMyVote(choice);
            applyVoteLockState(ui);
            syncYouMessage(ui);
            var st = document.getElementById("a0z");
            if (st) {
              st.className = "poll-status poll-status--ok";
              st.textContent =
                "Live tally — " +
                data.total +
                " vote" +
                (data.total === 1 ? "" : "s") +
                " so far";
            }
          })
          .catch(function (err) {
            var counts = getPollCounts();
            counts[choice] += 1;
            savePollCounts(counts);
            renderBars(ui, counts);
            setVoteLocked();
            saveVoteBanner(name, choice);
            setMyVote(choice);
            applyVoteLockState(ui);
            syncYouMessage(ui);
            var st = document.getElementById("a0z");
            if (st) {
              st.className = "poll-status poll-status--warn";
              var extra = "";
              if (
                revealDebugOn() &&
                err &&
                err.status === 503 &&
                err.data &&
                String(err.data.error || "").indexOf("SUPABASE") !== -1
              ) {
                extra =
                  " (Host: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.)";
              }
              st.textContent =
                "Couldn’t sync your vote — saved on this device only." + extra;
            }
          });
      });
    });
  }

  var quizForm = document.getElementById("f0z");
  var expectation = document.getElementById("e0z");
  var quizGate = document.getElementById("q0z");
  var revealSecret = document.getElementById("r0z");
  var quizFeedback = document.getElementById("b0z");
  var glassCard = document.querySelector("#q0z .glass-card");

  if (quizForm && expectation && quizGate && revealSecret) {
    quizForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = expectation.value;
      if (quizFeedback) {
        quizFeedback.hidden = true;
        quizFeedback.className = "wf1";
      }

      if (passesExpectation(text)) {
        var susp = document.getElementById("s0z");
        var submitBtn = quizForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        if (susp) susp.hidden = false;

        var delay = 1100 + Math.random() * 900;
        window.setTimeout(function () {
          if (susp) susp.hidden = true;
          if (submitBtn) submitBtn.disabled = false;
          try {
            sessionStorage.setItem(SESSION_UNLOCK, "1");
          } catch (err) {
            /* ignore */
          }
          if (glassCard) glassCard.classList.add("glass-card--gx");
          openReveal();
          burstConfetti();

          window.setTimeout(function () {
            revealSecret.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 200);
        }, delay);
      } else {
        document.body.classList.remove("body-ouch");
        void document.body.offsetWidth;
        document.body.classList.add("body-ouch");
        window.setTimeout(function () {
          document.body.classList.remove("body-ouch");
        }, 500);

        if (glassCard) {
          glassCard.classList.remove("shake");
          void glassCard.offsetWidth;
          glassCard.classList.add("shake");
        }
        if (quizFeedback) {
          quizFeedback.hidden = false;
          quizFeedback.className = "wf1 is-error";
          quizFeedback.textContent =
            "Haha, not that. Nudge: it’s the kind of news that comes with a due date. ";
          var hint = hintMessages[hintIndex % hintMessages.length];
          hintIndex += 1;
          quizFeedback.textContent += hint;
        }
      }
    });
  }

  function openReveal() {
    var quizGateEl = document.getElementById("q0z");
    var revealSecretEl = document.getElementById("r0z");
    if (quizGateEl) quizGateEl.hidden = true;
    if (revealSecretEl) revealSecretEl.hidden = false;

    fillRevealHeadline();

    var els = {
      days: document.querySelector('[data-q="d"]'),
      hours: document.querySelector('[data-q="h"]'),
      minutes: document.querySelector('[data-q="m"]'),
      seconds: document.querySelector('[data-q="s"]'),
      dateLabel: document.getElementById("d0z"),
    };
    if (els.dateLabel) {
      els.dateLabel.textContent =
        "Counting down to " +
        TARGET.toLocaleString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
    }
    if (!countdownTimer) startCountdown(els);
    setupPhotoReveal(document.getElementById("p0z"));
    bindPoll();
    bindUnveilClickGuard();
    syncUnveilButton();
  }

  try {
    if (sessionStorage.getItem(SESSION_UNLOCK) === "1") {
      openReveal();
      var frameEarly = document.getElementById("p0z");
      if (frameEarly) frameEarly.classList.add("is-visible");
    }
  } catch (e2) {
    /* private mode etc. */
  }

  syncUnveilButton();

  window.addEventListener(
    "resize",
    function () {
      /* confetti canvas clears on next burst */
    },
    { passive: true }
  );

  (function setupAmbientVideo() {
    var v = document.querySelector(".ambient__video");
    if (!v) return;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        v.removeAttribute("autoplay");
        v.pause();
        return;
      }
      v.play().catch(function () {
        /* Autoplay blocked: WebP poster still shows */
      });
    } catch (e1) {
      /* ignore */
    }
  })();
})();
