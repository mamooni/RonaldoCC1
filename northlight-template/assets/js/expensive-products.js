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
    const expiryDates = Array.from(new Set(products.map(p => String(p.expDate || "").trim()).filter(v => /^\\d{2}\\/\\d{4}$/.test(v))))
      .sort(function (a, b) {
        const [am, ay] = a.split("/").map(Number);
        const [bm, by] = b.split("/").map(Number);
        return ay - by || am - bm;
      });
    const formats = Array.from(new Map(products.flatMap(p => String(p.formats || "").split(/[,;|]/))
      .map(v => v.trim()).filter(Boolean).map(v => [v.toLowerCase(), v])).values()).sort(function (a, b) {
        return a.localeCompare(b);
      });
    category.replaceChildren(); option(category, "", "All categories");
    cats.forEach(v => option(category, v, v));
    country.replaceChildren(); option(country, "", "All countries");
    countries.forEach(v => option(country, v, countryLabel(v)));
    expiry.replaceChildren(); option(expiry, "", "All expiry dates");
    expiryDates.forEach(v => option(expiry, v, v));
    format.replaceChildren(); option(format, "", "All formats");
    formats.forEach(v => option(format, v.toLowerCase(), v));
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
  function filterProducts() {
    const q = search.value.trim().toLowerCase();
    const minimum = minPrice.value.trim() === "" ? null : Number(minPrice.value);
    const maximum = maxPrice.value.trim() === "" ? null : Number(maxPrice.value);
    visible = products.filter(function (p) {
      const haystack = [p.title, p.product_id, p.category, p.formats, p.license, p.blurb].join(" ").toLowerCase();
      const priceValue = p.price == null || String(p.price).trim() === "" ? NaN : Number(p.price);
      const status = refundStatus(p);
      return (!q || haystack.includes(q)) &&
        (!category.value || p.category === category.value) &&
        (!country.value || p.country_code === country.value) &&
        (minimum === null || (Number.isFinite(priceValue) && priceValue >= minimum)) &&
        (maximum === null || (Number.isFinite(priceValue) && priceValue <= maximum)) &&
        (!refund.value || (refund.value === "yes" ? status === true : status === false)) &&
        (!expiry.value || String(p.expDate || "").trim() === expiry.value) &&
        (!format.value || productFormats(p).includes(format.value));
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
    const pages = Math.max(1, Math.ceil(ordered.length / PER_PAGE));
    page = Math.min(page, pages);
    body.replaceChildren();
    const slice = ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
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
  sort.addEventListener("change", filterProducts);
  minPrice.addEventListener("input", filterProducts);
  maxPrice.addEventListener("input", filterProducts);
  refund.addEventListener("change", filterProducts);
  expiry.addEventListener("change", filterProducts);
  format.addEventListener("change", filterProducts);
  prev.addEventListener("click", function () { if (page > 1) { page--; render(); } });
  next.addEventListener("click", function () { if (page < Math.ceil(visible.length / PER_PAGE)) { page++; render(); } });
  load();
})();
