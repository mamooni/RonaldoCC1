(() => {
    "use strict";
    const API = "/api/legitimate-products";
    const els = {
      form: document.getElementById("catalogueFilters"),
      query: document.getElementById("productQuery"),
      category: document.getElementById("productCategory"),
      format: document.getElementById("productFormat"),
      sort: document.getElementById("productSort"),
      min: document.getElementById("minPrice"),
      max: document.getElementById("maxPrice"),
      size: document.getElementById("productPageSize"),
      grid: document.getElementById("productGrid"),
      count: document.getElementById("resultCount"),
      status: document.getElementById("catalogueStatus"),
      pager: document.getElementById("productPager")
    };
    let products = [];
    let page = 1;

    const clean = value => String(value ?? "").trim();
    const money = value => {
      const amount = Number(value);
      return Number.isFinite(amount) ? "$" + amount.toFixed(2) : "Price on request";
    };
    const escapeHtml = value => clean(value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);

    function filteredProducts() {
      const q = clean(els.query.value).toLowerCase();
      const category = els.category.value;
      const format = els.format.value;
      const min = els.min.value === "" ? 0 : Number(els.min.value);
      const max = els.max.value === "" ? Infinity : Number(els.max.value);
      const list = products.filter(item => {
        const searchable = [item.name, item.description, item.seller, item.category].map(clean).join(" ").toLowerCase();
        const price = Number(item.price);
        return (!q || searchable.includes(q))
          && (!category || clean(item.category) === category)
          && (!format || clean(item.format).toLowerCase() === format)
          && Number.isFinite(price) && price >= min && price <= max;
      });
      const sort = els.sort.value;
      list.sort((a,b) => {
        if (sort === "price-low") return Number(a.price) - Number(b.price);
        if (sort === "price-high") return Number(b.price) - Number(a.price);
        if (sort === "name") return clean(a.name).localeCompare(clean(b.name));
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      return list;
    }

    function render() {
      const list = filteredProducts();
      const pageSize = Number(els.size.value) || 9;
      const pages = Math.max(1, Math.ceil(list.length / pageSize));
      page = Math.min(page, pages);
      const start = (page - 1) * pageSize;
      const shown = list.slice(start, start + pageSize);
      els.count.textContent = list.length + (list.length === 1 ? " product" : " products");
      els.grid.innerHTML = "";
      if (!shown.length) {
        const empty = document.createElement("div");
        empty.className = "catalogue__empty";
        empty.textContent = products.length ? "No products match those filters." : "No products have been published yet.";
        els.grid.appendChild(empty);
      } else {
        shown.forEach(item => {
          const card = document.createElement("article");
          card.className = "product-card";
          const image = clean(item.image_url);
          card.innerHTML = `
            <div class="product-card__image">${image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.name) + '" loading="lazy">' : 'Product image'}</div>
            <div class="product-card__body">
              <div class="product-card__eyebrow">${escapeHtml(item.category)} · ${escapeHtml(item.format)}</div>
              <h2>${escapeHtml(item.name)}</h2>
              <p>${escapeHtml(item.description || "No description provided.")}</p>
              <div class="product-card__foot"><span class="product-card__price">${money(item.price)}</span><span>${escapeHtml(item.seller || "")}</span></div>
            </div>`;
          els.grid.appendChild(card);
        });
      }
      els.pager.innerHTML = "";
      if (pages > 1) {
        for (let n = 1; n <= pages; n++) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = String(n);
          if (n === page) button.setAttribute("aria-current", "page");
          button.addEventListener("click", () => { page = n; render(); });
          els.pager.appendChild(button);
        }
      }
    }

    function updateCategories() {
      const current = els.category.value;
      const categories = [...new Set(products.map(item => clean(item.category)).filter(Boolean))].sort();
      els.category.innerHTML = '<option value="">All categories</option>' + categories.map(value =>
        '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'
      ).join("");
      if (categories.includes(current)) els.category.value = current;
    }

    async function loadProducts() {
      try {
        const response = await fetch(API, { headers: { "Accept": "application/json" } });
        if (!response.ok) throw new Error("Catalogue API returned " + response.status);
        const payload = await response.json();
        products = Array.isArray(payload) ? payload : Array.isArray(payload.products) ? payload.products : [];
        products = products.filter(item => item && item.status !== "draft");
        updateCategories();
        els.status.textContent = "";
        render();
      } catch (error) {
        products = [];
        els.status.textContent = "The product feed is not connected yet.";
        render();
      }
    }

    els.form.addEventListener("submit", event => { event.preventDefault(); page = 1; render(); });
    els.form.addEventListener("reset", () => setTimeout(() => { page = 1; render(); }, 0));
    [els.query, els.category, els.format, els.sort, els.min, els.max, els.size].forEach(control => {
      control.addEventListener("input", () => { page = 1; render(); });
      control.addEventListener("change", () => { page = 1; render(); });
    });
    loadProducts();
  })();
