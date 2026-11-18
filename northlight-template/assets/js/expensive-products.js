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
  let products = [], visible = [], page = 1, total = 0, requestToken = 0;

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
  function setupFilters(facets) {
    const keep = { category: category.value, country: country.value, expiry: expiry.value, format: format.value };
    category.replaceChildren(); option(category, "", "All categories");
    (facets.categories || []).forEach(v => option(category, v, v));
    country.replaceChildren(); option(country, "", "All countries");
    (facets.countries || []).forEach(v => option(country, v, countryLabel(v)));
    expiry.replaceChildren(); option(expiry, "", "All expiry dates");
    (facets.expiries || []).forEach(v => option(expiry, v, v));
    format.replaceChildren(); option(format, "", "All formats");
    (facets.formats || []).forEach(v => option(format, v.toLowerCase(), v));
    if ([...category.options].some(o => o.value === keep.category)) category.value = keep.category;
    if ([...country.options].some(o => o.value === keep.country)) country.value = keep.country;
    if ([...expiry.options].some(o => o.value === keep.expiry)) expiry.value = keep.expiry;
    if ([...format.options].some(o => o.value === keep.format)) format.value = keep.format;
  }
  function refundStatus(product) {
    const value = String(product.refund_period == null ? "" : product.refund_period).trim();
    const match = value.match(/^(\\d+(?:\\.\\d+)?)\\s*(?:days?)?$/i);
    if (!match) return null;
    return Number(match[1]) > 0;
  }

  function productFormats(product) {
    return String(product.formats || "").split(/[,;|]/).map(function (value) {
      return value.trim().toLowerCase();
    }).filter(Boolean);
  }
  function dateKey(timestamp) {
    const date = new Date(Number(timestamp) * 1000);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  }
  function dateGroups() {
    const today = dateKey(Date.now() / 1000);
    const now = new Date();
    const weekday = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos", weekday: "short"
    }).format(now) === "Sun" ? 0 : new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos", weekday: "short"
    }).format(now) === "Mon" ? 1 : new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos", weekday: "short"
    }).format(now) === "Tue" ? 2 : new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos", weekday: "short"
    }).format(now) === "Wed" ? 3 : new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos", weekday: "short"
    }).format(now) === "Thu" ? 4 : new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos", weekday: "short"
    }).format(now) === "Fri" ? 5 : 6);
    const todayDate = new Date(today + "T12:00:00Z");
    const dayMs = 86400000;
    const yesterday = new Date(todayDate.getTime() - dayMs).toISOString().slice(0, 10);
    const weekStart = new Date(todayDate.getTime() - weekday * dayMs);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * dayMs);
    const monthStart = today.slice(0, 7) + "-01";
    const previousMonthDate = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1));
    const previousMonth = previousMonthDate.toISOString().slice(0, 7);
    return { today, yesterday, weekStart: weekStart.toISOString().slice(0, 10),
      lastWeekStart: lastWeekStart.toISOString().slice(0, 10), monthStart, previousMonth };
  }
  function groupFor(product, dates) {
    const key = dateKey(product.created_at);
    if (!key) return "Older products";
    if (key === dates.today) return "Today";
    if (key === dates.yesterday) return "Yesterday";
    if (key >= dates.weekStart) return "Earlier this week";
    if (key >= dates.lastWeekStart) return "Last week";
    if (key >= dates.monthStart) return "Earlier this month";
    if (key.slice(0, 7) === dates.previousMonth) return "Last month";
    return "Older products";
  }
  function filterProducts() { page = 1; load(); }

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
    const dates = dateGroups();
    const groupOrder = ["Today", "Yesterday", "Earlier this week", "Last week",
      "Earlier this month", "Last month", "Older products"];
    const grouped = new Map(groupOrder.map(name => [name, []]));
    visible.forEach(function (product) { grouped.get(groupFor(product, dates)).push(product); });
    if (sort.value !== "default") {
      grouped.forEach(function (items) {
        items.sort(function (a, b) {
          const av = Number(a.price), bv = Number(b.price);
          const aValid = a.price != null && String(a.price).trim() !== "" && Number.isFinite(av);
          const bValid = b.price != null && String(b.price).trim() !== "" && Number.isFinite(bv);
          if (aValid !== bValid) return aValid ? -1 : 1;
          if (!aValid) return 0;
          return sort.value === "low-high" ? av - bv : bv - av;
        });
      });
    }
    const ordered = [];
    groupOrder.forEach(name => grouped.get(name).forEach(product => ordered.push({ name, product })));
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    body.replaceChildren();
    const slice = ordered;
    let currentGroup = "";
    slice.forEach(function (entry) {
      if (entry.name !== currentGroup) {
        const heading = document.createElement("tr");
        heading.className = "expensive-date-group";
        const cell = document.createElement("th");
        cell.colSpan = 10;
        cell.scope = "rowgroup";
        cell.textContent = entry.name + " · " + grouped.get(entry.name).length + " product" +
          (grouped.get(entry.name).length === 1 ? "" : "s");
        heading.appendChild(cell);
        body.appendChild(heading);
        currentGroup = entry.name;
      }
      body.appendChild(renderRow(entry.product));
    });
    empty.hidden = total > 0;
    pagination.hidden = total <= PER_PAGE;
    pageInfo.textContent = "Page " + page + " of " + pages + " · " + total + " products";
    prev.disabled = page === 1; next.disabled = page >= pages;
  }
  async function load() {
    const token = ++requestToken;
    loading.hidden = false; errorBox.hidden = true; empty.hidden = true;
    const params = new URLSearchParams({
      page: String(page), per_page: String(PER_PAGE), q: search.value.trim(),
      category: category.value, country: country.value, sort: sort.value,
      min: minPrice.value.trim(), max: maxPrice.value.trim(), refund: refund.value,
      expiry: expiry.value, format: format.value
    });
    try {
      const response = await fetch("/api/expensive-products?" + params.toString(), { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load products.");
      if (token !== requestToken) return;
      products = Array.isArray(data.products) ? data.products : [];
      total = Number(data.total) || 0;
      visible = products.slice();
      setupFilters(data.facets || {});
      loading.hidden = true;
      render();
    } catch (err) {
      if (token !== requestToken) return;
      loading.hidden = true; errorBox.textContent = err.message || "Could not load products."; errorBox.hidden = false;
    }
  }
  let filterTimer;
  function queueFilter() { window.clearTimeout(filterTimer); filterTimer = window.setTimeout(filterProducts, 250); }
  search.addEventListener("input", queueFilter);
  minPrice.addEventListener("input", queueFilter);
  maxPrice.addEventListener("input", queueFilter);
  category.addEventListener("change", filterProducts);
  country.addEventListener("change", filterProducts);
  sort.addEventListener("change", filterProducts);
  refund.addEventListener("change", filterProducts);
  expiry.addEventListener("change", filterProducts);
  format.addEventListener("change", filterProducts);
  prev.addEventListener("click", function () { if (page > 1) { page--; load(); } });
  next.addEventListener("click", function () { if (page < Math.ceil(total / PER_PAGE)) { page++; load(); } });
  load();
})();
