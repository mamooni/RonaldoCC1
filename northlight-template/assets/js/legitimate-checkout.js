
(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  const loading = $("checkoutLoading");
  const error = $("checkoutError");
  const summary = $("checkoutSummary");
  const itemsList = $("checkoutItems");
  const totalText = $("checkoutTotal");
  const payButton = $("payButton");
  const nameSection = $("nameSection");
  const nameForm = $("customerNameForm");
  const nameInput = $("customerFullName");
  const nameSubmit = $("nameSubmit");
  const supportSection = $("supportSection");
  const supportMessage = $("supportMessage");
  const supportOrderId = $("supportOrderId");
  const status = $("checkoutStatus");

  const CART_KEY = "nl.legitimate.checkout.intent.v1";
  const ACTIVE_ORDER_KEY = "nl.legitimate.active.order.v1";

  const params = new URLSearchParams(window.location.search);
  const cartMode = params.get("cart") === "1";
  const directProductId = params.get("product");

  let checkoutItems = [];
  let currentOrderId = null;
  let currentOrderTotal = null;
  let requestKey = null;
  let busy = false;

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    loading.hidden = true;
  }

  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
  }

  function hideError() {
    error.hidden = true;
    error.textContent = "";
  }

  function makeRequestKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }

  function getCheckoutItems() {
    if (cartMode) {
      if (!window.NLLegitCart) {
        throw new Error("Your cart could not be loaded. Please return to the cart.");
      }

      return window.NLLegitCart.read().map(function (item) {
        return {
          product_id: Number(item.id),
          quantity: Number(item.qty) || 1,
          title: item.title || "Premium product"
        };
      });
    }

    if (directProductId && /^\d+$/.test(directProductId)) {
      return [{
        product_id: Number(directProductId),
        quantity: 1,
        title: "Premium product"
      }];
    }

    return [];
  }

  function validateItems(items) {
    return items.length > 0 &&
      items.length <= 50 &&
      items.every(function (item) {
        return Number.isSafeInteger(item.product_id) &&
          item.product_id > 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 20;
      });
  }

  function getRequestKey(items) {
    const signature = JSON.stringify(
      items.map(function (item) {
        return {
          product_id: item.product_id,
          quantity: item.quantity
        };
      })
    );

    try {
      const saved = JSON.parse(sessionStorage.getItem(CART_KEY) || "null");

      if (saved && saved.signature === signature && saved.request_key) {
        return saved.request_key;
      }

      const key = makeRequestKey();

      sessionStorage.setItem(CART_KEY, JSON.stringify({
        signature: signature,
        request_key: key
      }));

      return key;
    } catch (e) {
      throw new Error("Checkout storage is unavailable. Please enable browser storage and try again.");
    }
  }

  async function api(url, options) {
    const response = await fetch(url, Object.assign({
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      }
    }, options || {}));

    let data;

    try {
      data = await response.json();
    } catch (e) {
      throw new Error("The server returned an invalid response. Please try again.");
    }

    return {
      ok: response.ok,
      status: response.status,
      data: data
    };
  }

  function renderSummary(items) {
    itemsList.replaceChildren();

    items.forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = item.title + " × " + item.quantity;
      itemsList.appendChild(li);
    });

    totalText.textContent = "The final price will be calculated securely by Ronaldo CC.";
    summary.hidden = false;
    loading.hidden = true;
  }

  function updateSupportLinks(orderId, total) {
    const amount = Number(total);
    const amountText = Number.isFinite(amount)
      ? " ($" + amount.toFixed(2) + ")"
      : "";
    const message =
      "Hello, I need help completing catalogue order #" +
      orderId +
      amountText +
      ".";

    document.querySelectorAll("#supportSection .checkout-support-list a").forEach(function (link) {
      const username = link.textContent.trim().replace(/^@/, "");
      link.href =
        "https://t.me/" +
        encodeURIComponent(username) +
        "?text=" +
        encodeURIComponent(message);
    });
  }

  function showNameStep(orderId, total) {
    currentOrderId = orderId;
    currentOrderTotal = total;
    updateSupportLinks(orderId, total);

    try {
      sessionStorage.setItem(ACTIVE_ORDER_KEY, String(orderId));
    } catch (e) {
      // The current page can still complete the name step.
    }

    summary.hidden = true;
    loading.hidden = true;
    error.hidden = true;
    nameSection.hidden = false;

    if (total !== undefined) {
      showStatus("Payment recorded. Order #" + orderId + " — total: " + total);
    } else {
      showStatus("Your existing paid order #" + orderId + " was recovered.");
    }

    nameInput.focus();
  }

  async function recoverOrder() {
    const response = await api("/api/legitimate-product-orders", {
      method: "GET",
      headers: {}
    });

    if (!response.ok || !Array.isArray(response.data.orders)) {
      return false;
    }

    const savedId = sessionStorage.getItem(ACTIVE_ORDER_KEY);

    let order = null;

    if (savedId) {
      order = response.data.orders.find(function (entry) {
        return String(entry.id) === savedId;
      });
    }

    if (!order && !cartMode && !directProductId) {
      order = response.data.orders.find(function (entry) {
        return entry.status === "awaiting_customer_name";
      });
    }

    if (!order) {
      return false;
    }

    if (order.status !== "awaiting_customer_name") {
      if (order.full_name) {
        sessionStorage.removeItem(ACTIVE_ORDER_KEY);
        supportMessage.textContent =
          "Your order already has a customer name recorded. Contact one of our Telegram support accounts below to complete your order and receive your products.";
        supportOrderId.textContent = "Order ID: #" + order.id;
        updateSupportLinks(order.id, order.total);
        nameSection.hidden = true;
        supportSection.hidden = false;
        loading.hidden = true;
        return true;
      }

      return false;
    }

    showNameStep(order.id, order.total);
    return true;
  }

  async function prepareCheckout() {
    try {
      const recovered = await recoverOrder();

      if (recovered) {
        return;
      }

      checkoutItems = getCheckoutItems();

      if (!validateItems(checkoutItems)) {
        throw new Error("Your checkout has no valid products. Return to the products page and try again.");
      }

      requestKey = getRequestKey(checkoutItems);
      renderSummary(checkoutItems);
    } catch (e) {
      showError(e.message || "Unable to prepare checkout.");
    }
  }

  payButton.addEventListener("click", async function () {
    if (busy || !requestKey || !validateItems(checkoutItems)) {
      return;
    }

    busy = true;
    payButton.disabled = true;
    payButton.textContent = "Processing payment...";
    hideError();

    try {
      const response = await api("/api/legitimate-product-checkout", {
        method: "POST",
        body: JSON.stringify({
          request_key: requestKey,
          items: checkoutItems.map(function (item) {
            return {
              product_id: item.product_id,
              quantity: item.quantity
            };
          })
        })
      });

      if (response.status === 402) {
        showError(
          "Your wallet balance is insufficient. You need " +
          response.data.missing +
          " more to complete this purchase. Please deposit funds and try again."
        );

        const depositLink = document.createElement("a");
        depositLink.href = "deposit.html";
        depositLink.textContent = " Go to Deposit";
        error.appendChild(depositLink);
        return;
      }

      if (!response.ok || response.data.success !== true) {
        throw new Error(response.data.error || "Payment could not be completed.");
      }

      if (!response.data.order_id) {
        throw new Error("The server did not return an order number. Contact support before retrying.");
      }

      if (cartMode && window.NLLegitCart) {
        window.NLLegitCart.clear();
      }

      sessionStorage.removeItem(CART_KEY);

      showNameStep(response.data.order_id, response.data.total);
    } catch (e) {
      showError(
        e.message ||
        "We could not confirm the payment. Retry using this same checkout page; do not start a new checkout."
      );
    } finally {
      busy = false;
      payButton.disabled = false;
      payButton.textContent = "Pay with Wallet";
    }
  });

  nameForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (busy || !currentOrderId) {
      return;
    }

    const fullName = nameInput.value.trim();

    if (fullName.length < 2 || fullName.length > 190) {
      showError("Please enter a valid full name.");
      return;
    }

    busy = true;
    nameSubmit.disabled = true;
    nameSubmit.textContent = "Saving...";
    hideError();

    try {
      const response = await api("/api/legitimate-product-name", {
        method: "POST",
        body: JSON.stringify({
          order_id: currentOrderId,
          full_name: fullName
        })
      });

      if (!response.ok || response.data.success !== true) {
        throw new Error(response.data.error || "Your name could not be saved.");
      }

      sessionStorage.removeItem(ACTIVE_ORDER_KEY);

      nameSection.hidden = true;
      supportMessage.textContent =
        "Your order information has been saved. Contact one of our Telegram support accounts below to complete your order and receive your products.";
      supportOrderId.textContent = "Order ID: #" + currentOrderId;
      updateSupportLinks(currentOrderId, currentOrderTotal);
      supportSection.hidden = false;

      showStatus("Your order information has been saved.");
    } catch (e) {
      showError(e.message || "Unable to save your name. Please try again.");
    } finally {
      busy = false;
      nameSubmit.disabled = false;
      nameSubmit.textContent = "Submit Name";
    }
  });

  prepareCheckout();
})();
