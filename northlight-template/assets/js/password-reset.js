(function () {
  "use strict";
  function $(selector) { return document.querySelector(selector); }
  function show(message, bad) { var node = $("#authStatus"); node.textContent = message; node.classList.toggle("is-error", !!bad); node.hidden = false; }
  function post(path, data) { return window.NL.post(path, data); }
  var requestForm = $("#resetRequestForm");
  if (requestForm) {
    requestForm.addEventListener("submit", function (event) {
      event.preventDefault(); var email = $("#email"); var error = $("#emailError");
      if (!email.value.trim()) { error.textContent = "Enter your email address."; error.hidden = false; email.focus(); return; }
      error.hidden = true; var button = requestForm.querySelector("button"); button.disabled = true;
      post("api/password-reset/request", {email: email.value.trim()}).then(function () { show("If that email belongs to an account, a reset link has been sent."); requestForm.reset(); }).catch(function () { show("We could not reach the server. Please try again.", true); }).then(function () { button.disabled = false; });
    });
  }
  var confirmForm = $("#resetConfirmForm");
  if (confirmForm) {
    var token = new URLSearchParams(location.search).get("token") || "";
    confirmForm.addEventListener("submit", function (event) {
      event.preventDefault(); var password = $("#password"); var error = $("#passwordError");
      if (!token) { show("This reset link is invalid or has expired.", true); return; }
      error.hidden = true; var button = confirmForm.querySelector("button"); button.disabled = true;
      post("api/password-reset/confirm", {token: token, password: password.value}).then(function (result) {
        if (result.ok) { show("Your password has been updated. Redirecting to sign in…"); setTimeout(function () { location.href = "login.html"; }, 900); return; }
        var fields = result.data.fields || {}; if (fields.password) { error.textContent = fields.password; error.hidden = false; password.focus(); } show(result.data.error || "Unable to reset your password.", true);
      }).catch(function () { show("We could not reach the server. Please try again.", true); }).then(function () { button.disabled = false; });
    });
  }
})();
