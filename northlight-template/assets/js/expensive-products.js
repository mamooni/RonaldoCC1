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
  const sort = document.getElementById("expensiveSort");
  const minPrice = document.getElementById("expensiveMinPrice");
  const maxPrice = document.getElementById("expensiveMaxPrice");
  const refund = document.getElementById("expensiveRefund");
  const expiry = document.getElementById("expensiveExpiry");
  const format = document.getElementById("expensiveFormat");
  const PER_PAGE = 20;
  let products = [], page = 1, visible = [];

  const clean = value => String(value == null ? "" : value).trim();
  const monthOrder = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

  function productNameDate(name) {
    const value = clean(name);
    const match = value.match(/^(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\b|[-_\s])/i)
      || value.match(/^(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
    if (!match) return null;
    const day = Number(match[1]);
    const month = monthOrder[match[2].slice(0, 3).toLowerCase()];
    return day >= 1 && day <= 31 && month ? month * 32 + day : null;
  }

  function countryName(code) {
    const found = (window.NL_COUNTRIES || []).find(item => item.code === clean(code).toUpperCase());
    return found ? found.name : clean(code);
  }

  function countryFlag(code) {
    const value = clean(code).toUpperCase();
    if (!/^[A-Z]{2}$/.test(value)) return "";
    return String.fromCodePoint(...Array.from(value, char => 127397 + char.charCodeAt(0)));
  }

  function addCell(row, value, cls) {
    const cell = document.createElement("td");
    cell.textContent = value == null || value === "" ? "—" : String(value);
    if (cls) cell.className = cls;
    row.appendChild(cell);
    return cell;
  }

  function addBadgeCell(row, value, cls) {
    const cell = document.createElement("td");
    if (value == null || value === "") {
      cell.textContent = "—";
    } else {
      const badge = document.createElement("span");
      badge.className = cls || "";
      badge.textContent = String(value);
      cell.appendChild(badge);
    }
    row.appendChild(cell);
    return cell;
  }

  function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function setupFilters() {
    const keepCountry = country.value;
    const keepExpiry = expiry.value;
    const keepFormat = format.value;

    category.replaceChildren();
    addOption(category, "", "All categories");

    country.replaceChildren();
    addOption(country, "", "All countries");
    [...new Set(products.map(product => clean(product.intended_country).toUpperCase()).filter(Boolean))]
      .sort()
      .forEach(code => addOption(country, code, countryName(code)));

    expiry.replaceChildren();
    addOption(expiry, "", "All expiry dates");
    [...new Set(products.map(product => clean(product.expiry)).filter(Boolean))]
      .sort()
      .forEach(value => addOption(expiry, value, value));

    format.replaceChildren();
    addOption(format, "", "All formats");
    [...new Set(products.map(product => clean(product.format)).filter(Boolean))]
      .sort()
      .forEach(value => addOption(format, value.toLowerCase(), value));

    if ([...country.options].some(option => option.value === keepCountry)) country.value = keepCountry;
    if ([...expiry.options].some(option => option.value === keepExpiry)) expiry.value = keepExpiry;
    if ([...format.options].some(option => option.value === keepFormat)) format.value = keepFormat;
  }

  function sortByProductDate(list) {
    list.sort((a, b) => {
      const dateA = productNameDate(a.name);
      const dateB = productNameDate(b.name);
      if (dateA !== null && dateB !== null && dateA !== dateB) return dateB - dateA;
      if (dateA !== null && dateB === null) return -1;
      if (dateB !== null && dateA === null) return 1;
      const createdA = Date.parse(a.created_at || "") || 0;
      const createdB = Date.parse(b.created_at || "") || 0;
      return createdB - createdA || Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  }

  function filteredProducts() {
    const query = clean(search.value).toLowerCase();
    const selectedCountry = country.value;
    const selectedFormat = format.value;
    const selectedExpiry = expiry.value;
    const min = minPrice.value.trim() === "" ? null : Number(minPrice.value);
    const max = maxPrice.value.trim() === "" ? null : Number(maxPrice.value);

    let list = products.filter(product => {
      const searchable = [product.name, product.seller, product.product_code].map(value => clean(value).toLowerCase()).join(" ");
      const price = Number(product.price);
      const refundDays = Number(product.refund_period || 0);
      return (!query || searchable.includes(query))
        && (!selectedCountry || clean(product.intended_country).toUpperCase() === selectedCountry)
        && (!selectedFormat || clean(product.format).toLowerCase() === selectedFormat)
        && (!selectedExpiry || clean(product.expiry) === selectedExpiry)
        && (min === null || (Number.isFinite(price) && price >= min))
        && (max === null || (Number.isFinite(price) && price <= max))
        && (!refund.value || (refund.value === "yes" ? refundDays > 0 : refundDays <= 0));
    });

    if (sort.value === "low-high") list.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort.value === "high-low") list.sort((a, b) => Number(b.price) - Number(a.price));
    else sortByProductDate(list);

    return list;
  }

  function renderRow(product) {
    const row = document.createElement("tr");
    addCell(row, product.name, "product-name");
    addCell(row, product.seller);
    const countryCell = document.createElement("td");
    const flag = countryFlag(product.intended_country);
    if (flag) {
      const flagSpan = document.createElement("span");
      flagSpan.className = "country-flag";
      flagSpan.setAttribute("aria-hidden", "true");
      flagSpan.textContent = flag;
      countryCell.appendChild(flagSpan);
      countryCell.appendChild(document.createTextNode(" "));
    }
    countryCell.appendChild(document.createTextNode([product.market, product.state].filter(Boolean).join(", ") || countryName(product.intended_country) || "—"));
    row.appendChild(countryCell);
    const idCell = document.createElement("td");
    const idStack = document.createElement("div");
    idStack.className = "expensive-id-stack";
    const idBadge = document.createElement("span");
    idBadge.className = "expensive-chip expensive-chip--id";
    idBadge.textContent = product.product_code == null || product.product_code === "" ? "—" : String(product.product_code);
    idStack.appendChild(idBadge);
    const idPrefix = String(product.product_code || "").trim().charAt(0);
    if (["3", "4", "5"].includes(idPrefix)) {
      const logo = document.createElement("img");
      logo.className = "expensive-id-logo expensive-id-logo--" + idPrefix;
      logo.src = "assets/images/business-card-" + idPrefix + ".svg";
      logo.alt = "";
      logo.setAttribute("aria-hidden", "true");
      logo.loading = "lazy";
      logo.onerror = function () { this.hidden = true; };
      idStack.appendChild(logo);
    }
    idCell.appendChild(idStack);
    row.appendChild(idCell);
    addBadgeCell(row, product.format, "expensive-chip expensive-chip--format");
    addCell(row, product.quality || "Very High");
    addBadgeCell(row, product.expiry, "expensive-chip expensive-chip--expiry");

    const refundCell = document.createElement("td");
    const refundDays = Number(product.refund_period || 0);
    const refundBadge = document.createElement("span");
    if (refundDays > 0) {
      refundBadge.className = "expensive-refund expensive-refund--yes";
      refundBadge.textContent = refundDays + (refundDays === 1 ? " day" : " days");
    } else {
      refundBadge.className = "expensive-refund expensive-refund--no";
      refundBadge.textContent = "Not refundable";
    }
    refundCell.appendChild(refundBadge);
    row.appendChild(refundCell);

    const price = Number(product.price);
    addCell(row, Number.isFinite(price) ? "$" + price.toFixed(2) : "—", "expensive-price is-numeric");

    const actions = document.createElement("td");
    actions.className = "is-numeric";
    const actionGroup = document.createElement("div");
    actionGroup.className = "expensive-actions";

    actionGroup.appendChild(makeButton("Buy", "btn btn--primary", function () {
      if (!product.id) return;
      window.location.href = "legitimate-checkout.html?product=" + encodeURIComponent(product.id);
    }));

    actionGroup.appendChild(makeButton("Add", "btn btn--wallet", function (event) {
      if (!window.NLLegitCart) {
        window.alert("Cart unavailable. Please refresh the page.");
        return;
      }
      window.NLLegitCart.add({ key: String(product.id), title: product.name, price: product.price });
      event.currentTarget.textContent = "Added";
      event.currentTarget.disabled = true;
    }));

    actions.appendChild(actionGroup);
    row.appendChild(actions);
    return row;
  }

  function makeButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function render() {
    const list = filteredProducts();
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(page, pages);
    visible = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    body.replaceChildren();
    visible.forEach(product => body.appendChild(renderRow(product)));

    empty.hidden = total > 0;
    pagination.hidden = total <= PER_PAGE;
    pageInfo.textContent = "Page " + page + " of " + pages + " · " + total + " products";
    prev.disabled = page === 1;
    next.disabled = page >= pages;
  }

  async function load() {
    loading.hidden = false;
    errorBox.hidden = true;
    empty.hidden = true;
    try {
      const response = await fetch("/api/legitimate-products", {
        headers: { Accept: "application/json" }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load products.");
      products = (Array.isArray(data.products) ? data.products : [])
        .filter(product => product && product.status !== "draft");
      setupFilters();
      loading.hidden = true;
      render();
    } catch (error) {
      loading.hidden = true;
      errorBox.textContent = error.message || "Could not load legitimate products.";
      errorBox.hidden = false;
    }
  }

  let filterTimer;
  function queueRender() {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(function () { page = 1; render(); }, 200);
  }

  [search, minPrice, maxPrice].forEach(input => input.addEventListener("input", queueRender));
  [category, country, sort, refund, expiry, format].forEach(select => select.addEventListener("change", function () { page = 1; render(); }));
  prev.addEventListener("click", function () { if (page > 1) { page--; render(); } });
  next.addEventListener("click", function () { page++; render(); });

  load();
})();
