
(function () {
  "use strict";

  const form = document.getElementById("expensiveProductForm");
  if (!form) return;

  const fields = document.getElementById("expensiveProductFields");
  const addButton = document.getElementById("addProductSlot");
  const saveButton = document.getElementById("saveExpensiveProducts");
  const note = document.getElementById("productsAdminNote");
  const importButton = document.getElementById("importExpensiveDraft");
  const draftCsvInput = document.getElementById("expensiveDraftCsv");
  const tableBody = document.getElementById("expensiveProductsBody");
  const loadMoreButton = document.getElementById("loadMoreExpensiveProducts");
  const PRODUCTS_PER_PAGE = 10;
  let allProducts = [];
  let visibleProductCount = PRODUCTS_PER_PAGE;
  const emptyMessage = document.getElementById("expensiveProductsEmpty");
  const editPanel = document.getElementById("editExpensiveProduct");
  const editForm = document.getElementById("editExpensiveProductForm");
  const editNote = document.getElementById("editExpensiveProductNote");
  const editSaveButton = document.getElementById("saveEditedExpensiveProduct");
  const editCancelButton = document.getElementById("cancelEditExpensiveProduct");
  let editingProductId = null;

  const MAX_PRODUCTS = 5;

  function populateCountrySelect(select) {
    const countries = window.NL_COUNTRIES || [];

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a country";
    select.appendChild(placeholder);

    countries.forEach(function (country) {
      const option = document.createElement("option");
      option.value = country.code;
      option.textContent = country.name;
      select.appendChild(option);
    });
  }

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
      ["Public Product ID", "product_id", "text", 64, "NL-WEB-001"],
      ["Expiry (MM/YYYY)", "expDate", "text", 7, "11/2028"],
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

    const countryLabel = document.createElement("label");
    countryLabel.appendChild(
      document.createTextNode("Intended country")
    );

    const countrySelect = document.createElement("select");
    countrySelect.name = "country_code";
    countrySelect.required = true;

    populateCountrySelect(countrySelect);

    countryLabel.appendChild(countrySelect);
    wrapper.appendChild(countryLabel);

    const descriptionLabel = document.createElement("label");
    descriptionLabel.appendChild(
      document.createTextNode("Description")
    );

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
    const count = fields.querySelectorAll(
      ".admin__product-form"
    ).length;

    addButton.disabled = count >= MAX_PRODUCTS;

    addButton.textContent = count >= MAX_PRODUCTS
      ? "Maximum of five products"
      : "Add another product";
  }

  function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    row.appendChild(cell);
  }

  function openEditProduct(product) {
    editingProductId = product.id;

    editForm.elements.namedItem("product_id").value = product.product_id || "";
    editForm.elements.namedItem("expDate").value = product.expDate || "";
    editForm.elements.namedItem("title").value = product.title || "";
    editForm.elements.namedItem("creator").value = product.creator || "";
    editForm.elements.namedItem("country_code").value = product.country_code || "";
    editForm.elements.namedItem("category").value = product.category || "";
    editForm.elements.namedItem("formats").value = product.formats || "";
    editForm.elements.namedItem("license").value = product.license || "";
    editForm.elements.namedItem("refund_period").value = product.refund_period || "";
    editForm.elements.namedItem("price").value = product.price || "";
    editForm.elements.namedItem("blurb").value = product.blurb || "";

    editNote.hidden = true;
    editPanel.hidden = false;
    editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteProduct(product, button) {
    if (!product || !product.id) return;

    const productLabel = product.title || product.product_id || "this product";
    const publicId = product.product_id ? " (" + product.product_id + ")" : "";
    const confirmed = window.confirm(
      "Delete “" + productLabel + "”" + publicId + "?\\n\\n" +
      "This permanently removes the premium product from the catalogue and cannot be undone. " +
      "Existing customer order records are not deleted."
    );

    if (!confirmed) return;

    button.disabled = true;
    showNote("Deleting " + productLabel + "…", false);

    try {
      const response = await fetch(
        "api/admin/expensive-products/delete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ id: product.id })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete product.");
      }

      if (editingProductId === product.id) {
        editForm.reset();
        editingProductId = null;
        editPanel.hidden = true;
      }

      showNote("“" + productLabel + "” was deleted successfully.", false);
      await loadProducts();
    } catch (error) {
      showNote(error.message || "Could not delete product.", true);
    } finally {
      button.disabled = false;
    }
  }

  function renderProducts() {
    tableBody.replaceChildren();

    allProducts.slice(0, visibleProductCount).forEach(function (product) {
      const row = document.createElement("tr");

      addCell(row, product.id);
      addCell(row, product.product_id || "—");
      addCell(row, product.expDate || "—");
      addCell(row, product.title);
      addCell(row, product.creator);
      addCell(row, product.category);

      const price = Number(product.price);
      addCell(
        row,
        Number.isFinite(price) ? "$" + price.toFixed(2) : "—"
      );

      const added = product.created_at
        ? new Date(Number(product.created_at) * 1000).toLocaleString()
        : "—";
      addCell(row, added);

      const actions = document.createElement("td");

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin__refresh admin__product-edit";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", function () {
        openEditProduct(product);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin__refresh admin__product-delete";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", function () {
        deleteProduct(product, deleteButton);
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      row.appendChild(actions);
      tableBody.appendChild(row);
    });

    emptyMessage.hidden = allProducts.length !== 0;
    if (loadMoreButton) {
      const remaining = Math.max(0, allProducts.length - visibleProductCount);
      loadMoreButton.hidden = remaining === 0;
      loadMoreButton.textContent = remaining > 0
        ? "Load more (" + Math.min(PRODUCTS_PER_PAGE, remaining) + " more)"
        : "All products loaded";
    }
  }

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", function () {
      visibleProductCount = Math.min(
        visibleProductCount + PRODUCTS_PER_PAGE,
        allProducts.length
      );
      renderProducts();
    });
  }

  async function loadProducts() {
    try {
      const response = await fetch("api/expensive-products");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load products.");
      }

      allProducts = Array.isArray(data.products) ? data.products : [];
      visibleProductCount = PRODUCTS_PER_PAGE;
      renderProducts();
    } catch (error) {
      showNote(error.message || "Could not load existing products.", true);
    }
  }

  editForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!editingProductId) {
      return;
    }

    const product = {};
    editForm.querySelectorAll("[name]").forEach(function (field) {
      product[field.name] = field.value.trim();
    });

    product.id = editingProductId;

    editSaveButton.disabled = true;
    editNote.hidden = false;
    editNote.textContent = "Saving changes…";

    try {
      const response = await fetch(
        "api/admin/expensive-products/update",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(product)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const details = Array.isArray(data.details)
          ? " " + data.details.join(" ")
          : "";

        throw new Error(
          (data.error || "Could not update product.") + details
        );
      }

      editPanel.hidden = true;
      editingProductId = null;
      editForm.reset();

      showNote("Product updated successfully.", false);
      await loadProducts();
    } catch (error) {
      editNote.textContent =
        error.message || "Could not update product.";
    } finally {
      editSaveButton.disabled = false;
    }
  });

  editCancelButton.addEventListener("click", function () {
    editForm.reset();
    editingProductId = null;
    editNote.hidden = true;
    editPanel.hidden = true;
  });

  addButton.addEventListener("click", function () {
    const count = fields.querySelectorAll(
      ".admin__product-form"
    ).length;

    if (count >= MAX_PRODUCTS) return;

    fields.appendChild(productSlot(count + 1));
    updateSlotControls();
  });

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
      const response = await fetch(
        "api/admin/expensive-products",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ products: products })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const details = Array.isArray(data.details)
          ? " " + data.details.join(" ")
          : "";

        throw new Error(
          (data.error || "Could not save products.") + details
        );
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
      showNote(
        error.message || "Something went wrong.",
        true
      );
    } finally {
      saveButton.disabled = false;
    }
  });

  if (importButton) {
    importButton.addEventListener("click", async function () {
      const confirmed = window.confirm(
        "Replace the entire live premium catalogue with the 250 rows in inventory-draft.csv?\n\n" +
        "All current premium products will be removed from the live shop. The 250 rows will be saved as private drafts, not published. " +
        "Customer accounts, wallet balances, deposits, purchases, order history and audit records will be preserved. " +
        "This action cannot be undone."
      );
      if (!confirmed) return;

      importButton.disabled = true;
      showNote("Reading and validating the CSV… please keep this page open.", false);
      try {
        if (!draftCsvInput || !draftCsvInput.files || !draftCsvInput.files.length) {
          throw new Error("Choose the edited 250-row CSV file before replacing the catalogue.");
        }
        const file = draftCsvInput.files[0];
        if (!/\.csv$/i.test(file.name) || file.size > 100000) {
          throw new Error("Choose a CSV file smaller than 100 KB.");
        }
        const csvText = await file.text();
        const response = await fetch("api/admin/expensive-products/import-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv_text: csvText })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not import the draft inventory.");
        showNote(
          "Replacement complete: " + data.live_products_removed +
          " live products removed; " + data.drafts_created +
          " private draft rows saved. Customer history was preserved.",
          false
        );
        await loadProducts();
      } catch (error) {
        showNote(error.message || "Could not import the draft inventory.", true);
      } finally {
        importButton.disabled = false;
      }
    });
  }

  // Populate the country dropdown in the original HTML form.
  fields.querySelectorAll(
    'select[name="country_code"]'
  ).forEach(populateCountrySelect);

  populateCountrySelect(
    editForm.elements.namedItem("country_code")
  );

  updateSlotControls();
  loadProducts();
})();
