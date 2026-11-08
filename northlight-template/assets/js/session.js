/* ==========================================================================
   Northlight storefront — session.js
   Optional: reflects the signed-in account in the top bar and the avatar menu.

   It asks the backend who is signed in (GET api/me) and, when there is a user,
   swaps the avatar initials and turns the menu's guest links into a
   "Signed in as …" line plus a working Sign out button.

   Nothing here is required for the storefront to render: when there is no
   backend (opened from disk, or served as a static file) the request simply
   fails and the menu stays as written in the HTML.
   ========================================================================== */

(function () {
  "use strict";

  if (location.protocol === "file:") return; // static preview, no API

  var requiresAuth = document.body.hasAttribute("data-requires-auth");
  var avatar = document.querySelector(".topbar__actions .avatar");
  var guestItems = document.querySelectorAll("[data-guest]");
  var userItems = document.querySelectorAll("[data-user]");
  var adminItems = document.querySelectorAll("[data-admin]");
  var nameNode = document.getElementById("menuUsername");
  var emailNode = document.getElementById("menuEmail");
  var signOutBtn = document.getElementById("signOutBtn");

  function initials(username) {
    var parts = String(username || "")
      .split(/[.\-_\s]+/)
      .filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return String(username || "?").slice(0, 2).toUpperCase();
  }

  function apply(user) {
    var signedIn = Boolean(user);

    guestItems.forEach(function (node) {
      node.hidden = signedIn;
    });
    userItems.forEach(function (node) {
      node.hidden = !signedIn;
    });

    // Admin-only rows (the console link) stay hidden for everyone else.
    adminItems.forEach(function (node) {
      node.hidden = !(signedIn && user.role === "admin");
    });

    if (!signedIn) return;

    if (nameNode) nameNode.textContent = user.username;
    if (emailNode) emailNode.textContent = user.email || "";

    // The wallet in the top bar follows the account balance.
    if (typeof user.balance === "number") {
      document.querySelectorAll(".js-balance").forEach(function (node) {
        node.textContent = user.balance.toFixed(2);
      });
    }

    if (avatar) {
      avatar.textContent = initials(user.username);
      avatar.setAttribute("title", "Signed in as " + user.username);
      avatar.setAttribute("aria-label", "Account menu — " + user.username);
    }
  }

  fetch("api/me", { credentials: "same-origin" })
    .then(function (response) {
      // A 401 is a real answer from a real backend: nobody is signed in.
      if (response.status === 401) {
        apply(null);
        // The server also enforces this wall; this is the backstop for pages
        // served by something other than server/app.py.
        if (requiresAuth) {
          var here = location.pathname.split("/").pop();
          if (here && here !== "login.html" && here !== "signup.html") {
            // same destination as the server's wall: create an account first
            location.replace("signup.html?next=" + encodeURIComponent(here));
          }
        }
        return null;
      }

      // Anything else that is not a successful JSON answer means "there is no
      // backend behind these files" — a static host answers this path with a
      // 404, and a preview panel serves files only. In that case the markup is
      // already showing the signed-in demo account, so it must be left alone
      // rather than downgraded to the guest links.
      if (!response.ok) return null;
      return response.json();
    })
    .then(function (data) {
      if (data && data.user) apply(data.user);
    })
    .catch(function () {
      /* no backend — leave the markup alone */
    });

  if (signOutBtn) {
    signOutBtn.addEventListener("click", function () {
      // the label lives in a <span> next to the icon, so update that
      var label = signOutBtn.querySelector("span") || signOutBtn;
      signOutBtn.disabled = true;
      label.textContent = "Signing out…";

      fetch("api/logout", { method: "POST", credentials: "same-origin" })
        .catch(function () {
          /* no backend — nothing to end, but still leave the page */
        })
        .then(function () {
          // The server drops the cookie; landing on the sign-in page is the
          // right destination whether or not a backend was there to answer.
          location.replace("login.html");
        });
    });
  }
})();
