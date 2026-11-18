(function () {
  "use strict";
  const body = document.getElementById("expensiveProducts");
  if (!body) return;
  const loading = document.getElementById("expensiveLoading");
  const errorBox = document.getElementById("expensiveError");
  const empty = document.getElementById("expensiveEmpty");
  const pagination = document.getElementById("expensivePagination");
  const prev = document.getElementById("previousPage");
  const next = document.getElementById("nextPage");
  const pageInfo = document.getElementById("pageInfo");
  const search = document.getElementById("expensiveSearch");
  const category = document.getElementById("expensiveCategory");
  const country = document.getElementById("expensiveCountry");
  const PER_PAGE = 20;
  let products = [], visible = [], page = 1;

  function addCell(row, value, cls) {
    const td = document.createElement("td");
    td.textContent = value == null || value === "" ? "—" : String(value);
    if (cls) td.className = cls;
    row.appendChild(td);
    return td;
  }
  function addBadgeCell(row, value, cls) {
    const td = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = cls;
    badge.textContent = value == null || value === "" ? "—" : String(value);
    td.appendChild(badge);
    row.appendChild(td);
    return td;
  }
  function countryLabel(code) {
    const found = (window.NL_COUNTRIES || []).find(function (item) { return item.code === code; });
    return found ? found.name : (code || "—");
  }
  function option(select, value, label) {
    const el = document.createElement("option");
    el.value = value; el.textContent = label; select.appendChild(el);
  }
  function setupFilters() {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
    const countries = Array.from(new Set(products.map(p => p.country_code).filter(Boolean))).sort();
    category.replaceChildren(); option(category, "", "All categories");
    cats.forEach(v => option(category, v, v));
    country.replaceChildren(); option(country, "", "All countries");
    countries.forEach(v => option(country, v, countryLabel(v)));
  }
  function filterProducts() {
    const q = search.value.trim().toLowerCase();
    visible = products.filter(function (p) {
      const haystack = [p.title, p.product_id, p.category, p.formats, p.license, p.blurb].join(" ").toLowerCase();
      return (!q || haystack.includes(q)) && (!category.value || p.category === category.value) &&
        (!country.value || p.country_code === country.value);
    });
    page = 1; render();
  }
  function button(label, cls, handler) {
    const b = document.createElement("button"); b.type = "button"; b.className = cls;
    b.textContent = label; b.addEventListener("click", handler); return b;
  }
  function renderRow(p) {
    const row = document.createElement("tr");
    addCell(row, p.title, "product-name");
    addBadgeCell(row, p.category, "expensive-chip expensive-chip--category");
    const countryCell = document.createElement("td");
    const countryWrap = document.createElement("span");
    countryWrap.className = "expensive-country";
    const countryName = countryLabel(p.country_code);
    const countryCode = String(p.country_code || "").trim().toLowerCase();
    if (/^[a-z]{2}$/.test(countryCode)) {
      const flag = document.createElement("img");
      flag.className = "expensive-country__flag";
      flag.src = "https://flagcdn.com/w40/" + countryCode + ".png";
      flag.alt = countryName + " flag";
      flag.width = 20;
      flag.height = 15;
      flag.loading = "lazy";
      flag.decoding = "async";
      flag.addEventListener("error", function () { flag.remove(); }, { once: true });
      countryWrap.appendChild(flag);
    }
    const countryText = document.createElement("span");
    countryText.className = "expensive-country__name";
    countryText.textContent = countryName;
    countryWrap.appendChild(countryText);
    countryCell.appendChild(countryWrap);
    row.appendChild(countryCell);
    addBadgeCell(row, p.product_id, "expensive-chip expensive-chip--id");
    addBadgeCell(row, p.formats, "expensive-chip expensive-chip--format");
    addBadgeCell(row, p.license, "expensive-chip expensive-chip--licence");
    addBadgeCell(row, p.expDate, "expensive-chip expensive-chip--expiry");
    const refundCell = document.createElement("td");
    const refundBadge = document.createElement("span");
    const refundText = String(p.refund_period == null ? "" : p.refund_period).trim();
    const refundMatch = refundText.match(/^(\d+(?:\.\d+)?)\s*(?:days?)?$/i);
    if (refundMatch) {
      const refundDays = Number(refundMatch[1]);
      if (refundDays > 0) {
        refundBadge.className = "expensive-refund expensive-refund--yes";
        refundBadge.textContent = "✓ Refundable";
        refundBadge.setAttribute("aria-label", "Refundable for " + refundDays + " days");
      } else {
        refundBadge.className = "expensive-refund expensive-refund--no";
        refundBadge.textContent = "✕ Not refundable";
        refundBadge.setAttribute("aria-label", "Not refundable");
      }
    } else {
      refundBadge.className = "expensive-refund expensive-refund--unknown";
      refundBadge.textContent = "Not specified";
      refundBadge.setAttribute("aria-label", "Refund period not specified");
    }
    refundCell.appendChild(refundBadge);
    row.appendChild(refundCell);
    const price = Number(p.price);
    addCell(row, Number.isFinite(price) ? "$" + price.toFixed(2) : "—", "expensive-price is-numeric");
    const actions = document.createElement("td"); actions.className = "is-numeric";
    const actionGroup = document.createElement("div"); actionGroup.className = "expensive-actions";
    actionGroup.appendChild(button("Buy", "btn btn--primary", function () {
      window.location.href = "checkout.html?product=" + encodeURIComponent(p.id);
    }));
    actionGroup.appendChild(button("Add", "btn btn--wallet", function (event) {
      if (!window.NLExpensiveCart) { window.alert("Cart unavailable. Please refresh the page."); return; }
      try {
        window.NLExpensiveCart.add({ id: p.id, title: p.title });
        event.currentTarget.textContent = "Added"; event.currentTarget.disabled = true;
      } catch (err) { window.alert(err.message || "Could not add this product."); }
    }));
    actions.appendChild(actionGroup);
    row.appendChild(actions); return row;
  }
  function render() {
    const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    page = Math.min(page, pages);
    body.replaceChildren();
    visible.slice((page - 1) * PER_PAGE, page * PER_PAGE).forEach(p => body.appendChild(renderRow(p)));
    empty.hidden = visible.length > 0;
    pagination.hidden = visible.length <= PER_PAGE;
    pageInfo.textContent = "Page " + page + " of " + pages;
    prev.disabled = page === 1; next.disabled = page === pages;
  }
  async function load() {
    loading.hidden = false; errorBox.hidden = true; empty.hidden = true; body.replaceChildren();
    try {
      const response = await fetch("/api/expensive-products", { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load products.");
      products = Array.isArray(data.products) ? data.products : [];
      loading.hidden = true;
      if (!products.length) { empty.hidden = false; pagination.hidden = true; return; }
      setupFilters(); visible = products.slice(); render();
    } catch (err) {
      loading.hidden = true; errorBox.textContent = err.message || "Could not load products."; errorBox.hidden = false;
    }
  }
  search.addEventListener("input", filterProducts);
  category.addEventListener("change", filterProducts);
  country.addEventListener("change", filterProducts);
  prev.addEventListener("click", function () { if (page > 1) { page--; render(); } });
  next.addEventListener("click", function () { if (page < Math.ceil(visible.length / PER_PAGE)) { page++; render(); } });
  load();
})();
