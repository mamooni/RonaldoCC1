(function () {
  "use strict";
  var form = document.getElementById("productCheckForm");
  var input = document.getElementById("productIdInput");
  var button = document.getElementById("productCheckButton");
  var result = document.getElementById("productCheckResult");
  if (!form || !input || !button || !result) return;

  function show(message, state, product) {
    result.hidden = false;
    result.className = "product-check-result product-check-result--" + state;
    result.replaceChildren();
    var heading = document.createElement("strong");
    heading.className = "product-check-result__heading";
    heading.textContent = message;
    result.appendChild(heading);
    if (product) {
      var details = document.createElement("p");
      details.className = "product-check-result__details";
      details.textContent = product.title + " · " + product.product_id + " · " + product.type;
      result.appendChild(details);
      var note = document.createElement("p");
      note.textContent = "This product is currently listed in the Northlight catalogue.";
      result.appendChild(note);
    }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var id = input.value.trim();
    if (!id) { show("Enter a product ID to check.", "error"); input.focus(); return; }
    button.disabled = true;
    button.textContent = "Checking…";
    result.hidden = true;
    try {
      var response = await fetch("/api/product-check?id=" + encodeURIComponent(id), {
        headers: { Accept: "application/json" }, credentials: "same-origin"
      });
      var data = await response.json();
      if (response.ok && data.available && data.product) {
        show("Product available for purchase", "success", data.product);
      } else if (response.status === 404) {
        show("Product unavailable", "error");
        var explanation = document.createElement("p");
        explanation.textContent = "We couldn't find that ID in the current catalogue. Check the ID and try again.";
        result.appendChild(explanation);
      } else {
        show(data.error || "We couldn't verify this product right now. Please try again.", "error");
      }
    } catch (error) {
      show("Connection error. Please try again.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Verify Product";
    }
  });
}());
