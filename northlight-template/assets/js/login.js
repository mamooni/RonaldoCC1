/* ==========================================================================
   Northlight storefront — login.js
   Client-side check for the sign-in form (demo only — nothing is sent).

   Only two credentials are asked for: username and password.
   The particle background and the password toggle live in auth.js.
   ========================================================================== */

(function () {
  "use strict";

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  var form = $("#loginForm");
  if (!form) return;

  // Where to go after signing in. Only same-folder .html paths are accepted,
  // so a crafted ?next= cannot bounce anyone to another site.
  function nextUrl() {
    var raw = new URLSearchParams(location.search).get("next") || "";
    if (/^[\w.\-]+(\.html)?$/.test(raw)) {
      return raw.endsWith(".html") ? raw : raw + ".html";
    }
    return "index.html";
  }


  var username = $("#username");
  var password = $("#password");
  var submit = $("#loginSubmit");
  var status = $("#authStatus");

  // arriving from the account wall: say why this page appeared
  if (new URLSearchParams(location.search).has("next")) {
    status.classList.add("auth-status--info");
    status.textContent = "Sign in to continue to the store.";
    status.hidden = false;
  }

  function setError(input, errorNode, message) {
    if (message) {
      input.classList.add("is-error");
      input.setAttribute("aria-invalid", "true");
      errorNode.textContent = message;
      errorNode.hidden = false;
    } else {
      input.classList.remove("is-error");
      input.removeAttribute("aria-invalid");
      errorNode.textContent = "";
      errorNode.hidden = true;
    }
  }

  function checkUsername() {
    var value = username.value.trim();
    var message = value ? "" : "Enter your username.";
    setError(username, $("#usernameError"), message);
    return !message;
  }

  function checkPassword() {
    var message = password.value ? "" : "Enter your password.";
    setError(password, $("#passwordError"), message);
    return !message;
  }

  // clear an error as soon as the field is edited again
  [
    [username, checkUsername],
    [password, checkPassword],
  ].forEach(function (pair) {
    pair[0].addEventListener("input", function () {
      if (pair[0].classList.contains("is-error")) pair[1]();
      status.hidden = true;
    });
  });

  var NETWORK_MESSAGE =
    "Can't reach the server. Accounts live in the backend, so open the site " +
    "through the running server (the live preview on port 8000, or " +
    "http://localhost:8000/login.html) rather than as a standalone file.";

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // run both checks so both problems show at once
    var checks = [checkUsername(), checkPassword()];
    if (!checks.every(Boolean)) {
      var firstBad = form.querySelector(".is-error");
      if (firstBad) firstBad.focus({ preventScroll: true });
      return;
    }

    status.hidden = true;
    submit.disabled = true;
    submit.textContent = "Signing in\u2026";

    var remember = $("#remember");

    window.NL.post("api/login", {
      username: username.value.trim(),
      password: password.value,
      remember: Boolean(remember && remember.checked),
    })
      .then(function (result) {
        if (result.ok) {
          status.classList.remove("is-error", "auth-status--info");
          status.textContent = "";
          status.appendChild(
            document.createTextNode(
              "Signed in as " + result.data.user.username + ". Opening the store\u2026"
            )
          );
          status.hidden = false;

          window.NL.session().then(function (hasSession) {
            if (!hasSession) {
              status.classList.add("is-error");
              status.textContent =
                "That password worked, but this browser is blocking the " +
                "session cookie. Open the site in its own tab and sign in.";
              return;
            }
            window.setTimeout(function () {
              location.href = nextUrl();
            }, 700);
          });
          return;
        }

        var fields = result.data.fields || {};

        if (fields.username) {
          setError(username, $("#usernameError"), fields.username);
        }
        if (fields.password) {
          setError(password, $("#passwordError"), fields.password);
        }

        // a wrong password is not a field problem — show it in the banner
        status.classList.remove("auth-status--info");
        status.classList.add("is-error");
        status.textContent =
          result.data.error || "Username or password is incorrect.";
        status.hidden = false;
      })
      .catch(function () {
        status.classList.add("is-error");
        status.textContent = NETWORK_MESSAGE;
        status.hidden = false;
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = "Sign In";
      });
  });
})();
