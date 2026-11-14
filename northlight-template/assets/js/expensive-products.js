
(function () {
  "use strict";

  const productsContainer = document.getElementById("expensiveProducts");
  if (!productsContainer) return;

  const loadingMessage = document.getElementById("expensiveLoading");
  const errorMessage = document.getElementById("expensiveError");
  const emptyMessage = document.getElementById("expensiveEmpty");

  function addText(parent, tag, className, value) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    element.textContent = value == null ? "" : String(value);
    parent.appendChild(element);

    return element;
  }

  function formatPrice(value) {
    const price = Number(value);

    if (!Number.isFinite(price)) {
      return "Price unavailable";
    }

    return "$" + price.toFixed(2);
  }

  function formatDate(timestamp) {
    const seconds = Number(timestamp);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "Date unavailable";
    }

    return new Date(seconds * 1000).toLocaleString();
  }

  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "expensive-card";

    addText(card, "h2", "expensive-card__title", product.title);
    addText(card, "p", "expensive-card__creator",
      "By " + (product.creator || "Unknown creator"));

    addText(card, "p", "expensive-card__category",
      product.category);

    addText(card, "p", "expensive-card__description",
      product.blurb);

    const details = document.createElement("div");
    details.className = "expensive-card__details";

    addText(details, "p", "", "Formats: " + (product.formats || "—"));
    addText(details, "p", "", "Licence: " + (product.license || "—"));
    addText(details, "p", "", "Refund period: " +
      (product.refund_period || "—"));

    card.appendChild(details);

    addText(card, "p", "expensive-card__price",
      formatPrice(product.price));

    addText(card, "p", "expensive-card__date",
      "Added: " + formatDate(product.created_at));

    return card;
  }

  async function loadProducts() {
    loadingMessage.hidden = false;
    errorMessage.hidden = true;
    emptyMessage.hidden = true;
    productsContainer.replaceChildren();

    try {
      const response = await fetch("/api/expensive-products", {
        headers: {
          "Accept": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load products.");
      }

      const products = Array.isArray(data.products)
        ? data.products
        : [];

      loadingMessage.hidden = true;

      if (products.length === 0) {
        emptyMessage.hidden = false;
        return;
      }

      products.forEach(function (product) {
        productsContainer.appendChild(createProductCard(product));
      });

    } catch (error) {
      loadingMessage.hidden = true;
      errorMessage.textContent =
        error.message || "Something went wrong while loading products.";
      errorMessage.hidden = false;
    }
  }

  loadProducts();
})();
