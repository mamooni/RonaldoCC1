
/* ==========================================================================
   Northlight — deposit.js

   Deposit workflow:
   1. Customer selects currency and amount.
   2. Backend creates the payment and calculates the crypto quote.
   3. Customer sends crypto to the displayed wallet address.
   4. Customer reports the payment.
   5. Admin verifies the transaction and approves or rejects it.

   IMPORTANT:
   - The frontend never credits a wallet.
   - The backend is authoritative for prices, fees and payment status.
   - Do not change the wallet addresses without verifying them independently.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. CURRENCY CONFIGURATION
     ------------------------------------------------------------------------ */

  var CURRENCIES = {
    btc: {
      code: "BTC",
      network: "Bitcoin",
      address: "1BzKeecKgfRcjSaRdxkv9mmx36TUZzvtYM",
      decimals: 8,
      fee: 0,
      pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      formatHint: "This does not look like a Bitcoin address — legacy addresses start with 1 or 3."
    },

    eth: {
      code: "ETH",
      network: "Ethereum",
      address: "0x5b5b52a9f36dda6c6ad9778249aec391588a7ab2",
      decimals: 6,
      fee: 0,
      pattern: /^0x[a-fA-F0-9]{40}$/,
      formatHint: "This does not look like an Ethereum address — check the 0x address and its 40 hexadecimal characters."
    },

    ltc: {
      code: "LTC",
      network: "Litecoin",
      address: "Lgy7CNUoio9rgJhCAoUQgqmjDyeUHgDYQr",
      decimals: 6,
      fee: 0,
      pattern: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
      formatHint: "This does not look like a Litecoin address — they start with L, M or 3."
    },

    sol: {
      code: "SOL",
      network: "Solana",
      address: "BJryhN4KmgVQuq87yy2RuQq8nomH2cPH3qNDuFP7iQQx",
      decimals: 9,
      fee: 0,
      pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      formatHint: "This does not look like a valid Solana address. Check its 32–44 Base58 characters."
    },

    "usdt-trc20": {
      code: "USDT",
      network: "TRC-20",
      address: "TScAz2TJAt2vj7PapWKvcB33LC2QemfKQk",
      decimals: 2,
      fee: 10,
      pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
      formatHint: "This does not look like a TRC-20 address — those start with T and are 34 characters long."
    },

    "usdt-bep20": {
      code: "USDT",
      network: "BEP-20",
      address: "0xa92b7ce26ccf947ef62550c85caceccde84a5482",
      decimals: 2,
      fee: 10,
      pattern: /^0x[a-fA-F0-9]{40}$/,
      formatHint: "This does not look like a BEP-20 address — check the 0x address and its 40 hexadecimal characters."
    }
  };

  var PREVIEW = !!window.NL_PREVIEW;
  var MIN = 25;
  var MAX = 80000;

  /* ------------------------------------------------------------------------
     2. ELEMENTS AND STATE
     ------------------------------------------------------------------------ */

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

    balances: document.querySelectorAll(".js-balance")
  };

  var state = {
    currencyKey: "btc",
    draft: null,
    sent: false,
    quote: null,
    quoteLoading: false
  };

  /* ------------------------------------------------------------------------
     3. BASIC HELPERS
     ------------------------------------------------------------------------ */

  function requireElements() {
    var required = [
      "openCreate",
      "createDialog",
      "detailsDialog",
      "currencyButton",
      "currencyList",
      "amount",
      "createDeposit",
      "dCrypto",
      "dDate",
      "dAddress",
      "dCredit",
      "dQr",
      "backToCreate",
      "paymentDone",
      "historyBody"
    ];

    for (var i = 0; i < required.length; i++) {
      if (!ui[required[i]]) {
        console.error(
          "Northlight deposit.js: missing element #" + required[i]
        );
        return false;
      }
    }

    return true;
  }

  function money(value) {
    var number = Number(value);

    if (!Number.isFinite(number)) {
      number = 0;
    }

    return "$" + number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function coinText(value, key) {
    var decimals = CURRENCIES[key].decimals;
    var number = Number(value);

    if (!Number.isFinite(number)) {
      return "Unavailable";
    }

    var result = number.toFixed(decimals);

    if (decimals > 2) {
      result = result
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, "");
    }

    return result + " " + CURRENCIES[key].code;
  }

  function dateTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  function parseServerDate(value) {
    if (value === null || value === undefined) {
      return new Date(NaN);
    }

    if (typeof value === "number" || /^\d+$/.test(String(value))) {
      var number = Number(value);

      // Treat 10-digit timestamps as seconds and 13-digit as milliseconds.
      if (number < 100000000000) {
        number *= 1000;
      }

      return new Date(number);
    }

    return new Date(value);
  }

  function currency() {
    return CURRENCIES[state.currencyKey];
  }

  function showError(message) {
    if (!ui.amountError) return;

    ui.amountError.textContent = message;
    ui.amountError.hidden = false;
    ui.amount.classList.add("is-invalid");
  }

  function clearError() {
    if (ui.amountError) {
      ui.amountError.textContent = "";
      ui.amountError.hidden = true;
    }

    ui.amount.classList.remove("is-invalid");
  }

  function syncFeeNote() {
    if (!ui.feeNote) return;

    var fee = currency().fee;

    ui.feeNote.hidden = fee <= 0;

    if (fee > 0) {
      ui.feeNote.textContent =
        "USDT deposits include a " +
        money(fee) +
        " network fee added to the amount you send.";
    }
  }

  function requestKey() {
    var value;

    if (window.crypto && window.crypto.randomUUID) {
      value = window.crypto.randomUUID().replace(/-/g, "");
    } else {
      value =
        String(Date.now()) +
        Math.random().toString(36).slice(2);
    }

    return "dep-" + value.slice(0, 40);
  }

  function announce(message, preview) {
    var note = $("depositNote");

    if (!note) return;

    note.classList.toggle(
      "deposit-note--preview",
      !!preview
    );

    note.textContent = message;
    note.hidden = false;

    window.clearTimeout(announce.timer);

    announce.timer = window.setTimeout(function () {
      note.hidden = true;
      note.textContent = "";
    }, 9000);
  }

  /* ------------------------------------------------------------------------
     4. CURRENCY DROPDOWN
     ------------------------------------------------------------------------ */

  function currencyOptions() {
    return Array.prototype.slice.call(
      ui.currencyList.querySelectorAll("[data-value]")
    );
  }

  function closeList() {
    ui.currencyList.hidden = true;
    ui.currencyButton.setAttribute("aria-expanded", "false");
  }

  function highlight(index) {
    var options = currencyOptions();

    options.forEach(function (option) {
      option.classList.remove("is-active");
    });

    if (index < 0 || index >= options.length) {
      return;
    }

    options[index].classList.add("is-active");

    if (options[index].scrollIntoView) {
      options[index].scrollIntoView({
        block: "nearest"
      });
    }
  }

  function selectedIndex() {
    return currencyOptions().findIndex(function (option) {
      return option.dataset.value === state.currencyKey;
    });
  }

  function openList() {
    ui.currencyList.hidden = false;

    ui.currencyButton.setAttribute(
      "aria-expanded",
      "true"
    );

    highlight(Math.max(0, selectedIndex()));

    ui.currencyList.focus({
      preventScroll: true
    });
  }

  function selectCurrency(key) {
    if (!CURRENCIES[key]) {
      return;
    }

    state.currencyKey = key;

    var option = ui.currencyList.querySelector(
      '[data-value="' + key + '"]'
    );

    if (option) {
      currencyOptions().forEach(function (item) {
        var selected = item === option;

        item.classList.toggle("is-selected", selected);

        item.setAttribute(
          "aria-selected",
          selected ? "true" : "false"
        );
      });

      var badge = option.querySelector(".coin");

      if (badge && ui.currencyCoin) {
        ui.currencyCoin.setAttribute(
          "data-coin",
          badge.dataset.coin
        );

        ui.currencyCoin.innerHTML = badge.innerHTML;
      }

      if (ui.currencyValue) {
        var label = option.querySelector("b");

        ui.currencyValue.textContent = label
          ? label.textContent
          : key;
      }
    }

    clearError();
    syncFeeNote();
  }

  /* ------------------------------------------------------------------------
     5. DIALOG AND PAYMENT STATE
     ------------------------------------------------------------------------ */

  function setBusy(isBusy, label) {
    ui.paymentDone.disabled = !!isBusy;

    ui.paymentDone.textContent =
      label ||
      (isBusy
        ? "Please wait…"
        : "I've sent the payment");

    ui.backToCreate.disabled = !!isBusy;
  }

  function resetDraft() {
    state.draft = null;
    state.sent = false;
    state.quote = null;
    state.quoteLoading = false;

    setBusy(false, "Payment done");
  }

  function closeFlow() {
    try {
      if (ui.detailsDialog.open) {
        ui.detailsDialog.close();
      }
    } catch (error) {}

    try {
      if (ui.createDialog.open) {
        ui.createDialog.close();
      }
    } catch (error) {}

    ui.dCredit.textContent = "";
    ui.amount.value = "";

    resetDraft();
  }

  function paymentFailed(message, quoteFailure) {
    ui.dCredit.classList.add("is-error");
    ui.dCredit.textContent = message;

    state.sent = false;

    if (quoteFailure) {
      ui.paymentDone.disabled = true;
      ui.paymentDone.textContent = "Quote unavailable";
      ui.backToCreate.disabled = false;
    } else {
      // Keep the same payment ID so the customer can safely retry.
      setBusy(false, "Retry report");
    }
  }

  function reasonFor(status, message) {
    if (status === 401) {
      return "Your session ended. Sign in again to deposit.";
    }

    if (status === 429) {
      return message ||
        "Too many deposit requests. Wait a few minutes.";
    }

    if (status >= 500) {
      return "The server is temporarily unavailable. Please try again.";
    }

    return message ||
      ("The server refused this request (HTTP " + status + ").");
  }

  /* ------------------------------------------------------------------------
     6. OPEN DEPOSIT DETAILS AND CREATE SERVER QUOTE
     ------------------------------------------------------------------------ */

  function openDetails(amount) {
    var c = currency();
    var key = state.currencyKey;

    var draft = {
      amount: amount,
      credited: amount,
      key: key,
      requestId: requestKey(),
      paymentId: null,
      quoteExpiresAt: null
    };

    state.draft = draft;
    state.sent = false;
    state.quote = null;
    state.quoteLoading = true;

    ui.dCrypto.textContent = "Getting live quote…";
    ui.dDate.textContent = dateTime(new Date());
    ui.dAddress.textContent = c.address;

    ui.dCredit.textContent =
      "Calculating your exact payment amount…";

    ui.dCredit.classList.remove("is-error");

    var option = ui.currencyList.querySelector(
      '[data-value="' + key + '"]'
    );

    var badge = option && option.querySelector(".coin");

    if (badge && ui.dCoin) {
      ui.dCoin.setAttribute(
        "data-coin",
        badge.dataset.coin
      );

      ui.dCoin.innerHTML = badge.innerHTML;
    }

    ui.dQr.querySelectorAll("[data-qr]").forEach(function (node) {
      node.hidden = node.dataset.qr !== key;
    });

    var addressLooksValid = c.pattern.test(c.address);

    if (ui.verifyBox) {
      ui.verifyBox.hidden = addressLooksValid;
    }

    if (!addressLooksValid && ui.verifyText) {
      ui.verifyText.textContent = c.formatHint;
    }

    document.querySelectorAll("[data-copy]").forEach(function (button) {
      button.classList.remove("is-copied");
    });

    setBusy(true, "Preparing quote…");

    ui.createDialog.close();
    ui.detailsDialog.showModal();

    createQuote(draft, c);
  }

  function createQuote(draft, c) {
    if (PREVIEW) {
      state.quoteLoading = false;

      paymentFailed(
        "Preview only: live deposit quotes require the Northlight server.",
        true
      );

      return;
    }

    fetch("api/payments", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: draft.credited,
        asset: c.code,
        network: c.network,
        request_id: draft.requestId
      })
    })
      .then(function (response) {
        return response.json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            if (state.draft !== draft) {
              return;
            }

            if (!response.ok) {
              state.quoteLoading = false;

              paymentFailed(
                reasonFor(
                  response.status,
                  body && body.error
                ),
                true
              );

              return;
            }

            var payment = body && body.payment;

            if (
              !payment ||
              !payment.id ||
              payment.crypto_amount == null ||
              payment.quote_expires_at == null ||
              payment.amount == null ||
              payment.send_amount == null ||
              payment.network_fee == null
            ) {
              state.quoteLoading = false;

              paymentFailed(
                "The server returned an incomplete quote. Do not send payment. Please try again.",
                true
              );

              return;
            }

            state.quoteLoading = false;
            state.quote = payment;

            draft.paymentId = payment.id;
            draft.quoteExpiresAt =
              Number(payment.quote_expires_at);

            if (
              !Number.isFinite(draft.quoteExpiresAt) ||
              draft.quoteExpiresAt <= 0
            ) {
              paymentFailed(
                "The server returned an invalid quote expiry. Do not send payment.",
                true
              );

              return;
            }

            if (
              draft.quoteExpiresAt * 1000 <= Date.now()
            ) {
              paymentFailed(
                "This quote has already expired. Go back and create a new quote. Do not send using an expired quote.",
                true
              );

              return;
            }

            ui.dCrypto.textContent = coinText(
              payment.crypto_amount,
              draft.key
            );

            ui.dDate.textContent = dateTime(new Date());

            ui.dCredit.textContent =
              "Wallet credit: " +
              money(payment.amount) +
              ". Network fee: " +
              money(payment.network_fee) +
              ". Total send value: " +
              money(payment.send_amount) +
              ". Quote expires: " +
              dateTime(
                new Date(draft.quoteExpiresAt * 1000)
              ) +
              ".";

            ui.paymentDone.disabled = false;
            ui.paymentDone.textContent =
              "I've sent the payment";

            ui.backToCreate.disabled = false;
          });
      })
      .catch(function () {
        if (state.draft !== draft) {
          return;
        }

        state.quoteLoading = false;

        paymentFailed(
          "We couldn't reach the server to create a quote. Check your connection and try again. Do not send crypto without a valid quote.",
          true
        );
      });
  }

  /* ------------------------------------------------------------------------
     7. CUSTOMER REPORTS PAYMENT SENT
     ------------------------------------------------------------------------ */

  function reportPayment() {
    var draft = state.draft;

    if (!draft || state.sent) {
      return;
    }

    if (!draft.paymentId) {
      paymentFailed(
        "There is no valid server payment record. Go back and create a new quote.",
        true
      );

      return;
    }

    state.sent = true;

    setBusy(true, "Submitting report…");

    fetch("api/payment-sent", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: draft.paymentId
      })
    })
      .then(function (response) {
        return response.json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            if (state.draft !== draft) {
              return;
            }

            if (!response.ok) {
              paymentFailed(
                reasonFor(
                  response.status,
                  body && body.error
                ),
                false
              );

              return;
            }

            closeFlow();

            window.setTimeout(loadHistory, 400);

            announce(
              "Your payment report was submitted. Your deposit is awaiting admin verification."
            );
          });
      })
      .catch(function () {
        if (state.draft !== draft) {
          return;
        }

        paymentFailed(
          "We couldn't confirm whether your report reached the server. You can retry safely using the same payment record.",
          false
        );
      });
  }

  /* ------------------------------------------------------------------------
     8. DEPOSIT HISTORY
     ------------------------------------------------------------------------ */

  function addHistoryRow(entry) {
    var tr = document.createElement("tr");

    var dateCell = document.createElement("td");
    dateCell.textContent = entry.date;

    var currencyCell = document.createElement("td");
    currencyCell.textContent = entry.label;

    var amountCell = document.createElement("td");
    amountCell.textContent = money(entry.amount);

    var statusCell = document.createElement("td");
    var badge = document.createElement("span");

    if (
      entry.status === "confirmed" ||
      entry.status === "completed"
    ) {
      badge.className = "status status--ok";
      badge.textContent = "Completed";
    } else if (entry.status === "failed") {
      badge.className = "status status--failed";
      badge.textContent = "Failed — Contact support";
    } else if (entry.status === "awaiting_payment") {
      badge.className = "status status--pending";
      badge.textContent = "Awaiting payment";
    } else {
      badge.className = "status status--pending";
      badge.textContent = "Pending review";
    }

    statusCell.appendChild(badge);

    tr.appendChild(dateCell);
    tr.appendChild(currencyCell);
    tr.appendChild(amountCell);
    tr.appendChild(statusCell);

    ui.historyBody.appendChild(tr);

    return tr;
  }

  function loadHistory() {
    if (PREVIEW) {
      return;
    }

    fetch("api/payments", {
      credentials: "same-origin"
    })
      .then(function (response) {
        if (!response.ok) {
          return null;
        }

        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.payments)) {
          return;
        }

        ui.historyBody.textContent = "";

        if (data.payments.length === 0) {
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
          var date = parseServerDate(payment.created_at);

          addHistoryRow({
            date: dateTime(date),
            label:
              (payment.asset || "") +
              " · " +
              (payment.network || ""),
            amount: payment.amount,
            status: payment.status
          });
        });
      })
      .catch(function () {
        // Keep existing history visible if the request fails.
      });
  }

  /* ------------------------------------------------------------------------
     9. COPY ADDRESS
     ------------------------------------------------------------------------ */

  function copyText(text) {
    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
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

      var copied = false;

      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }

      document.body.removeChild(helper);

      if (copied) {
        resolve();
      } else {
        reject();
      }
    });
  }

  /* ------------------------------------------------------------------------
     10. EVENT HANDLERS
     ------------------------------------------------------------------------ */

  function bindEvents() {
    ui.openCreate.addEventListener("click", function () {
      clearError();

      ui.amount.value = "";

      syncFeeNote();

      ui.createDialog.showModal();

      ui.currencyButton.focus();
    });

    ui.currencyButton.addEventListener("click", function (event) {
      event.stopPropagation();

      if (ui.currencyList.hidden) {
        openList();
      } else {
        closeList();
      }
    });

    ui.currencyButton.addEventListener("keydown", function (event) {
      if (
        event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openList();
      }
    });

    ui.currencyList.addEventListener("click", function (event) {
      var option = event.target.closest("[data-value]");

      if (!option) {
        return;
      }

      selectCurrency(option.dataset.value);

      closeList();

      ui.currencyButton.focus();
    });

    ui.currencyList.addEventListener("keydown", function (event) {
      var options = currencyOptions();

      var active = options.findIndex(function (option) {
        return option.classList.contains("is-active");
      });

      if (event.key === "ArrowDown") {
        event.preventDefault();

        highlight(
          Math.min(active + 1, options.length - 1)
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();

        highlight(Math.max(active - 1, 0));
      } else if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        if (active >= 0) {
          selectCurrency(options[active].dataset.value);
        }

        closeList();

        ui.currencyButton.focus();
      } else if (event.key === "Escape") {
        closeList();
        ui.currencyButton.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (
        !ui.currencyList.hidden &&
        !ui.currencyList.contains(event.target) &&
        !ui.currencyButton.contains(event.target)
      ) {
        closeList();
      }
    });

    ui.createDeposit.addEventListener("click", function () {
      var amount = Number(ui.amount.value);
      var fee = currency().fee;

      if (!Number.isFinite(amount) || amount <= 0) {
        showError("Enter an amount to continue.");
      } else if (amount < MIN) {
        showError(
          "The minimum deposit is " + money(MIN) + "."
        );
      } else if (amount > MAX) {
        showError(
          "The maximum deposit is " + money(MAX) + "."
        );
      } else if (amount <= fee) {
        showError(
          "The amount must be more than the " +
          money(fee) +
          " network fee."
        );
      } else {
        clearError();
        openDetails(amount);
      }
    });

    ui.amount.addEventListener("input", clearError);

    ui.backToCreate.addEventListener("click", function () {
      if (state.sent) {
        return;
      }

      var previousAmount = state.draft
        ? state.draft.amount
        : "";

      if (ui.detailsDialog.open) {
        ui.detailsDialog.close();
      }

      resetDraft();

      ui.amount.value = String(previousAmount);

      syncFeeNote();
      clearError();

      ui.createDialog.showModal();

      ui.amount.focus();
    });

    ui.paymentDone.addEventListener(
      "click",
      reportPayment
    );

    document
      .querySelectorAll("#detailsDialog [data-close-dialog]")
      .forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (state.sent) {
            return;
          }

          if (ui.detailsDialog.open) {
            ui.detailsDialog.close();
          }

          resetDraft();

          ui.dCredit.textContent = "";
          ui.amount.value = "";
        });
      });

    document.querySelectorAll("[data-copy]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = document.getElementById(
          button.dataset.copy
        );

        if (!target) {
          return;
        }

        copyText(target.textContent)
          .then(function () {
            button.classList.add("is-copied");

            window.setTimeout(function () {
              button.classList.remove("is-copied");
            }, 1600);
          })
          .catch(function () {
            var range = document.createRange();

            range.selectNodeContents(target);

            var selection = window.getSelection();

            selection.removeAllRanges();
            selection.addRange(range);
          });
      });
    });

    document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
      button.addEventListener("click", function () {
        var dialog = button.closest("dialog");

        if (
          dialog &&
          dialog.id !== "detailsDialog"
        ) {
          dialog.close();
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     11. START
     ------------------------------------------------------------------------ */

  function bootstrap() {
    if (!requireElements()) {
      return;
    }

    bindEvents();

    selectCurrency(state.currencyKey);

    closeList();

    loadHistory();
  }

  bootstrap();

})();
