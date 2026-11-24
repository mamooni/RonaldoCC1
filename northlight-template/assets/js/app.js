/* Northlight homepage combined product accordion.
   Legitimate and expensive catalogue products share one newest-first feed. */
(() => {
  "use strict";

  const feed = document.getElementById("feed");
  const count = document.getElementById("dropCount");
  const loadMore = document.getElementById("loadMore");
  if (!feed || !count || !loadMore) return;

  const LEGITIMATE_API = "/api/legitimate-products";
  const EXPENSIVE_API = "/api/expensive-products";
  const PAGE_DAYS = 3;
  let groups = [];
  let visibleGroups = 0;
  let rendered = 0;
  let loadWarning = "";

  const clean = value => String(value ?? "").trim();
  const monthOrder = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function productNameDate(name) {
    const value = clean(name);
    const match = value.match(/^(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\b|[-_\s])/i)
      || value.match(/^(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
    if (!match) return null;
    const day = Number(match[1]);
    const month = monthOrder[match[2].slice(0, 3).toLowerCase()];
    return day >= 1 && day <= 31 && month
      ? { rank: month * 32 + day, label: day + " " + match[2].slice(0, 3) }
      : null;
  }

  const money = value => {
    const amount = Number(value);
    return Number.isFinite(amount) ? "$" + amount.toFixed(2) : "Price on request";
  };

  function isRefundable(value) {
    if (typeof value === "number" || /^\s*\d+(?:\.\d+)?\s*$/.test(String(value ?? ""))) {
      return Number(value) > 0;
    }
    const text = clean(value).toLowerCase();
    if (!text || /\b(no|not|non|without|none)\b/.test(text)) return false;
    return /\b(yes|refundable|\d+\s*(day|days|week|weeks|month|months))\b/.test(text);
  }

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function specRow(label, value, modifier) {
    const row = make("tr");
    row.appendChild(make("td", "specs__key", label));
    row.appendChild(make("td", "specs__val" + (modifier ? " " + modifier : ""), value));
    return row;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function dateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "undated";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function dateHeading(key) {
    if (key === "undated") return "Recently Added";
    const today = dateKey(new Date());
    const yesterday = dateKey(Date.now() - 86400000);
    if (key === today) return "Today";
    if (key === yesterday) return "Yesterday";
    const parts = key.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      weekday: "long"
    }).format(date);
  }

  function countryName(code) {
    const value = clean(code).toUpperCase();
    if (!/^[A-Z]{2}$/.test(value)) return clean(code) || "Not specified";
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(value) || value;
    } catch (_) {
      return value;
    }
  }

  function countryFlag(code) {
    const value = clean(code).toUpperCase();
    return /^[A-Z]{2}$/.test(value)
      ? String.fromCodePoint(...Array.from(value, char => 127397 + char.charCodeAt(0)))
      : "";
  }

  function buildDrop(product, index) {
    const article = make("article", "drop");
    article.dataset.index = String(index);

    const panelId = "goods-panel-" + index;
    const headId = "goods-head-" + index;

    const head = make("button", "drop__head");
    head.type = "button";
    head.id = headId;
    head.setAttribute("aria-expanded", "false");
    head.setAttribute("aria-controls", panelId);

    const heading = make("span", "drop__heading");
    heading.appendChild(make("span", "drop__title", clean(product.name) || "Untitled product"));

    const from = make("span", "drop__from");
    from.appendChild(document.createTextNode("From "));
    from.appendChild(make("b", "", clean(product.seller) || "Unknown seller"));
    heading.appendChild(from);
    head.appendChild(heading);

    const chevron = make("span", "chevron");
    chevron.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 16.4 5.6 8.6h12.8z"/></svg>';
    head.appendChild(chevron);

    const panel = make("div", "drop__panel");
    panel.id = panelId;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", headId);

    const inner = make("div", "drop__panelInner");
    const content = make("div", "drop__content");
    const table = make("table", "specs specs--boxed");
    const body = make("tbody");

    const countryCode = clean(product.intended_country).toUpperCase();
    const flag = countryFlag(countryCode);
    const country = clean(product.market) || countryName(countryCode);
    body.appendChild(specRow("Country", (flag ? flag + "  " : "") + country));
    body.appendChild(specRow("Description", clean(product.description) || "No description provided."));

    const refundable = isRefundable(product.refund_period);
    body.appendChild(specRow(
      "Refundable",
      refundable ? "Yes" : "No",
      refundable ? "specs__val--yes" : "specs__val--no"
    ));

    const actionRow = make("tr", "specs__actionRow");
    const actionCell = make("td");
    actionCell.colSpan = 2;
    const isExpensive = product.catalogueType === "expensive";
    const view = make("a", "btn btn--primary", isExpensive ? "View expensive" : "View Goods");
    view.href = isExpensive ? "expensive.html" : "search.html";
    actionCell.appendChild(view);
    actionRow.appendChild(actionCell);
    body.appendChild(actionRow);

    table.appendChild(body);
    content.appendChild(table);
    inner.appendChild(content);
    panel.appendChild(inner);
    article.appendChild(head);
    article.appendChild(panel);

    head.addEventListener("click", () => {
      const open = article.classList.toggle("is-open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
    return article;
  }

  function updateChrome() {
    const total = groups.reduce((sum, group) => sum + group.products.length, 0);
    count.textContent = "Showing " + rendered + " of " + total + " goods" + (loadWarning ? " · " + loadWarning : "");
    const done = visibleGroups >= groups.length;
    loadMore.hidden = done;
    if (done && groups.length) loadMore.textContent = "All goods loaded";
  }

  function renderNext() {
    const next = groups.slice(visibleGroups, visibleGroups + PAGE_DAYS);
    next.forEach(group => {
      const section = make("section", "day");
      const heading = make("header", "day__head");
      heading.appendChild(make("h3", "day__title", group.title));
      heading.appendChild(make("span", "day__date", group.date));
      heading.appendChild(make("span", "day__count", group.products.length + (group.products.length === 1 ? " good" : " goods")));
      const list = make("div", "day__list");
      group.products.forEach(product => list.appendChild(buildDrop(product, rendered++)));
      section.appendChild(heading);
      section.appendChild(list);
      feed.appendChild(section);
    });
    visibleGroups += next.length;
    updateChrome();
  }

  loadMore.addEventListener("click", renderNext);

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Catalogue request failed");
    return payload;
  }

  async function fetchExpensiveProducts() {
    const pageSize = 100;
    const first = await fetchJson(EXPENSIVE_API + "?page=1&per_page=" + pageSize);
    const firstProducts = Array.isArray(first.products) ? first.products : [];
    const total = Number(first.total) || firstProducts.length;
    const pageCount = Math.ceil(total / pageSize);
    const remaining = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
        fetchJson(EXPENSIVE_API + "?page=" + (index + 2) + "&per_page=" + pageSize)
      )
    );
    const all = firstProducts.concat(...remaining.map(result => Array.isArray(result.products) ? result.products : []));
    return all.map(product => {
      const timestamp = Number(product.created_at);
      const createdAt = Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000).toISOString()
        : product.created_at;
      return {
        ...product,
        name: product.title,
        seller: product.creator,
        description: product.blurb,
        intended_country: product.country_code,
        market: countryName(product.country_code),
        created_at: createdAt,
        catalogueType: "expensive"
      };
    });
  }

  async function loadProducts() {
    count.textContent = "Loading goods…";
    loadMore.hidden = true;

    const results = await Promise.allSettled([
      fetchJson(LEGITIMATE_API),
      fetchExpensiveProducts()
    ]);

    const legitimateResult = results[0];
    const expensiveResult = results[1];
    const legitimate = legitimateResult.status === "fulfilled"
      ? (Array.isArray(legitimateResult.value.products) ? legitimateResult.value.products : [])
          .filter(product => product && product.status !== "draft")
          .map(product => ({ ...product, catalogueType: "legitimate" }))
      : [];
    const expensive = expensiveResult.status === "fulfilled" ? expensiveResult.value : [];

    if (legitimateResult.status === "rejected" && expensiveResult.status === "rejected") {
      feed.replaceChildren(make("p", "catalogue__empty", "The goods feed is temporarily unavailable."));
      count.textContent = "Unable to load goods";
      return;
    }

    if (legitimateResult.status === "rejected") loadWarning = "Legitimate catalogue unavailable";
    else if (expensiveResult.status === "rejected") loadWarning = "Expensive catalogue unavailable";

    const products = legitimate.concat(expensive);
    products.sort((a, b) => {
      const nameDateA = productNameDate(a.name);
      const nameDateB = productNameDate(b.name);
      if (nameDateA && nameDateB && nameDateA.rank !== nameDateB.rank) return nameDateB.rank - nameDateA.rank;
      if (nameDateA && !nameDateB) return -1;
      if (nameDateB && !nameDateA) return 1;
      const timeDiff = (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
      return timeDiff || Number(b.id || 0) - Number(a.id || 0);
    });

    const byDate = new Map();
    products.forEach(product => {
      const namedDate = productNameDate(product.name);
      const key = namedDate ? "named-" + namedDate.rank : "created-" + dateKey(product.created_at);
      if (!byDate.has(key)) {
        byDate.set(key, {
          title: namedDate ? namedDate.label : dateHeading(dateKey(product.created_at)),
          date: namedDate ? "" : (dateKey(product.created_at) === "undated" ? "" : formatDate(product.created_at)),
          products: []
        });
      }
      byDate.get(key).products.push(product);
    });

    groups = Array.from(byDate.entries())
      .sort((a, b) => {
        const aNamed = a[0].startsWith("named-");
        const bNamed = b[0].startsWith("named-");
        if (aNamed && bNamed) return Number(b[0].slice(6)) - Number(a[0].slice(6));
        if (aNamed) return -1;
        if (bNamed) return 1;
        return b[0].slice(8).localeCompare(a[0].slice(8));
      })
      .map(([, group]) => group);

    feed.replaceChildren();
    if (!groups.length) {
      feed.appendChild(make("p", "catalogue__empty", "No products have been published yet."));
      count.textContent = "0 goods" + (loadWarning ? " · " + loadWarning : "");
      return;
    }
    visibleGroups = 0;
    rendered = 0;
    renderNext();
  }

  loadProducts();
})();