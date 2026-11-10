/*  Bundles
    ======
    A plain three-column list — Service Name, Price, Action — paged ten at a
    time, exactly like the reference page.

    The names and prices come from assets/data/bundles-data.js (window.NL_BUNDLES).
    The catalogue ids come from GET /api/bundles, so a Buy Now click can only
    ever name an item the server knows the price of; the browser never sends a
    price of its own. */

(function () {
  "use strict";

  var PAGE_SIZE_DEFAULT = 10;
  var WINDOW = 6; // how many numbered buttons sit between Back and Next

  var BUNDLES = (window.NL_BUNDLES || []).slice();
  var IDS = []; // filled from /api/bundles, same order as BUNDLES

  var PAGE = 1;
  var QUERY = "";

  var ui = {
    rows: document.getElementById("bundleRows"),
    empty: document.getElementById("bundleEmpty"),
    note: document.getElementById("bundleNote"),
    pager: document.getElementById("bundlePager"),
    size: document.getElementById("bundleSize"),
    search: document.getElementById("bundleSearch"),
    searchBtn: document.getElementById("bundleSearchBtn"),
  };

  function money(value) {
    var n = Math.round(Number(value) * 100) / 100;
    return "$" + (isFinite(n) ? n : 0).toFixed(2);
  }

  // "$2.5" reads like the reference; keep the cents only when there are some.
  function priceLabel(value) {
    var n = Math.round(Number(value) * 100) / 100;
    if (!isFinite(n)) n = 0;
    return "$" + (n % 1 === 0 ? n.toFixed(1) : n.toFixed(2));
  }

  function pageSize() {
    var size = parseInt((ui.size && ui.size.value) || "", 10);
    return isFinite(size) && size > 0 ? size : PAGE_SIZE_DEFAULT;
  }

  function filtered() {
    if (!QUERY) return BUNDLES.map(function (bundle, index) { return index; });
    var needle = QUERY.toLowerCase();
    var out = [];
    BUNDLES.forEach(function (bundle, index) {
      if (String(bundle.name).toLowerCase().indexOf(needle) !== -1) out.push(index);
    });
    return out;
  }

  function pages(total) {
    return Math.max(1, Math.ceil(total / pageSize()));
  }


  function showBuyToast(message, tone, options) {
    options = options || {};
    tone = tone || "info";

    // Remove any existing toast
    var old = document.querySelector(".nl-toast-backdrop");
    if (old) old.remove();

    var backdrop = document.createElement("div");
    backdrop.className = "nl-toast-backdrop";
    backdrop.setAttribute("role", "alertdialog");
    backdrop.setAttribute("aria-modal", "true");

    var iconChar = tone === "ok" ? "✓" : tone === "bad" ? "!" : "i";
    var title =
      tone === "bad"
        ? "Payment failed"
        : tone === "ok"
          ? "Purchase complete"
          : "Notice";

    // Special title for insufficient funds
    if (tone === "bad" && /insufficient/i.test(message)) {
      title = "Insufficient balance";
    }

    var toast = document.createElement("div");
    toast.className = "nl-toast nl-toast--" + tone;
    toast.innerHTML =
      '<div class="nl-toast__icon" aria-hidden="true">' +
      iconChar +
      "</div>" +
      '<p class="nl-toast__title"></p>' +
      '<p class="nl-toast__body"></p>' +
      '<div class="nl-toast__actions"></div>';

    toast.querySelector(".nl-toast__title").textContent = title;
    toast.querySelector(".nl-toast__body").textContent = message;

    var actions = toast.querySelector(".nl-toast__actions");

    if (tone === "bad" && /insufficient/i.test(message)) {
      var dep = document.createElement("a");
      dep.className = "nl-toast__btn nl-toast__btn--primary";
      dep.href = "deposit.html";
      dep.textContent = "Deposit funds";
      actions.appendChild(dep);
    }

    var close = document.createElement("button");
    close.type = "button";
    close.className = "nl-toast__btn nl-toast__btn--ghost";
    close.textContent = tone === "ok" ? "OK" : "Close";
    close.addEventListener("click", function () {
      backdrop.remove();
    });
    actions.appendChild(close);

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) backdrop.remove();
    });

    backdrop.appendChild(toast);
    document.body.appendChild(backdrop);
    close.focus({ preventScroll: true });

    if (tone === "ok") {
      window.setTimeout(function () {
        if (backdrop.parentNode) backdrop.remove();
      }, 3200);
    }
  }


  function note(message, tone) {
    if (!message) {
      if (ui.note) {
        ui.note.hidden = true;
        ui.note.textContent = "";
      }
      return;
    }
    if (ui.note) {
      ui.note.hidden = false;
      ui.note.className = "bundles__note bundles__note--" + (tone || "info");
      ui.note.textContent = message;
    }
    if (tone === "bad" || tone === "ok") {
      showBuyToast(message, tone);
    }
  }

  function paintWallet(balance) {
    if (typeof balance !== "number") return;
    Array.prototype.forEach.call(document.querySelectorAll(".js-balance"), function (node) {
      node.textContent = balance.toFixed(2);
    });
  }

  function recordOrder(price) {
    try {
      var orders = JSON.parse(window.localStorage.getItem("nl.orders.v1") || "[]");
      if (!Array.isArray(orders)) orders = [];
      orders.push({ at: Date.now(), total: price, items: 1 });
      window.localStorage.setItem("nl.orders.v1", JSON.stringify(orders));
    } catch (error) {
      /* storage blocked — the purchase still happened on the server */
    }
  }

  function buy(button) {
    if (button.disabled) return;

    var position = Number(button.getAttribute("data-index"));
    var bundle = BUNDLES[position];
    var id = IDS[position];
    if (!bundle) return;

    if (!id) {
      note("That bundle is not in the catalogue yet. Refresh the page.", "bad");
      return;
    }

    button.disabled = true;
    button.textContent = "Buying…";
    note("", null);

    function restore() {
      button.disabled = false;
      button.innerHTML = CART_ICON + "<span>Buy Now</span>";
      button.classList.remove("is-done");
    }

    fetch("api/purchase", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { status: response.status, data: data };
          });
      })
      .then(function (result) {
        if (result.status === 201 && result.data.purchase) {
          button.textContent = "Bought";
          button.classList.add("is-done");
          paintWallet(result.data.balance);
          recordOrder(bundle.price);
          note(
            bundle.name +
              " bought for " +
              money(bundle.price) +
              ". Your wallet holds " +
              money(result.data.balance) +
              ".",
            "ok"
          );
          window.setTimeout(restore, 2600);
          return;
        }

        if (result.status === 402) {
          note(
            "Insufficient funds. " +
              bundle.name +
              " costs " +
              money(result.data.price || bundle.price) +
              " and your wallet holds " +
              money(result.data.balance),
            "bad"
          );
          restore();
          return;
        }

        if (result.status === 401) {
          note("Sign in again to buy anything — your session has ended.", "bad");
          restore();
          return;
        }

        note(result.data.error || "That did not go through. Try again.", "bad");
        restore();
      })
      .catch(function () {
        note("Could not reach the shop. Check your connection and try again.", "bad");
        restore();
      });
  }

  var CART_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/>' +
    '<path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/></svg>';

  function renderPager(total, totalPages) {
    if (!ui.pager) return;
    ui.pager.innerHTML = "";

    if(!total || totalPages <= 1) {
      ui.pager.hidden = true;
      return;
    }
    ui.pager.hidden = false;

    function button(label, page, options) {
      var settings = options || {};
      var element = document.createElement(settings.tag === "span" ? "span" : "button");
      element.className = "bpager__btn" + (settings.className ? " " + settings.className : "");
      element.textContent = label;
      if (settings.tag !== "span") element.type = "button";
      if (settings.current) element.classList.add("is-current");
      if (settings.disabled) element.disabled = true;
      if (typeof page === "number" && !settings.disabled && !settings.current) {
        element.addEventListener("click", function () {
          goToPage(page);
        });
      }
      ui.pager.appendChild(element);
    }

    button("Back", PAGE - 1, {
      className: "bpager__btn--step",
      disabled: PAGE <= 1,
    });

    var start = Math.min(Math.max(1, PAGE - 2), Math.max(1, totalPages - WINDOW + 1));
    var end = Math.min(totalPages, start + WINDOW - 1);

    if (start > 1) button("…", null, { tag: "span", className: "bpager__gap" });

    for (var page = start; page <= end; page++) {
      button(String(page), page, { current: page === PAGE });
    }

    if (end < totalPages) {
      button("…", null, { tag: "span", className: "bpager__gap" });
      button(String(totalPages), totalPages, {});
    }

    button("Next", PAGE + 1, {
      className: "bpager__btn--step",
      disabled: PAGE >= totalPages,
    });
  }

  function render() {
    var matches = filtered();
    var size = pageSize();
    var totalPages = pages(matches.length);

    if (PAGE > totalPages) PAGE = totalPages;
    if (PAGE < 1) PAGE = 1;

    var from = (PAGE - 1) * size;
    var slice = matches.slice(from, from + size);

    ui.rows.innerHTML = "";

    slice.forEach(function (position) {
      var bundle = BUNDLES[position];

      var tr = document.createElement("tr");
      tr.className = "btable__row";

      var name = document.createElement("td");
      name.className = "btable__name";
      name.textContent = bundle.name;

      var price = document.createElement("td");
      price.className = "btable__price";
      price.textContent = priceLabel(bundle.price);

      var action = document.createElement("td");
      action.className = "btable__action";

      var button = document.createElement("button");
      button.type = "button";
      button.className = "buynow";
      button.setAttribute("data-index", String(position));
      button.innerHTML = CART_ICON + "<span>Buy Now</span>";
      button.addEventListener("click", function () {
        buy(button);
      });
      action.appendChild(button);

      tr.appendChild(name);
      tr.appendChild(price);
      tr.appendChild(action);
      ui.rows.appendChild(tr);
    });

    if (ui.empty) ui.empty.hidden = slice.length !== 0;

    renderPager(matches.length, totalPages);
  }

  function goToPage(page) {
    PAGE = page;
    render();
    var section = document.querySelector(".page--bundles");
    if (section && section.scrollIntoView) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------- the ids, from the server -------------------------------- */

  fetch("api/bundles", { credentials: "same-origin" })
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data && Array.isArray(data.ids)) IDS = data.ids;
    })
    .catch(function () {
      /* the buttons still render; buying says the catalogue is not ready */
    });

  /* ---------- wiring --------------------------------------------------- */

  if (ui.search) {
    ui.search.addEventListener("input", function () {
      QUERY = ui.search.value.trim();
      PAGE = 1;
      render();
    });
  }

  if (ui.searchBtn && ui.search) {
    ui.searchBtn.addEventListener("click", function () {
      ui.search.focus();
      QUERY = ui.search.value.trim();
      PAGE = 1;
      render();
    });
  }

  if (ui.size) {
    ui.size.addEventListener("change", function () {
      PAGE = 1;
      render();
    });
  }

  if (!BUNDLES.length) {
    (window.console || {}).warn &&
      console.warn("[northlight] assets/data/bundles-data.js did not load, so the Bundles page is empty.");
  }

  render();
})();
