/* ==========================================================================
   Northlight — tickets.js

   The "Create Ticket" page. A ticket is a support message, nothing more:
   the form is validated here, the ticket is kept in localStorage under
   "nl.tickets.v1" so the demo survives a reload, and the visitor is pointed at
   the Messages page where the reply would arrive.

   There is no network call and no backend endpoint — this is a template.
   ========================================================================== */

(function () {
  "use strict";

  var KEY = "nl.tickets.v1";

  var form = document.getElementById("ticketForm");
  if (!form) return; // not the tickets page

  var subject = document.getElementById("ticketSubject");
  var message = document.getElementById("ticketMessage");
  var note = document.getElementById("ticketNote");

  /* ------------------------------------------------------------- storage -- */

  function read() {
    try {
      var list = JSON.parse(window.localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function save(list) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
      /* storage blocked — the confirmation below still appears */
    }
  }

  function reference() {
    var n = read().length + 1;
    return "T-" + (420000 + n * 137); // stable, six digits, same 4/5xx family
  }

  /* ---------------------------------------------------------------- note -- */

  function show(text, kind) {
    if (!note) return;
    note.hidden = false;
    note.className = "ticket__note ticket__note--" + kind;
    note.textContent = text;
  }

  function clearNote() {
    if (!note) return;
    note.hidden = true;
    note.textContent = "";
  }

  /* --------------------------------------------------------------- submit -- */

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var subjectText = subject ? subject.value.trim() : "";
    var messageText = message ? message.value.trim() : "";

    if (!subjectText) {
      show("Enter a subject for your ticket.", "warn");
      if (subject) subject.focus();
      return;
    }

    if (!messageText) {
      show("Write your message before submitting.", "warn");
      if (message) message.focus();
      return;
    }

    var list = read();
    list.push({
      ref: reference(),
      subject: subjectText,
      message: messageText,
      created: new Date().toISOString(),
    });
    save(list);

    form.reset();
    clearNote();
    show(
      "Ticket " + list[list.length - 1].ref + " submitted — our team replies in Messages. " +
        "This is a demo, so nothing was actually sent.",
      "ok"
    );
    if (subject) subject.focus();
  });

  // A new keystroke makes an old message stale.
  [subject, message].forEach(function (field) {
    if (!field) return;
    field.addEventListener("input", clearNote);
  });
})();
