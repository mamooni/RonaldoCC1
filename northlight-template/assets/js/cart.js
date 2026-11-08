/* ==========================================================================
   Northlight — cart.js

   One cart for the whole storefront.

     window.NLCart = { read, add, remove, clear, count, total, sync }

   Items are kept in localStorage under "nl.cart.v1" as

     [{ key, title, price, qty }, …]

   Every page that loads this file gets three things for free:

     1. the badge on the top-bar cart icon (#cartCount) stays in sync,
     2. the cart icon link (#cartBtn) grows an accessible "N items" label,
     3. on cart.html the page itself is drawn from the store.

   The badge/cart-link work is deliberately tiny so it can live on every page
   without a framework; the page drawing below only runs when the cart markup
   is actually present.
   ========================================================================== */

(function () {
  "use strict";

  var KEY = "nl.cart.v1";
  var ORDERS_KEY = "nl.orders.v1";

  /* ---------------------------------------------------------------- money -- */

  function money(value) {
    var n = Math.round(Number(value) * 100) / 100;
    if (!isFinite(n)) n = 0;
    return "$" + n.toFixed(2);
  }

  /* ---------------------------------------------------------------- store -- */

  // Never trust what is in storage: it may be old, hand-edited or broken.
  function read() {
    var raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (err) {
      return []; // private mode / storage disabled
    }
    if (!raw) return [];

    var list;
    try {
      list = JSON.parse(raw);
    } catch (err) {
      return [];
    }
    if (!Array.isArray(list)) return [];

    var clean = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item.key !== "string" || !item.key) continue;
      var price = Number(item.price);
      var qty = Math.floor(Number(item.qty));
      if (!isFinite(price) || price < 0) price = 0;
      if (!isFinite(qty) || qty < 1) qty = 1;
      if (qty > 99) qty = 99;
      clean.push({
        key: item.key,
        title: String(item.title || item.key),
        price: price,
        qty: qty,
      });
    }
    return clean;
  }

  function write(list) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
      /* storage full or blocked — the page still works for this visit */
    }
    syncBadges();
    drawPage();
  }

  function add(item) {
    if (!item || !item.key) return read();

    var list = read();
    var qty = Math.floor(Number(item.qty) || 1);
    if (qty < 1) qty = 1;

    var existing = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === item.key) {
        existing = list[i];
        break;
      }
    }

    if (existing) {
      existing.qty = Math.min(99, existing.qty + qty);
    } else {
      list.push({
        key: String(item.key),
        title: String(item.title || item.key),
        price: Number(item.price) || 0,
        qty: qty,
      });
    }

    write(list);
    return list;
  }

  function remove(key) {
    write(
      read().filter(function (item) {
        return item.key !== key;
      })
    );
  }

  function clear() {
    write([]);
  }

  function count() {
    return read().reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);
  }

  function sum() {
    return read().reduce(function (total, item) {
      return total + item.price * item.qty;
    }, 0);
  }

  /* ------------------------------------------------------------ top bar ---- */

  function syncBadges() {
    var badges = document.querySelectorAll("#cartCount");
    if (!badges.length) return;

    var n = count();
    for (var i = 0; i < badges.length; i++) {
      badges[i].textContent = n;
      badges[i].hidden = n === 0;
    }

    var link = document.getElementById("cartBtn");
    if (link) {
      link.setAttribute(
        "aria-label",
        n === 0
          ? "Shopping cart, empty"
          : "Shopping cart, " + n + (n === 1 ? " item" : " items")
      );
    }
  }

  /* ---------------------------------------------------------- cart page ---- */

  // Set while the cart page is on screen; null everywhere else.
  var paint = null;

  function drawPage() {
    if (paint) paint();
  }

  function row(item) {
    var li = document.createElement("li");
    li.className = "cart__row";

    var info = document.createElement("div");
    info.className = "cart__info";

    var name = document.createElement("p");
    name.className = "cart__name";
    name.textContent = item.title;

    var meta = document.createElement("p");
    meta.className = "cart__meta";
    meta.textContent =
      (item.qty > 1 ? item.qty + " × " : "") +
      money(item.price) +
      " · digital download";

    info.appendChild(name);
    info.appendChild(meta);

    var line = document.createElement("p");
    line.className = "cart__line";
    line.textContent = money(item.price * item.qty);

    var remove = document.createElement("button");
    remove.className = "cart__remove";
    remove.type = "button";
    remove.setAttribute("data-remove", item.key);
    remove.setAttribute("aria-label", "Remove " + item.title + " from cart");
    remove.innerHTML = "&times;";

    li.appendChild(info);
    li.appendChild(line);
    li.appendChild(remove);
    return li;
  }

  function initPage() {
    var list = document.getElementById("cartList");
    var empty = document.getElementById("cartEmpty");
    var totalEl = document.getElementById("cartTotal");
    var confirm = document.getElementById("confirmOrder");
    var note = document.getElementById("summaryNote");

    if (!list || !totalEl || !confirm) return; // not the cart page

    paint = function () {
      var items = read();

      list.innerHTML = "";
      for (var i = 0; i < items.length; i++) list.appendChild(row(items[i]));

      var isEmpty = items.length === 0;
      list.hidden = isEmpty;
      if (empty) empty.hidden = !isEmpty;

      totalEl.textContent = money(sum());
    };

    list.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-remove]");
      if (!btn) return;
      remove(btn.getAttribute("data-remove"));
      if (note) note.hidden = true; // a stale message no longer applies
    });

    confirm.addEventListener("click", function () {
      if (read().length === 0) {
        if (!note) return;
        note.hidden = false;
        note.className = "summary__note summary__note--warn";
        note.textContent = "Your cart is empty — add something from the store first.";
        return;
      }

      // Remember the order before the cart is emptied: Settings reads this
      // list for its "Orders" and "Total Spent" figures.
      var placedAt = Date.now();
      var placedTotal = sum();
      var placedItems = read().reduce(function (n, item) {
        return n + item.qty;
      }, 0);

      clear();

      try {
        var orders = JSON.parse(window.localStorage.getItem(ORDERS_KEY) || "[]");
        if (!Array.isArray(orders)) orders = [];
        orders.push({ at: placedAt, total: placedTotal, items: placedItems });
        window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      } catch (err) {
        /* storage blocked — the order simply is not recorded */
      }

      if (note) {
        note.hidden = false;
        note.className = "summary__note summary__note--ok";
        note.textContent =
          "Order confirmed. This is a demo — nothing was charged.";
      }
    });

    paint();
  }

  /* --------------------------------------------------------------- wiring -- */

  window.NLCart = {
    read: read,
    add: add,
    remove: remove,
    clear: clear,
    count: count,
    total: sum,
    sync: syncBadges,
    money: money,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      syncBadges();
      initPage();
    });
  } else {
    syncBadges();
    initPage();
  }

  // Another tab changed the cart: keep this one honest.
  window.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    syncBadges();
    drawPage();
  });
})();
