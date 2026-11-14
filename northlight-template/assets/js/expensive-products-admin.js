
(function () {
  "use strict";

  const form = document.getElementById("expensiveProductForm");
  if (!form) return;

  const fields = document.getElementById("expensiveProductFields");
  const addButton = document.getElementById("addProductSlot");
  const saveButton = document.getElementById("saveExpensiveProducts");
  const note = document.getElementById("productsAdminNote");
  const tableBody = document.getElementById("expensiveProductsBody");
  const emptyMessage = document.getElementById("expensiveProductsEmpty");

  const MAX_PRODUCTS = 5;

  function showNote(message, isError) {
    note.hidden = false;
    note.textContent = message;
    note.style.color = isError ? "#dc2626" : "";
  }

  function productSlot(number) {
    const wrapper = document.createElement("div");
    wrapper.className = "admin__product-form";

    const heading = document.createElement("h3");
    heading.textContent = "Product " + number;
    wrapper.appendChild(heading);

    const inputs = [
      ["Title", "title", "text", 190, ""],
      ["Creator", "creator", "text", 100, ""],
      ["Category", "category", "text", 100, "Interface kit"],
      ["Formats", "formats", "text", 255, "Figma, Sketch, SVG"],
      ["Licence", "license", "text", 190, "Single team licence"],
      ["Refund period", "refund_period", "text", 64, "14 days"],
      ["Price (USD)", "price", "number", 20, ""]
    ];

    inputs.forEach(function (item) {
      const label = document.createElement("label");
      label.appendChild(document.createTextNode(item[0]));

      const input = document.createElement("input");
      input.name = item[1];
      input.type = item[2];
      input.maxLength = item[3];

      if (item[1] === "price") {
        input.min = "0.01";
        input.max = "1000000";
        input.step = "0.01";
      } else {
        input.placeholder = item[4];
      }

      input.required = true;
      label.appendChild(input);
      wrapper.appendChild(label);
    });

    const descriptionLabel = document.createElement("label");
    descriptionLabel.appendChild(document.createTextNode("Description"));

    const description = document.createElement("textarea");
    description.name = "blurb";
    description.maxLength = 4000;
    description.rows = 3;
    description.required = true;

    descriptionLabel.appendChild(description);
    wrapper.appendChild(descriptionLabel);

    return wrapper;
  }

  function updateSlotControls() {
    const count = fields.querySelectorAll(".admin__product-form").length;
    addButton.disabled = count >= MAX_PRODUCTS;
    addButton.textContent = count >= MAX_PRODUCTS
      ? "Maximum of five products"
      : "Add another product";
  }

  addButton.addEventListener("click", function () {
    const count = fields.querySelectorAll(".admin__product-form").length;

    if (count >= MAX_PRODUCTS) return;

    fields.appendChild(productSlot(count + 1));
    updateSlotControls();
  });

  function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    row.appendChild(cell);
  }

  async function loadProducts() {
    try {
      const response = await fetch("api/expensive-products");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load products.");
      }

      tableBody.replaceChildren();

      const products = Array.isArray(data.products) ? data.products : [];

      products.forEach(function (product, index) {
        const row = document.createElement("tr");

        addCell(row, index + 1);
        addCell(row, product.title);
        addCell(row, product.creator);
        addCell(row, product.category);

        const price = Number(product.price);
        addCell(row, Number.isFinite(price) ? "$" + price.toFixed(2) : "—");

        const added = product.created_at
          ? new Date(Number(product.created_at) * 1000).toLocaleString()
          : "—";

        addCell(row, added);
        tableBody.appendChild(row);
      });

      emptyMessage.hidden = products.length !== 0;
    } catch (error) {
      showNote(error.message || "Could not load existing products.", true);
    }
    
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const slots = Array.from(
      fields.querySelectorAll(".admin__product-form")
    );

    const products = slots.map(function (slot) {
    const product = {};

    slot.querySelectorAll("[name]").forEach(function (field) {
        product[field.name] = field.value.trim();
    });

    return product;
    });

    saveButton.disabled = true;
    showNote("Saving products…", false);

    try {
      const response = await fetch("api/admin/expensive-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ products: products })
      });

      const data = await response.json();

      if (!response.ok) {
        const details = Array.isArray(data.details)
          ? " " + data.details.join(" ")
          : "";

        throw new Error((data.error || "Could not save products.") + details);
      }

      form.reset();
      fields.replaceChildren(productSlot(1));
      updateSlotControls();

      showNote(
        data.count + " product(s) saved successfully.",
        false
      );

      await loadProducts();
    } catch (error) {
      showNote(error.message || "Something went wrong.", true);
    } finally {
      saveButton.disabled = false;
    }
  });

  updateSlotControls();
  loadProducts();
})();
