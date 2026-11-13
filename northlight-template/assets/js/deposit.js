/* ==========================================================================
   Deposit page — deposit.js
   Two-step deposit flow:
      1. "Create deposit"  → choose currency + amount
      2. "Add funds details" → crypto amount, date & time, address, QR

   Sections:
     1. Currency table (addresses, rates, fees, format checks)
     2. Elements + state
     3. Helpers (formatting, storage)
     4. Step 1 — open the create dialog
     5. Step 2 — build the details, open it, start confirmations
     6. Copy buttons
     7. Confirmation polling (0/3 → 3/3 → credited)
     8. History table
     9. Bootstrap
   ========================================================================== */

(function () {
  "use strict";

  /* ---- 1. Currency table ------------------------------------------------- */

  // `rate` is a fixed demo price (USD per 1 coin) so the page runs offline.
  // `fee` is the flat USD fee charged on the deposit (USDT only, per the brief).
  var CURRENCIES = {
    btc: {
      code: "BTC",
      network: "Bitcoin",
      address: "1BzKeecKgfRcjSaRdxkv9mmx36TUZzvtYM",
      rate: 65000,
      decimals: 8,
      fee: 0,
      confirm: "Bitcoin confirms in roughly 10–60 minutes",
      pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      formatHint:
        "This does not look like a Bitcoin address — legacy addresses start with “1” or “3”.",
    },
    eth: {
      code: "ETH",
      network: "Ethereum",
      address: "0x5b5b52a9f36dda6c6ad9778249aec391588a7ab2",
      rate: 3200,
      decimals: 6,
      fee: 0,
      confirm: "Ethereum confirms in about a minute",
      pattern: /^0x[a-fA-F0-9]{40}$/,
      formatHint:
        "This does not look like an Ethereum address — Ethereum addresses start with “0x” followed by 40 hex characters. Check it before sending.",
    },
    ltc: {
      code: "LTC",
      network: "Litecoin",
      address: "Lgy7CNUoio9rgJhCAoUQgqmjDyeUHgDYQr",
      rate: 85,
      decimals: 6,
      fee: 0,
      confirm: "Litecoin confirms in about 2 minutes",
      pattern: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
      formatHint:
        "This does not look like a Litecoin address — they start with “L”, “M” or “3”.",
    },
    sol: {
      code: "SOL",
      network: "Solana",
      address: "BJryhN4KmgVQuq87yy2RuQq8nomH2cPH3qNDuFP7iQQx",
      rate: 150,
      decimals: 9,
      fee: 0,
      confirm: "Solana confirms in a few seconds",
      pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      formatHint:
        "This does not look like a valid Solana address. Check that it contains 32–44 Base58 characters.",
},
    "usdt-trc20": {
      code: "USDT",
      network: "TRC-20",
      address: "TScAz2TJAt2vj7PapWKvcB33LC2QemfKQk",
      rate: 1,
      decimals: 2,
      fee: 10,
      confirm: "Tron confirms in a few seconds",
      pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
      formatHint:
        "This does not look like a TRC-20 address — those start with “T” and are 34 characters long.",
    },
    "usdt-bep20": {
      code: "USDT",
      network: "BEP-20",
      address: "0xa92b7ce26ccf947ef62550c85caceccde84a5482",
      rate: 1,
      decimals: 2,
      fee: 10,
      confirm: "BNB Chain confirms in about 15 seconds",
      pattern: /^0x[a-fA-F0-9]{40}$/,
      formatHint:
        "This does not look like an EVM address — those start with “0x” followed by 40 hex characters.",
    },
  };

  // A built *-preview.html has no backend behind it: there is nothing to POST
  // to, so the flow explains that instead of blaming the network.
  var PREVIEW = !!window.NL_PREVIEW;

  var MIN = 25;
  var MAX = 80000;
  var STEP_DELAY = 2200; // demo pause between confirmations

  /* ---- 2. Elements + state ----------------------------------------------- */

  function $(id) {
    return document.getElementById(id);
  }

  var ui = {
    openCreate: $("openCreate"),
    createDialog: $("createDialog"),
    detailsDialog: $("detailsDialog"),
    currencyButton: $("currencyButton"),
    currencyList: $("currencyList"),
    currencyValue: $("currencyValue"),
    currencyCoin: $("currencyCoin"),
    dCoin: $("dCoin"),
    amount: $("depositAmount"),
    amountError: $("amountError"),
    createDeposit: $("createDeposit"),
    feeNote: $("feeNote"),
    dCrypto: $("dCrypto"),
    dDate: $("dDate"),
    dAddress: $("dAddress"),
    dCredit: $("dCredit"),
    dQr: $("dQr"),
    backToCreate: $("backToCreate"),
    paymentDone: $("paymentDone"),
    verifyBox: $("verifyBox"),
    verifyText: $("verifyText"),
    historyBody: $("historyBody"),
    balances: document.querySelectorAll(".js-balance"),
  };

  var state = {
    currencyKey: "btc",
    pending: 0, // outstanding deposits awaiting confirmation
    draft: null, // the amount waiting in the details step
    sent: false, // has this draft already been filed with the admin?
  };

  /* ---- 3. Helpers -------------------------------------------------------- */

  function currency() {
    return CURRENCIES[state.currencyKey];
  }

  function money(value) {
    return (
      "$" +
      value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function coinText(value, key) {
    var c = CURRENCIES[key];
    var text = value.toFixed(c.decimals);
    if (c.decimals > 2) {
      text = text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }
    return text + " " + c.code;
  }

  function dateTime(date) {
    return date.toLocaleString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  var storage = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : raw;
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        /* ignore */
      }
    },
  };

  function currentBalance() {
    return parseFloat(storage.get("nl_balance", "24.00")) || 0;
  }

  function setBalance(value) {
    var formatted = value.toFixed(2);
    ui.balances.forEach(function (node) {
      node.textContent = formatted;
    });
    storage.set("nl_balance", formatted);
  }

  function showError(message) {
    ui.amountError.textContent = message;
    ui.amountError.hidden = false;
    ui.amount.classList.add("is-invalid");
  }

  function clearError() {
    ui.amountError.textContent = "";
    ui.amountError.hidden = true;
    ui.amount.classList.remove("is-invalid");
  }

  /* ---- 4. Step 1 — create dialog ----------------------------------------- */

  function syncFeeNote() {
    var c = currency();
    if (c.fee > 0) {
      ui.feeNote.hidden = false;
      ui.feeNote.textContent =
        c.code + " has a " + money(c.fee) + " fee to deposit!";
    } else {
      ui.feeNote.hidden = true;
    }
  }

  ui.openCreate.addEventListener("click", function () {
    clearError();
    ui.amount.value = "";
    syncFeeNote();
    ui.createDialog.showModal();
    ui.currencyButton.focus();
  });

  /* -- currency combobox (native <select> replaced so options can carry logos) -- */

  function currencyOptions() {
    return Array.prototype.slice.call(
      ui.currencyList.querySelectorAll(".select__option")
    );
  }

  function highlight(index) {
    currencyOptions().forEach(function (option) {
      option.classList.remove("is-active");
    });
    var list = currencyOptions();
    if (index < 0 || index >= list.length) return;
    list[index].classList.add("is-active");
    if (list[index].scrollIntoView) {
      list[index].scrollIntoView({ block: "nearest" });
    }
  }

  function openList() {
    ui.currencyList.hidden = false;
    ui.currencyButton.setAttribute("aria-expanded", "true");
    highlight(selectedIndex());
    // move focus into the list so arrow keys drive the highlight
    ui.currencyList.focus({ preventScroll: true });
  }

  function closeList() {
    ui.currencyList.hidden = true;
    ui.currencyButton.setAttribute("aria-expanded", "false");
  }

  function selectedIndex() {
    var index = currencyOptions().findIndex(function (option) {
      return option.dataset.value === state.currencyKey;
    });
    return index < 0 ? 0 : index;
  }

  function selectCurrency(key) {
    if (!CURRENCIES[key]) return;
    state.currencyKey = key;

    var option = ui.currencyList.querySelector('[data-value="' + key + '"]');
    if (option) {
      currencyOptions().forEach(function (li) {
        var on = li === option;
        li.classList.toggle("is-selected", on);
        li.setAttribute("aria-selected", on ? "true" : "false");
      });

      // copy the option's badge into the closed button
      var badge = option.querySelector(".coin");
      if (badge) {
        ui.currencyCoin.setAttribute("data-coin", badge.dataset.coin);
        ui.currencyCoin.innerHTML = badge.innerHTML;
      }
      ui.currencyValue.textContent = option.querySelector("b").textContent;
    }

    clearError();
    syncFeeNote();
  }

  ui.currencyButton.addEventListener("click", function (event) {
    event.stopPropagation();
    ui.currencyList.hidden ? openList() : closeList();
  });

  ui.currencyButton.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openList();
    }
  });

  ui.currencyList.addEventListener("click", function (event) {
    var option = event.target.closest(".select__option");
    if (!option) return;
    selectCurrency(option.dataset.value);
    closeList();
    ui.currencyButton.focus();
  });

  ui.currencyList.addEventListener("keydown", function (event) {
    var list = currencyOptions();
    var active = list.findIndex(function (option) {
      return option.classList.contains("is-active");
    });

    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight(Math.min(active + 1, list.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight(Math.max(active - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (active >= 0) selectCurrency(list[active].dataset.value);
      closeList();
      ui.currencyButton.focus();
    } else if (event.key === "Escape") {
      closeList();
      ui.currencyButton.focus();
    }
  });

  document.addEventListener("click", function (event) {
    if (ui.currencyList.hidden) return;
    if (!ui.currencyList.contains(event.target)) closeList();
  });

  ui.createDeposit.addEventListener("click", function () {
    var c = currency();
    var amount = parseFloat(ui.amount.value);

    if (!isFinite(amount) || amount <= 0) {
      showError("Enter an amount to continue.");
      ui.amount.focus();
      return;
    }
    if (amount < MIN) {
      showError("The minimum deposit is " + money(MIN) + ".");
      ui.amount.focus();
      return;
    }
    if (amount > MAX) {
      showError("The maximum deposit is " + money(MAX) + ".");
      ui.amount.focus();
      return;
    }
    if (amount <= c.fee) {
      showError(
        "The amount must be more than the " + money(c.fee) + " deposit fee."
      );
      ui.amount.focus();
      return;
    }

    clearError();
    openDetails(amount);
  });

  ui.amount.addEventListener("input", clearError);

  /* ---- 5. Step 2 — details dialog + confirmations ------------------------ */

  function openDetails(amount) {
    var c = currency();
    var key = state.currencyKey;
    var crypto = amount / c.rate;
    var credited = amount - c.fee;

    ui.dCrypto.textContent = coinText(crypto, key);
    ui.dDate.textContent = dateTime(new Date());
    ui.dAddress.textContent = c.address;

    ui.dCredit.textContent =
      c.fee > 0
        ? "Credited when an admin confirms: " +
          money(credited) +
          " (" +
          money(c.fee) +
          " fee deducted)."
        : "Credited when an admin confirms: " + money(credited) + ".";

    // coin badge in the dialog title
    var option = ui.currencyList.querySelector('[data-value="' + key + '"]');
    var badge = option && option.querySelector(".coin");
    if (badge) {
      ui.dCoin.setAttribute("data-coin", badge.dataset.coin);
      ui.dCoin.innerHTML = badge.innerHTML;
    }

    // show only this currency's QR
    ui.dQr.querySelectorAll("[data-qr]").forEach(function (node) {
      node.hidden = node.dataset.qr !== key;
    });

    // non-blocking format check on the receiving address
    var ok = c.pattern.test(c.address);
    ui.verifyBox.hidden = ok;
    if (!ok) ui.verifyText.textContent = c.formatHint;

    ui.dCredit.classList.remove("is-error");

    // reset copy buttons
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.classList.remove("is-copied");
    });

    // nothing is filed yet: the details step is a preview the visitor can back
    // out of, and "Payment done" is what sends it to the admin
    state.draft = { amount: amount, credited: credited, key: key, requestId: requestKey() };
    state.sent = false;
    ui.paymentDone.disabled = false;
    ui.paymentDone.textContent = "Payment done";
    ui.backToCreate.disabled = false;

    ui.createDialog.close();
    ui.detailsDialog.showModal();
  }

  /* -- back: return to the currency/amount step without filing anything -- */

  ui.backToCreate.addEventListener("click", function () {
    if (state.sent) return;
    ui.detailsDialog.close();

    // keep what was typed so only the address (currency) has to change
    if (state.draft) ui.amount.value = String(state.draft.amount);
    syncFeeNote();
    clearError();
    ui.createDialog.showModal();
    ui.amount.focus();
  });

  /* -- Payment done: this is what reaches the admin --------------------- */

  ui.paymentDone.addEventListener("click", function () {
    if (!state.draft || state.sent) return;

    var draft = state.draft;
    var c = CURRENCIES[draft.key];

    state.sent = true;
    ui.paymentDone.disabled = true;
    ui.paymentDone.textContent = "Sending…";
    ui.backToCreate.disabled = true;

    submitPayment(draft, c, ui.dDate.textContent);
  });

  /* -- closing (footer Close or the ✕) only closes: nothing is filed ----- */

  function resetDraft() {
    state.draft = null;
    state.sent = false;
    ui.paymentDone.disabled = false;
    ui.paymentDone.textContent = "Payment done";
    ui.backToCreate.disabled = false;
  }

  document.querySelectorAll("#detailsDialog [data-close-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!state.sent) resetDraft();
      ui.detailsDialog.close();
      ui.dCredit.textContent = "";
      ui.amount.value = "";
    });
  });

  /* ---- 6. Copy buttons --------------------------------------------------- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "absolute";
      helper.style.left = "-9999px";
      document.body.appendChild(helper);
      helper.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(helper);
      ok ? resolve() : reject();
    });
  }

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.dataset.copy);
      if (!target) return;

      copyText(target.textContent).then(
        function () {
          btn.classList.add("is-copied");
          window.setTimeout(function () {
            btn.classList.remove("is-copied");
          }, 1600);
        },
        function () {
          // clipboard blocked: select the text so it can be copied by hand
          var range = document.createRange();
          range.selectNodeContents(target);
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      );
    });
  });

  /* ---- 7. Submitting the deposit ----------------------------------------- */

  // One key per draft: if the connection drops and the visitor retries, the
  // server recognises the request and hands back the payment it already made
  // instead of filing a second one.
  function requestKey() {
    var uuid =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID().replace(/-/g, "")
        : String(Date.now()) + Math.random().toString(36).slice(2);
    return "dep-" + uuid.slice(0, 40);
  }

  // A deposit is a request: the server records it as pending and an admin
  // confirms or fails it in the admin console. The wallet is credited by the
  // server at that point, so nothing is added here.
  function submitPayment(draft, c, dateText) {
    fetch("api/payments", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: draft.credited,
        asset: c.code,
        network: c.network,
        request_id: draft.requestId,
      }),
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            // a 4xx/5xx is not a network problem: it has its own message
            if (!response.ok) {
              if (PREVIEW && noBackend(response.status)) {
                paymentSent(draft, c, null, dateText);
                return;
              }
              paymentFailed(reasonFor(response.status, body && body.error));
              return;
            }
            paymentSent(draft, c, body, dateText);
          });
      })
      .catch(function () {
        if (PREVIEW) {
          // a single-file preview cannot hold a connection: demo the flow
          paymentSent(draft, c, null, dateText);
          return;
        }
        paymentFailed(
          "We could not reach the server, so this deposit was not sent. " +
            "Check your connection and press Payment done again."
        );
      });
  }

  // Statuses a static host uses when it has no API to route to.
  function noBackend(status) {
    return status === 404 || status === 405 || status === 501;
  }

  // Server messages are written for humans — use them as-is.
  function reasonFor(status, message) {
    if (status === 405 || status === 501) {
      return "Deposits are unavailable right now. Please try again later.";
    }
    if (status >= 500) {
      return "Something went wrong on our side, nothing was sent. Try again in a moment.";
    }
    if (message) return message;
    if (status === 401) return "Your session ended. Sign in again to deposit.";
    if (status === 429) return "That is a lot of deposits at once. Wait a few minutes.";
    return "The server refused this deposit (HTTP " + status + "). Try again.";
  }

  // The server has the payment: receipt, close the flow, say so on the page.
  function paymentSent(draft, c, body, dateText) {
    var id = body && body.payment && body.payment.id;
    var preview = body === null;

    try {
      var row = addHistoryRow({
        date: dateText,
        label: c.code + " · " + c.network,
        amount: draft.amount,
        status: "pending",
        confirmations: 0,
      });
      paintPending(row);
      flashRow(row);
    } catch (err) {
      // the receipt row is a nicety; the payment itself is already filed
    }

    state.pending += 1;
    closeFlow();
    setTimeout(loadHistory, 400); // the row that is now on the server

    if (preview) {
      announce(
        "Preview only — this deposit was not sent anywhere. Serve the site "
          + "with server/app.py and it will land in the admin console.",
        true
      );
      return;
    }

    announce(
      "Payment details submitted. Deposit #" +
        (id === undefined ? "" : id) +
        " is awaiting verification."
    );
  }

  // Nothing was filed: keep the dialog open and explain why.
  function paymentFailed(message) {
    ui.dCredit.classList.add("is-error");
    state.sent = false;
    ui.paymentDone.disabled = false;
    ui.paymentDone.textContent = "Payment done";
    ui.backToCreate.disabled = false;
    ui.dCredit.textContent = message;
  }

  // Kept for clarity: every key is generated once per draft, so pressing
  // "Payment done" again after a failure reuses it (no duplicate payment).

  function closeFlow() {
    try {
      ui.detailsDialog.close();
    } catch (err) {}
    try {
      if (ui.createDialog.open) ui.createDialog.close();
    } catch (err) {}
    ui.dCredit.textContent = "";
    ui.amount.value = "";
    resetDraft();
  }

  function paintPending(row) {
    var badge = row.querySelector(".status");
    if (!badge) return;
    badge.className = "status status--pending";
    badge.textContent = "Pending review";
  }

  function flashRow(row) {
    if (!row || typeof row.animate !== "function") return;
    row.animate(
      [
        { backgroundColor: "rgba(183, 118, 12, 0.14)" },
        { backgroundColor: "transparent" },
      ],
      { duration: 900, easing: "ease-out" }
    );
  }

  // Short-lived note shown on the page after the flow closes.
  var announceTimer = null;
  function announce(text, preview) {
    var note = document.getElementById("depositNote");
    if (!note) return;
    note.classList.toggle("deposit-note--preview", !!preview);
    note.textContent = text;
    note.hidden = false;
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(function () {
      note.hidden = true;
      note.textContent = "";
    }, 9000);
  }

  /* ---- 8. History -------------------------------------------------------- */

  
  function addHistoryRow(entry) {
    var tr = document.createElement("tr");

    var date = document.createElement("td");
    date.textContent = entry.date;

    var currencyCell = document.createElement("td");
    currencyCell.textContent = entry.label;

    var amount = document.createElement("td");
    amount.textContent = money(entry.amount);

    var status = document.createElement("td");
    var badge = document.createElement("span");
    badge.className =
      entry.status === "completed" ? "status status--ok" : "status status--pending";
    badge.textContent =
      entry.status === "completed"
        ? "Completed"
        : entry.status === "failed"
          ? "Failed — Contact support"
          : "Pending review";

    status.appendChild(badge);

    tr.appendChild(date);
    tr.appendChild(currencyCell);
    tr.appendChild(amount);
    tr.appendChild(status);

    ui.historyBody.appendChild(tr);
    return tr;
  }

  // The list is the visitor's own history from the server — no sample rows.
  function loadHistory() {
    if (PREVIEW) return; // a single file has no server to ask

    fetch("api/payments", { credentials: "same-origin" })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (!data || !data.payments) return;
        ui.historyBody.textContent = "";

        if (!data.payments.length) {
          var tr = document.createElement("tr");
          var td = document.createElement("td");
          td.colSpan = 4;
          td.className = "table-simple__empty";
          td.textContent = "No deposits yet.";
          tr.appendChild(td);
          ui.historyBody.appendChild(tr);
          return;
        }

        data.payments.forEach(function (payment) {
          addHistoryRow({
            date: dateTime(new Date(payment.created_at * 1000)),
            label: payment.asset + " · " + payment.network,
            amount: payment.amount,
            status: payment.status === "confirmed"
              ? "completed"
              : payment.status === "failed"
                ? "failed"
                : "pending",
          });
        });
      })
      .catch(function () {
        // no server, or signed out: an empty list is the honest answer
      });
  }

  /* ---- 9. Bootstrap ------------------------------------------------------ */

  var saved = parseFloat(storage.get("nl_balance", "24.00"));
  setBalance(isFinite(saved) ? saved : 24);

  selectCurrency(state.currencyKey);
  closeList();
  loadHistory();

  // close buttons in both dialogs
  document.querySelectorAll("[data-close-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dialog = btn.closest("dialog");
      if (dialog) dialog.close();
    });
  });

  // Dropdowns (account menu, nav tabs) are handled by menu.js, which every
  // page with the top bar loads.

})();
