/* ==========================================================================
   Northlight — activity.js

   The "Your Activities" page: when the account was created, plus everything
   this browser knows the account has done since.

   Sources
     GET api/me            → createdAt of the account (the authoritative date)
     nl.orders.v1          → orders confirmed on the cart page (cart.js)
     nl.tickets.v1         → support tickets submitted (tickets.js)
     nl.account.v1         → email / password changes (settings.js)

   Newest first. The account-created entry is always there; the empty note only
   appears when it is the only thing the page has to show.
   ========================================================================== */

(function () {
  "use strict";

  var PAGE = document.querySelector(".page--activity");
  if (!PAGE) return;

  var ORDERS = "nl.orders.v1";
  var TICKETS = "nl.tickets.v1";
  var CHANGES = "nl.account.v1";

  var ui = {
    name: document.getElementById("accountName"),
    created: document.getElementById("accountCreated"),
    age: document.getElementById("accountAge"),
    list: document.getElementById("activityList"),
    empty: document.getElementById("activityEmpty"),
  };

  /* ------------------------------------------------------------- helpers -- */

  function read(key) {
    try {
      var list = JSON.parse(window.localStorage.getItem(key) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function money(n) {
    return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  }

  // 1793620128 (seconds) or 1793620128000 (ms) → Date
  function toDate(value) {
    if (!value) return null;
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return null;
    return new Date(n < 1e12 ? n * 1000 : n);
  }

  var MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  function longDate(date) {
    if (!date) return "—";
    return (
      date.getDate() + " " + MONTHS[date.getMonth()] + " " + date.getFullYear()
    );
  }

  function shortDate(date) {
    if (!date) return "—";
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var dd = String(date.getDate()).padStart(2, "0");
    return mm + "-" + dd + "-" + String(date.getFullYear()).slice(2);
  }

  function clock(date) {
    if (!date) return "";
    var hh = String(date.getHours()).padStart(2, "0");
    var mi = String(date.getMinutes()).padStart(2, "0");
    return hh + ":" + mi;
  }

  function ageInDays(date) {
    if (!date) return null;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  function ageLabel(date) {
    var days = ageInDays(date);
    if (days === null) return "—";
    if (days <= 0) return "today";
    if (days === 1) return "1 day";
    if (days < 60) return days + " days";
    var months = Math.floor(days / 30);
    return months + (months === 1 ? " month" : " months");
  }

  /* ---------------------------------------------------------- icons ------ */

  var ICONS = {
    account:
      '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    order:
      '<path d="M6 6h15l-1.6 8.6a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.7L5.4 4H3"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/>',
    ticket:
      '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    change:
      '<path d="M12 3v3"/><path d="M12 18v3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 18.4 2.1-2.1"/><path d="m16.3 7.7 2.1-2.1"/>',
  };

  function icon(kind) {
    return (
      '<span class="alist__icon" aria-hidden="true"><svg viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      (ICONS[kind] || ICONS.change) +
      "</svg></span>"
    );
  }

  /* ------------------------------------------------------------- render -- */

  function render(events) {
    ui.list.innerHTML = "";

    events.forEach(function (event) {
      var li = document.createElement("li");
      li.className = "alist__row alist__row--" + event.kind;

      var when = document.createElement("p");
      when.className = "alist__when";
      when.textContent = shortDate(event.at) + " · " + clock(event.at);

      var body = document.createElement("div");
      body.className = "alist__body";
      body.innerHTML = icon(event.kind);

      var text = document.createElement("div");
      text.className = "alist__text";

      var title = document.createElement("p");
      title.className = "alist__event";
      title.textContent = event.title;
      text.appendChild(title);

      if (event.meta) {
        var meta = document.createElement("p");
        meta.className = "alist__meta";
        meta.textContent = event.meta;
        text.appendChild(meta);
      }

      body.appendChild(text);
      li.appendChild(when);
      li.appendChild(body);
      ui.list.appendChild(li);
    });

    var hasMore = events.some(function (event) {
      return event.kind !== "account";
    });
    if (ui.empty) ui.empty.hidden = hasMore;
  }

  function paint(user) {
    var created = toDate(user && user.created_at);

    if (ui.name) ui.name.textContent = (user && user.username) || "—";
    if (ui.created) ui.created.textContent = longDate(created) || "—";
    if (ui.age) ui.age.textContent = ageLabel(created);

    var events = [];

    if (created) {
      events.push({
        kind: "account",
        at: created,
        title: "Account created",
        meta: "Welcome to Northlight — this is where your activity starts.",
      });
    }

    read(ORDERS).forEach(function (order) {
      var at = toDate(order.at);
      if (!at) return;
      events.push({
        kind: "order",
        at: at,
        title: "Order placed — " + money(order.total),
        meta:
          (order.items || 0) +
          (order.items === 1 ? " item" : " items") +
          " · paid from your wallet balance",
      });
    });

    read(TICKETS).forEach(function (ticket) {
      var at = toDate(new Date(ticket.created).getTime());
      if (!at) return;
      events.push({
        kind: "ticket",
        at: at,
        title: "Ticket " + (ticket.ref || "") + " submitted",
        meta: ticket.subject || "",
      });
    });

    read(CHANGES).forEach(function (change) {
      var at = toDate(change.at);
      if (!at) return;
      events.push({
        kind: "change",
        at: at,
        title: change.title || "Account updated",
        meta: change.meta || "",
      });
    });

    events.sort(function (a, b) {
      return b.at - a.at;
    });

    render(events);
  }

  /* --------------------------------------------------------------- load -- */

  paint(null); // the summary shows "—" until the API answers

  fetch("api/me", { credentials: "same-origin" })
    .then(function (response) {
      if (response.status === 401) {
        location.replace(
          "signup.html?next=" + encodeURIComponent(location.pathname.split("/").pop())
        );
        return null;
      }
      if (!response.ok) return null; // static preview: no API behind the files
      return response.json();
    })
    .then(function (data) {
      if (data && data.user) {
        paint(data.user);
      } else {
        // No backend: still show what this browser recorded, with no account row.
        paint({ username: "you", created_at: null });
      }
    })
    .catch(function () {
      paint({ username: "you", created_at: null });
    });
})();
