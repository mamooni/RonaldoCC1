/* ==========================================================================
   Northlight — admin.js

   The admin console. Everything here is driven by one endpoint:

     GET  api/admin/data                 → {stats, users, payments}
     POST api/admin/payment {id, status}  → confirms or fails one payment

   The server refuses both unless the session belongs to an account with
   role = 'admin', and admin.html itself is served only to admins — this file
   just paints what the server allows.
   ========================================================================== */

(function () {
  "use strict";

  var PAGE = document.querySelector(".page--admin");
  if (!PAGE) return; // not the admin page

  var ui = {
    name: document.getElementById("adminName"),
    stamp: document.getElementById("adminStamp"),
    refresh: document.getElementById("adminRefresh"),
    note: document.getElementById("adminNote"),
    users: document.getElementById("statUsers"),
    pending: document.getElementById("statPending"),
    confirmed: document.getElementById("statConfirmed"),
    failed: document.getElementById("statFailed"),
    revenue: document.getElementById("statRevenue"),
    pendingBody: document.getElementById("pendingBody"),
    pendingEmpty: document.getElementById("pendingEmpty"),
    historyBody: document.getElementById("historyBody"),
    historyEmpty: document.getElementById("historyEmpty"),
    usersBody: document.getElementById("usersBody"),
    cheapOrdersBody: document.getElementById("cheapOrdersBody"),
    cheapOrdersEmpty: document.getElementById("cheapOrdersEmpty"),
    expensiveOrdersBody: document.getElementById("expensiveOrdersBody"),
    expensiveOrdersEmpty: document.getElementById("expensiveOrdersEmpty"),
  };

  /* ------------------------------------------------------------- helpers -- */

  function money(value) {
    return "$" + (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);
  }

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function stamp(seconds) {
    if (!seconds) return "—";
    var d = new Date(seconds * 1000);
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return d.getDate() + " " + MONTHS[d.getMonth()] + " · " + hh + ":" + mi;
  }

  function note(text, kind) {
    if (!ui.note) return;
    if (!text) {
      ui.note.hidden = true;
      ui.note.textContent = "";
      return;
    }
    ui.note.hidden = false;
    ui.note.className = "admin__note admin__note--" + kind;
    ui.note.textContent = text;
  }

  function cell(text, className) {
    var td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function chip(text, kind) {
    var span = document.createElement("span");
    span.className = "achip achip--" + kind;
    span.textContent = text;
    return span;
  }

  /* -------------------------------------------------------------- render -- */

  function renderPending(payments) {
    ui.pendingBody.innerHTML = "";

    var waiting = payments.filter(function (p) {
      return p.status === "pending";
    });

    ui.pendingEmpty.hidden = waiting.length > 0;

    waiting.forEach(function (payment) {
      var tr = document.createElement("tr");

      tr.appendChild(cell("#" + payment.id, "atable__mono"));
      tr.appendChild(cell(payment.username));
      tr.appendChild(cell(money(payment.amount) + " " + payment.asset + " · " + payment.network,"atable__mono"));    
      tr.appendChild(cell(stamp(payment.created_at), "atable__when"));

      var actions = document.createElement("td");
      actions.className = "atable__actions";

      var ok = document.createElement("button");
      ok.className = "abtn abtn--ok";
      ok.type = "button";
      ok.setAttribute("data-decide", payment.id);
      ok.setAttribute("data-status", "confirmed");
      ok.textContent = "Confirm";

      var no = document.createElement("button");
      no.className = "abtn abtn--no";
      no.type = "button";
      no.setAttribute("data-decide", payment.id);
      no.setAttribute("data-status", "failed");
      no.textContent = "Fail";

      actions.appendChild(ok);
      actions.appendChild(no);
      tr.appendChild(actions);

      ui.pendingBody.appendChild(tr);
    });
  }

  function renderHistory(payments) {
    ui.historyBody.innerHTML = "";

    var decided = payments.filter(function (p) {
      return p.status !== "pending";
    });

    ui.historyEmpty.hidden = decided.length > 0;

    decided.forEach(function (payment) {
      var tr = document.createElement("tr");
      tr.appendChild(cell("#" + payment.id, "atable__mono"));
      tr.appendChild(cell(payment.username));
      tr.appendChild(cell(money(payment.amount) + " " + payment.asset + " . " + payment.network,"atable__mono"));
      tr.appendChild(cell(stamp(payment.created_at), "atable__when"));

      var status = document.createElement("td");
      status.appendChild(
        chip(
          payment.status === "confirmed" ? "Confirmed" : "Failed",
          payment.status === "confirmed" ? "ok" : "no"
        )
      );
      tr.appendChild(status);

      tr.appendChild(cell(stamp(payment.decided_at), "atable__when"));
      ui.historyBody.appendChild(tr);
    });
  }

  function renderUsers(users) {
    ui.usersBody.innerHTML = "";

    users.forEach(function (user) {
      var tr = document.createElement("tr");
      tr.appendChild(cell("#" + user.id, "atable__mono"));
      tr.appendChild(cell(user.username + (user.role === "admin" ? " (you)" : "")));
      tr.appendChild(cell(user.email, "atable__email"));
      tr.appendChild(cell(stamp(user.created_at), "atable__when"));

      var paid = document.createElement("td");
      if (user.role === "admin") {
        paid.appendChild(chip("Admin", "muted"));
      } else if (user.payments.confirmed > 0) {
        paid.appendChild(chip("Paid", "ok"));
      } else if (user.payments.pending > 0) {
        paid.appendChild(chip("Pending", "wait"));
      } else {
        paid.appendChild(chip("Not paid", "muted"));
      }
      tr.appendChild(paid);

      tr.appendChild(cell(money(user.balance), "atable__mono"));
      tr.appendChild(cell(user.role, "atable__role"));

      ui.usersBody.appendChild(tr);
    });
  }

  function renderCheapOrders(orders) {
    if (!ui.cheapOrdersBody || !ui.cheapOrdersEmpty) return;
    ui.cheapOrdersBody.innerHTML = "";
    ui.cheapOrdersEmpty.hidden = orders.length > 0;
    orders.forEach(function (order) {
      var tr = document.createElement("tr");
      tr.appendChild(cell("#" + order.id, "atable__mono"));
      tr.appendChild(cell(order.username || "Unknown user"));
      var summary = (order.items || []).map(function (item) {
        return item.title + " × " + item.quantity + " (" + money(item.price) + " each)";
      }).join(" · ");
      tr.appendChild(cell(summary || "No items recorded"));
      tr.appendChild(cell(money(order.total), "atable__mono"));
      tr.appendChild(chip("Paid", "ok"));
      tr.appendChild(cell(stamp(order.created_at), "atable__when"));
      ui.cheapOrdersBody.appendChild(tr);
    });
  }

  function renderExpensiveOrders(orders) {
    ui.expensiveOrdersBody.innerHTML = "";

    ui.expensiveOrdersEmpty.hidden = orders.length > 0;

    orders.forEach(function (order) {
      var tr = document.createElement("tr");

      tr.appendChild(cell("#" + order.id, "atable__mono"));
      tr.appendChild(
        cell(
          (order.full_name || "Name not submitted") +
          " (" + order.username + ")"
        )
      );

      var productSummary = (order.items || []).map(function (item) {
        return item.title + " × " + item.quantity +
          " (" + money(item.price) + " each)";
      }).join(" · ");

      tr.appendChild(cell(productSummary || "No items recorded"));
      tr.appendChild(cell(money(order.total), "atable__mono"));

      var statusLabels = {
        awaiting_customer_name: "Awaiting customer name",
        awaiting_fulfilment: "Awaiting fulfilment",
        fulfilled: "Fulfilled"
      };

      var statusCell = document.createElement("td");
      statusCell.appendChild(
        chip(
          statusLabels[order.status] || order.status,
          order.status === "fulfilled" ? "ok" : "wait"
        )
      );
      tr.appendChild(statusCell);

      tr.appendChild(cell(stamp(order.created_at), "atable__when"));

      ui.expensiveOrdersBody.appendChild(tr);
    });
  }

  function render(data) {
    var stats = data.stats || {};

    ui.users.textContent = stats.users || 0;
    ui.pending.textContent = stats.pending || 0;
    ui.confirmed.textContent = stats.confirmed || 0;
    ui.failed.textContent = stats.failed || 0;
    ui.revenue.textContent = money(stats.revenue);

    renderPending(data.payments || []);
    renderHistory(data.payments || []);
    renderUsers(data.users || []);
    renderCheapOrders(data.cheap_orders || []);
    renderExpensiveOrders(data.expensive_orders || []);

    if (ui.stamp) {
      var now = new Date();
      ui.stamp.textContent =
        "updated " +
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0") +
        ":" +
        String(now.getSeconds()).padStart(2, "0");
    }
  }

  /* ---------------------------------------------------------------- load -- */

  function load() {
    if (ui.refresh) ui.refresh.disabled = true;

    return fetch("api/admin/data", { credentials: "same-origin" })
      .then(function (response) {
        if (response.status === 403 || response.status === 401) {
          location.replace("index.html");
          return null;
        }
        return response.ok ? response.json() : Promise.reject(response.status);
      })
      .then(function (data) {
        if (!data) return;
        render(data);

        var me = (data.users || []).filter(function (u) {
          return u.role === "admin";
        })[0];
        if (me && ui.name) ui.name.textContent = me.username;
      })
      .catch(function () {
        note("Could not load the dashboard. Is the server running?", "warn");
      })
      .then(function () {
        if (ui.refresh) ui.refresh.disabled = false;
      });
  }

  /* ------------------------------------------------------------- actions -- */

  function decide(id, status, button) {
    var label = button.textContent;
    button.disabled = true;
    button.textContent = status === "confirmed" ? "Confirming…" : "Failing…";

    fetch("api/admin/payment", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id), status: status }),
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            return { ok: response.ok, body: body };
          });
      })
      .then(function (result) {
        if (result.ok) {
          note(
            "Payment #" +
              id +
              (status === "confirmed"
                ? " confirmed — the wallet was credited."
                : " marked failed — no funds moved."),
            status === "confirmed" ? "ok" : "warn"
          );
          return load();
        }
        note(result.body.error || "That did not work.", "warn");
        button.disabled = false;
        button.textContent = label;
      })
      .catch(function () {
        note("Could not reach the server.", "warn");
        button.disabled = false;
        button.textContent = label;
      });
  }

  ui.pendingBody.addEventListener("click", function (event) {
    var button = event.target.closest("[data-decide]");
    if (!button) return;
    decide(button.getAttribute("data-decide"), button.getAttribute("data-status"), button);
  });

  if (ui.refresh) ui.refresh.addEventListener("click", load);

  load();
})();
