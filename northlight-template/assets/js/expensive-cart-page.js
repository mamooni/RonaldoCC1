(function () {
  "use strict";

  const cart = window.NLExpensiveCart;

  const emptyMessage = document.getElementById("expensiveCartEmpty");
  const list = document.getElementById("expensiveCartList");
  const count = document.getElementById("expensiveCartCount");
  const total = document.getElementById("expensiveCartTotal");
  const checkoutButton = document.getElementById("expensiveCartCheckout");
  const note = document.getElementById("expensiveCartNote");

  function showNote(message) {
    note.textContent = message;
    note.hidden = false;
  }

  function renderCart() {
    if (!cart || typeof cart.read !== "function") {
      showNote("The cart could not be loaded. Please refresh the page.");
      checkoutButton.disabled = true;
      return;
    }

    const items = cart.read();
    list.replaceChildren();

    let totalItems = 0;

    items.forEach(function (item) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      totalItems += quantity;

      const row = document.createElement("li");
      row.className = "cart__item";

      const details = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = item.title || "Premium product";

      const quantityText = document.createElement("p");
      quantityText.textContent = "Quantity: " + quantity;

      details.appendChild(title);
      details.appendChild(quantityText);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", function () {
        cart.remove(item.id);
        renderCart();
      });

      row.appendChild(details);
      row.appendChild(removeButton);
      list.appendChild(row);
    });

    count.textContent = String(totalItems);
    total.textContent = "Price will be confirmed at checkout";

    const isEmpty = items.length === 0;

    emptyMessage.hidden = !isEmpty;
    list.hidden = isEmpty;
    checkoutButton.disabled = isEmpty;

    if (isEmpty) {
      showNote("Add a product before continuing to checkout.");
    } else {
      note.hidden = true;
    }
  }

  checkoutButton.addEventListener("click", function () {
    const items = cart.read();

    if (!items.length) {
      showNote("Your cart is empty.");
      return;
    }

    window.location.href = "expensive-checkout.html?cart=1";
  });

  renderCart();
})();