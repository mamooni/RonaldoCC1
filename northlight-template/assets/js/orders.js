/*  All orders
    ==========
    Everything this account has bought — from the Goods table or from Bundles —
    straight from the server, so it follows the account rather than the browser.

    GET /api/orders returns the newest 100 purchases with the price the server
    charged, which is the number that must be trusted, not anything local. */

(function () {
  "use strict";

  var ui = {
    rows: document.getElementById("orderRows"),
    empty: document.getElementById("ordersEmpty"),
    count: document.getElementById("orderCount"),
    spent: document.getElementById("orderSpent"),
    sub: document.getElementById("ordersSub"),
  };

  function money(cents) {
    var n = Number(cents) || 0;
    return "$" + n.toFixed(2);
  }

  function when(seconds) {
    var date = new Date((Number(seconds) || 0) * 1000);
    if (isNaN(date.getTime())) return "—";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var hours = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");
    return (
      date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear() + ", " + hours + ":" + minutes
    );
  }

  function row(order) {
    var tr = document.createElement("tr");
    tr.className = "btable__row";

    var number = document.createElement("td");
    number.className = "btable__order";
    number.textContent = "#" + order.id;

    var title = document.createElement("td");
    title.className = "btable__name";
    title.textContent = order.title || "—";

    var price = document.createElement("td");
    price.className = "btable__price";
    price.textContent = money(order.price);

    var date = document.createElement("td");
    date.className = "btable__date";
    date.textContent = when(order.created_at);

    tr.appendChild(number);
    tr.appendChild(title);
    tr.appendChild(price);
    tr.appendChild(date);
    return tr;
  }

  fetch("api/orders", { credentials: "same-origin" })
    .then(function (response) {
      if (response.status === 401) {
        window.location.replace("login.html");
        return null;
      }
      return response.json();
    })
    .then(function (data) {
      if (!data) return;

      var orders = Array.isArray(data.orders) ? data.orders : [];
      var spent = orders.reduce(function (sum, order) {
        return sum + (Number(order.price) || 0);
      }, 0);

      ui.rows.innerHTML = "";
      orders.forEach(function (order) {
        ui.rows.appendChild(row(order));
      });

      if (ui.count) ui.count.textContent = String(orders.length);
      if (ui.spent) ui.spent.textContent = money(spent);
      if (ui.empty) ui.empty.hidden = orders.length !== 0;
      if (ui.sub && orders.length) {
        ui.sub.textContent =
          orders.length === 1
            ? "One order on this account."
            : orders.length + " orders on this account, newest first.";
      }

      if (typeof data.balance === "number") {
        Array.prototype.forEach.call(document.querySelectorAll(".js-balance"), function (node) {
          node.textContent = data.balance.toFixed(2);
        });
      }
    })
    .catch(function () {
      if (ui.sub) ui.sub.textContent = "Could not load your orders. Refresh the page.";
    });
})();
