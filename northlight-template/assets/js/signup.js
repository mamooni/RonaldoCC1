

(function () {
  "use strict";

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  

  var form = $("#signupForm");
  if (!form) return;

  var username = $("#username");
  var email = $("#email");
  // Where to go after creating the account. Only same-folder .html paths are
  // accepted, so a crafted ?next= cannot bounce anyone to another site.
  function nextUrl() {
    var raw = new URLSearchParams(location.search).get("next") || "";
    if (/^[\w.\-]+(\.html)?$/.test(raw)) {
      return raw.endsWith(".html") ? raw : raw + ".html";
    }
    return "index.html";
  }

  var captcha = $("#captchaCheck");
  var turnstileToken = "";
  var submit = $("#signupSubmit");
  var status = $("#authStatus");

  // arriving from the account wall: say why this page appeared
  if (new URLSearchParams(location.search).has("next")) {
    status.classList.add("auth-status--info");
    status.textContent = "Create an account to continue to the store.";
    status.hidden = false;
  }


  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var USERNAME_RE = /^[a-z0-9._-]{3,}$/i;
  var HAS_LETTER = /[a-z]/i;
  var HAS_NUMBER = /\d/;
  var HAS_SYMBOL = /[^a-z0-9]/i;

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
    var message = "";

    if (!value) message = "Choose a username.";
    else if (value.length < 3) message = "Use at least 3 characters.";
    else if (!USERNAME_RE.test(value))
      message = "Letters, numbers, dots, dashes and underscores only.";

    setError(username, $("#usernameError"), message);
    return !message;
  }

  function checkEmail() {
    var value = email.value.trim();
    var message = "";

    if (!value) message = "Enter your email address.";
    else if (!EMAIL_RE.test(value)) message = "That email address looks off.";

    setError(email, $("#emailError"), message);
    return !message;
  }

  function checkPassword() {
    var value = password.value;
    var missing = [];

    if (value.length < 8) missing.push("8+ characters");
    if (!HAS_LETTER.test(value)) missing.push("a letter");
    if (!HAS_NUMBER.test(value)) missing.push("a number");
    if (!HAS_SYMBOL.test(value)) missing.push("a symbol");

    var message = missing.length
      ? "Password needs " + missing.join(", ") + "."
      : "";

    setError(password, $("#passwordError"), message);
    return !message;
  }

  function checkCaptcha() {
    var errorNode = $("#captchaError");

    if (window.NL_TURNSTILE_ENABLED && !turnstileToken) {
      errorNode.textContent = "Please complete the human verification.";
      errorNode.hidden = false;
      return false;
    }
    if (!window.NL_TURNSTILE_ENABLED && !captcha.checked) {
      errorNode.textContent = "Please confirm you're not a robot.";
      errorNode.hidden = false;
      return false;
    }

    errorNode.textContent = "";
    errorNode.hidden = true;
    return true;
  }

  // clear an error as soon as the field is edited again
  [
    [username, checkUsername],
    [email, checkEmail],
    [password, checkPassword],
  ].forEach(function (pair) {
    pair[0].addEventListener("input", function () {
      if (pair[0].classList.contains("is-error")) pair[1]();
      status.hidden = true;
    });
  });

  captcha.addEventListener("change", function () {
    if (captcha.checked) checkCaptcha();
    status.hidden = true;
  });

  // The public key is fetched from our own server so it is never hard-coded
  // into the template. If Turnstile is not configured, the visible checkbox
  // remains a local development aid only.
  fetch("/api/public-config")
    .then(function (response) { return response.ok ? response.json() : {}; })
    .then(function (config) {
      if (!config.turnstile_site_key) return;
      window.NL_TURNSTILE_ENABLED = true;
      captcha.closest(".captcha__row").style.display = "none";
      var widget = document.createElement("div");
      widget.className = "cf-turnstile";
      widget.dataset.sitekey = config.turnstile_site_key;
      widget.dataset.callback = "northlightTurnstileDone";
      widget.dataset["expiredCallback"] = "northlightTurnstileExpired";
      $("#captcha").insertBefore(widget, $("#captchaError"));
      window.northlightTurnstileDone = function (token) { turnstileToken = token; checkCaptcha(); };
      window.northlightTurnstileExpired = function () { turnstileToken = ""; };
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    })
    .catch(function () { /* local previews do not have the API */ });

  var FIELD_NODES = {
    username: [username, "#usernameError"],
    email: [email, "#emailError"],
    password: [password, "#passwordError"],
  };

  function setStatus(message, linkHref, linkLabel) {
    status.classList.remove("is-error");
    status.textContent = "";
    status.appendChild(document.createTextNode(message));

    if (linkHref) {
      var link = document.createElement("a");
      link.href = linkHref;
      link.textContent = linkLabel;
      status.appendChild(document.createTextNode(" "));
      status.appendChild(link);
    }

    status.hidden = false;
  }

  function setStatusError(message) {
    status.classList.add("is-error");
    status.textContent = message;
    status.hidden = false;
  }

  // field-level messages coming back from the server
  function applyServerErrors(data) {
    var fields = (data && data.fields) || {};

    Object.keys(fields).forEach(function (key) {
      var pair = FIELD_NODES[key];
      if (pair) setError(pair[0], $(pair[1]), fields[key]);
    });

    var firstKey = Object.keys(fields)[0];
    if (firstKey) {
      var firstPair = FIELD_NODES[firstKey];
      if (firstPair) firstPair[0].focus({ preventScroll: true });
    }
  }

  var NETWORK_MESSAGE =
    "Can't reach the server. Accounts live in the backend, so open the site " +
    "through the running server (the live preview on port 8000, or " +
    "http://localhost:8000/signup.html) rather than as a standalone file.";

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // run every check so all problems show at once (no short-circuiting)
    var checks = [
      checkUsername(),
      checkEmail(),
      checkPassword(),
      checkCaptcha(),
    ];

    if (!checks.every(Boolean)) {
      var firstBad = form.querySelector(".is-error, .captcha__input:not(:checked)");
      if (firstBad) firstBad.focus({ preventScroll: true });
      return;
    }

    status.hidden = true;
    submit.disabled = true;
    submit.textContent = "Creating account\u2026";

    window.NL.post("api/signup", {
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
      turnstile_token: turnstileToken,
    })
      .then(function (result) {
        if (result.ok) {
          setStatus(
            "Account created \u2014 taking you to the store as " +
              result.data.user.username +
              ".",
            "index.html",
            "Go now"
          );
          form.reset();

          // The store is behind an account wall, so go straight in — but first
          // make sure the session cookie actually stuck. Some embedded
          // previews block cookies, and without this check that turns into a
          // redirect loop.
          var destination = nextUrl();
          window.NL.session().then(function (hasSession) {
            if (!hasSession) {
              setStatusError(
                "Account created, but this browser is blocking the session " +
                  "cookie. Open the site in its own tab and sign in."
              );
              return;
            }
            window.setTimeout(function () {
              location.href = destination;
            }, 900);
          });
          return;
        }

        applyServerErrors(result.data);
        setStatusError(result.data.error || "Could not create the account.");
      })
      .catch(function () {
        setStatusError(NETWORK_MESSAGE);
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = "Sign Up";
      });
  });
})();
