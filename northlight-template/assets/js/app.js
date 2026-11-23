/* Northlight homepage legitimate-goods accordion.
   Keeps the original expandable feed presentation; all listing data comes
   from the public legitimate catalogue API. */
(() => {
  "use strict";

  const feed = document.getElementById("feed");
  const count = document.getElementById("dropCount");
  const loadMore = document.getElementById("loadMore");
  if (!feed || !count || !loadMore) return;

  const API = "/api/legitimate-products";
  const PAGE_DAYS = 3;
  let groups = [];
  let visibleGroups = 0;
  let rendered = 0;

  const clean = value => String(value ?? "").trim();
  const money = value => {
    const amount = Number(value);
    return Number.isFinite(amount) ? "$" + amount.toFixed(2) : "Price on request";
  };
  const refundText = value => {
    const days = Number(value ?? 0);
    if (days > 1) return days + " days";
    if (days === 1) return "1 day";
    if (days === 0) return "No refund period";
    return "Not specified";
  };
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
    head.appendChild(make("span", "drop__title", clean(product.name) || "Untitled product"));

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

    body.appendChild(specRow("Description", clean(product.description) || "No description provided."));
    body.appendChild(specRow("Seller", clean(product.seller) || "Not specified"));
    body.appendChild(specRow("Quality", clean(product.quality) || "Very High"));
    body.appendChild(specRow("Format", clean(product.format) || "Not specified"));
    body.appendChild(specRow("ID", clean(product.product_code) || "Not specified"));
    body.appendChild(specRow("ExpDate", clean(product.expiry) || "Not specified"));
    body.appendChild(specRow("Address", clean(product.address) || [product.market, product.state].map(clean).filter(Boolean).join(", ") || "Not specified"));
    body.appendChild(specRow("Refund period", refundText(product.refund_period), Number(product.refund_period) > 1 ? "specs__val--yes" : (Number(product.refund_period) === 0 ? "specs__val--no" : "")));
    body.appendChild(specRow("Price", money(product.price)));

    const actionRow = make("tr", "specs__actionRow");
    const actionCell = make("td");
    actionCell.colSpan = 2;
    const view = make("a", "btn btn--primary", "View Goods");
    view.href = "search.html";
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
    count.textContent = "Showing " + rendered + " of " + groups.reduce((sum, group) => sum + group.products.length, 0) + " goods";
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

  async function loadProducts() {
    count.textContent = "Loading goods…";
    loadMore.hidden = true;
    try {
      const response = await fetch(API, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Catalogue request failed");
      const payload = await response.json();
      const products = (Array.isArray(payload) ? payload : payload.products || [])
        .filter(product => product && product.status !== "draft");

      const byDate = new Map();
      products.forEach(product => {
        const key = dateKey(product.created_at);
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key).push(product);
      });

      groups = Array.from(byDate.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, items]) => ({
          title: dateHeading(key),
          date: key === "undated" ? "" : formatDate(items[0].created_at),
          products: items
        }));

      feed.replaceChildren();
      if (!groups.length) {
        feed.appendChild(make("p", "catalogue__empty", "No legitimate goods have been published yet."));
        count.textContent = "0 goods";
        return;
      }
      visibleGroups = 0;
      rendered = 0;
      renderNext();
    } catch (error) {
      feed.replaceChildren(make("p", "catalogue__empty", "The legitimate goods feed is temporarily unavailable."));
      count.textContent = "Unable to load goods";
    }
  }

  loadProducts();
})();