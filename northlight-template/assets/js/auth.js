/* ==========================================================================
   Northlight storefront — auth.js
   Shared behaviour for the sign-up and login pages. No dependencies.

     - animated particle background (#authCanvas)
     - password visibility toggle (#passwordToggle)
     - window.NL.post() — tiny JSON helper used by signup.js / login.js
   Page-specific validation lives in signup.js / login.js.
   ========================================================================== */
(function () {
  "use strict";

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  /* ------------------- 1. Animated particle background -------------------- */
  /*  Nodes drift slowly across the viewport; any two that come within
      LINK_DISTANCE of each other are joined by a faint line. Everything is
      device-pixel-ratio aware, and the loop stops when the tab is hidden.
      If you add your own background image (.auth__media in the page), the
      particle field removes itself and stays out of the way.               */

  var canvas = $("#authCanvas");

  function startParticles(cv) {
    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var ACCENT = "216, 31, 48";
    var LINK_DISTANCE = 140; // px
    var SPEED = 0.16; // px per frame at 60fps
    var nodes = [];
    var width = 0;
    var height = 0;
    var dpr = 1;
    var frame = null;
    var lastTime = 0;

    var reduceMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      cv.width = Math.round(width * dpr);
      cv.height = Math.round(height * dpr);
      cv.style.width = width + "px";
      cv.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeNode() {
      var angle = Math.random() * Math.PI * 2;
      var speed = SPEED * (0.55 + Math.random() * 0.9);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.3 + Math.random() * 1.5,
      };
    }

    function seed() {
      var target = Math.round((width * height) / 13000);
      target = Math.max(30, Math.min(target, 95));

      nodes = [];
      for (var i = 0; i < target; i += 1) nodes.push(makeNode());
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      var i;
      var j;
      var a;
      var b;
      var dx;
      var dy;
      var dist;

      // links first, so the dots sit on top of them
      for (i = 0; i < nodes.length; i += 1) {
        a = nodes[i];
        for (j = i + 1; j < nodes.length; j += 1) {
          b = nodes[j];
          dx = a.x - b.x;
          dy = a.y - b.y;
          dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < LINK_DISTANCE) {
            var strength = 1 - dist / LINK_DISTANCE;
            ctx.strokeStyle =
              "rgba(" + ACCENT + "," + (strength * 0.3).toFixed(3) + ")";
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (i = 0; i < nodes.length; i += 1) {
        a = nodes[i];

        var halo = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 4);
        halo.addColorStop(0, "rgba(" + ACCENT + ",0.18)");
        halo.addColorStop(1, "rgba(" + ACCENT + ",0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(" + ACCENT + ",0.5)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function move(step60) {
      var i;
      var node;

      for (i = 0; i < nodes.length; i += 1) {
        node = nodes[i];
        node.x += node.vx * step60;
        node.y += node.vy * step60;

        // wrap around the edges so the field never thins out
        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;
      }
    }

    function loop(time) {
      var step60 = lastTime ? Math.min((time - lastTime) / 16.667, 3) : 1;
      lastTime = time;

      move(step60);
      step();
      frame = window.requestAnimationFrame(loop);
    }

    function play() {
      if (reduceMotion) {
        step(); // single still frame
        return;
      }
      if (frame === null) {
        lastTime = 0;
        frame = window.requestAnimationFrame(loop);
      }
    }

    function pause() {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }

    sizeCanvas();
    seed();
    play();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        sizeCanvas();
        seed();
        if (reduceMotion) step();
      }, 180);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else play();
    });
  }

  if (canvas) {
    // your own artwork takes over when .auth__media is present
    if ($(".auth__media")) {
      canvas.remove();
    } else {
      startParticles(canvas);
    }
  }

  /* --------------------- 2. Password visibility toggle -------------------- */

  var password = $("#password");
  var toggle = $("#passwordToggle");

  if (password && toggle) {
    toggle.addEventListener("click", function () {
      var show = password.type === "password";
      password.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", show ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password"
      );
      password.focus({ preventScroll: true });
    });
  }
  /* ------------------------- 3. Tiny API helper --------------------------- */
  /*  Posts JSON to the backend and always resolves with
      { ok, status, data }, so callers can branch on ok. A network failure
      (for example when the page is opened straight from disk) rejects, which
      is what the forms turn into a "backend not running" message.           */

  window.NL = {
    // true when the browser is actually holding a session cookie
    session: function () {
      return fetch("api/me", { credentials: "same-origin" })
        .then(function (response) {
          return response.ok;
        })
        .catch(function () {
          return false;
        });
    },

    post: function (url, body) {
      return fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { ok: response.ok, status: response.status, data: data };
          });
      });
    },
  };
})();
