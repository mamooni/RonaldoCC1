/* ==========================================================================
   Northlight — settings.js

   The Settings page: the Account / Security tabs, the profile block, the email
   form and the password form.

   Real endpoints behind it (see server/app.py):
     GET  api/me                → {user: {id, username, email, created_at}}
     POST api/account/email     {email}               → {user}
     POST api/account/password  {current, password}   → {ok}

   Two things are deliberately local-only: the order stats come from this
   browser's completed orders (nl.orders.v1, written by cart.js) and the secret
   key switch is a remembered preference, not a second factor — the page says
   so out loud.
   ========================================================================== */

(function () {
  "use strict";

  var ORDERS_KEY = "nl.orders.v1";
  var SECRET_KEY = "nl.secretkey.v1";

  var tabs = document.querySelectorAll(".segmented__btn");
  var panels = {
    account: document.getElementById("panelAccount"),
    security: document.getElementById("panelSecurity"),
  };
  if (!panels.account) return; // not the settings page

  var ui = {
    initials: document.getElementById("userInitials"),
    name: document.getElementById("userName"),
    email: document.getElementById("userEmail"),
    badge: document.getElementById("userBadge"),
    join: document.getElementById("statJoin"),
    orders: document.getElementById("statOrders"),
    refund: document.getElementById("statRefund"),
    spent: document.getElementById("statSpent"),
    emailInput: document.getElementById("emailInput"),
    saveEmail: document.getElementById("saveEmail"),
    emailNote: document.getElementById("emailNote"),
    togglePassword: document.getElementById("togglePassword"),
    passwordForm: document.getElementById("passwordForm"),
    current: document.getElementById("currentPassword"),
    next: document.getElementById("newPassword"),
    confirm: document.getElementById("confirmPassword"),
    cancelPassword: document.getElementById("cancelPassword"),
    passwordNote: document.getElementById("passwordNote"),
    secretState: document.getElementById("secretState"),
    toggleSecret: document.getElementById("toggleSecret"),
  };

  /* ------------------------------------------------------------- helpers -- */

  function money(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    return "$" + v.toFixed(2);
  }

  function initials(username) {
    var parts = String(username || "")
      .split(/[.\-_\s]+/)
      .filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(username || "?").slice(0, 2).toUpperCase();
  }

  // 1793620128 → "11-02-26" (the reference format)
  function shortDate(seconds) {
    if (!seconds) return "—";
    var d = new Date(seconds * 1000);
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var yy = String(d.getFullYear()).slice(2);
    return mm + "-" + dd + "-" + yy;
  }

  function note(node, text, kind) {
    if (!node) return;
    node.hidden = false;
    node.className = "settings__note settings__note--" + kind;
    node.textContent = text;
  }

  function clearNote(node) {
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }

  // Remember account changes for the activity page (nl.account.v1).
  function recordChange(kind, title, meta) {
    try {
      var list = JSON.parse(window.localStorage.getItem("nl.account.v1") || "[]");
      if (!Array.isArray(list)) list = [];
      list.push({ at: Date.now(), kind: kind, title: title, meta: meta });
      window.localStorage.setItem("nl.account.v1", JSON.stringify(list));
    } catch (err) {
      /* storage blocked — the change still happened */
    }
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  }

  /* ---------------------------------------------------------------- tabs -- */

  function showTab(name) {
    var target = panels[name] ? name : "account";

    tabs.forEach(function (btn) {
      var active = btn.getAttribute("data-tab") === target;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    });

    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== target;
    });

    if (location.hash !== "#" + target) {
      history.replaceState(null, "", "#" + target);
    }
  }

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showTab(btn.getAttribute("data-tab"));
    });
  });

  window.addEventListener("hashchange", function () {
    showTab(location.hash.replace("#", ""));
  });

  /* ------------------------------------------------------------- profile -- */

  function orders() {
    try {
      var list = JSON.parse(window.localStorage.getItem(ORDERS_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function fillStats() {
    var list = orders();
    var spent = list.reduce(function (sum, order) {
      return sum + (Number(order.total) || 0);
    }, 0);

    if (ui.orders) ui.orders.textContent = String(list.length);
    if (ui.spent) ui.spent.textContent = money(spent);
    if (ui.refund) ui.refund.textContent = list.length ? "0%" : "–";
  }

  function fillUser(user) {
    if (!user) return;

    if (ui.name) ui.name.textContent = user.username;
    if (ui.email) ui.email.textContent = user.email;
    if (ui.initials) ui.initials.textContent = initials(user.username);
    if (ui.emailInput && !ui.emailInput.value) ui.emailInput.value = user.email;
    if (ui.join) ui.join.textContent = shortDate(user.created_at);

    if (ui.badge) {
      var age = user.created_at
        ? (Date.now() / 1000 - user.created_at) / 86400
        : 999;
      ui.badge.hidden = false;
      ui.badge.textContent = age < 30 ? "NEWCOMER" : "MEMBER";
      ui.badge.className =
        "uinfo__badge " + (age < 30 ? "uinfo__badge--new" : "uinfo__badge--member");
    }
  }

  /* --------------------------------------------------------------- email -- */

  if (ui.saveEmail) {
    ui.saveEmail.addEventListener("click", function () {
      var email = (ui.emailInput.value || "").trim();
      clearNote(ui.emailNote);

      if (!email) {
        note(ui.emailNote, "Enter your email address.", "warn");
        return;
      }

      ui.saveEmail.disabled = true;
      ui.saveEmail.textContent = "Saving…";

      postJSON("api/account/email", { email: email })
        .then(function (result) {
          if (result.ok && result.data.user) {
            fillUser(result.data.user);
            recordChange("email", "Email address changed", result.data.user.email);
            note(ui.emailNote, "Email updated.", "ok");
            return;
          }
          var message =
            (result.data.fields && result.data.fields.email) ||
            result.data.error ||
            "Could not save that address.";
          note(ui.emailNote, message, "warn");
        })
        .catch(function () {
          note(ui.emailNote, "Could not reach the server.", "warn");
        })
        .then(function () {
          ui.saveEmail.disabled = false;
          ui.saveEmail.textContent = "Save";
        });
    });
  }

  /* ------------------------------------------------------------ password -- */

  if (ui.togglePassword) {
    ui.togglePassword.addEventListener("click", function () {
      var open = ui.passwordForm.hidden;
      ui.passwordForm.hidden = !open;
      ui.togglePassword.setAttribute("aria-expanded", open ? "true" : "false");
      ui.togglePassword.classList.toggle("is-open", open);
      clearNote(ui.passwordNote);
      if (open && ui.current) ui.current.focus();
    });
  }

  if (ui.cancelPassword) {
    ui.cancelPassword.addEventListener("click", function () {
      ui.passwordForm.hidden = true;
      ui.passwordForm.reset();
      ui.togglePassword.setAttribute("aria-expanded", "false");
      ui.togglePassword.classList.remove("is-open");
      clearNote(ui.passwordNote);
    });
  }

  if (ui.passwordForm) {
    ui.passwordForm.addEventListener("submit", function (event) {
      event.preventDefault();
      clearNote(ui.passwordNote);

      var current = ui.current.value;
      var next = ui.next.value;
      var again = ui.confirm.value;

      if (!current) {
        note(ui.passwordNote, "Enter your current password.", "warn");
        ui.current.focus();
        return;
      }
      if (next !== again) {
        note(ui.passwordNote, "The two new passwords do not match.", "warn");
        ui.confirm.focus();
        return;
      }

      var submit = ui.passwordForm.querySelector("button[type=submit]");
      submit.disabled = true;
      submit.textContent = "Saving…";

      postJSON("api/account/password", { current: current, password: next })
        .then(function (result) {
          if (result.ok) {
            ui.passwordForm.reset();
            ui.passwordForm.hidden = true;
            ui.togglePassword.setAttribute("aria-expanded", "false");
            ui.togglePassword.classList.remove("is-open");
            recordChange(
              "password",
              "Password changed",
              "All other sessions of this account were signed out."
            );
            note(
              ui.passwordNote,
              "Password changed. Any other session of this account was signed out.",
              "ok"
            );
            return;
          }
          var fields = result.data.fields || {};
          note(
            ui.passwordNote,
            fields.current || fields.password || result.data.error || "Could not change it.",
            "warn"
          );
        })
        .catch(function () {
          note(ui.passwordNote, "Could not reach the server.", "warn");
        })
        .then(function () {
          submit.disabled = false;
          submit.textContent = "Save password";
        });
    });
  }

  /* ---------------------------------------------------------- secret key -- */

  function paintSecret() {
    var on = window.localStorage.getItem(SECRET_KEY) === "on";
    ui.secretState.textContent = on ? "Enabled" : "Disabled";
    ui.toggleSecret.textContent = on ? "Disable" : "Enable";
    ui.toggleSecret.classList.toggle("is-on", on);
  }

  if (ui.toggleSecret) {
    ui.toggleSecret.addEventListener("click", function () {
      var on = window.localStorage.getItem(SECRET_KEY) === "on";
      try {
        window.localStorage.setItem(SECRET_KEY, on ? "off" : "on");
      } catch (err) {
        /* storage blocked — the label still flips for this visit */
      }
      paintSecret();
    });
  }

  /* ---------------------------------------------------------------- load -- */

  showTab(location.hash.replace("#", ""));
  paintSecret();
  fillStats();

  fetch("api/me", { credentials: "same-origin" })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (data) {
      if (data && data.user) fillUser(data.user);
    })
    .catch(function () {
      /* static preview: the markup stays as written */
    });
})();
