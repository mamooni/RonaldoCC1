(function () {
  "use strict";

  const KEY = "nl.expensive.cart.v1";

  function read() {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(items)) return [];
      return items.filter(function (item) {
        return item && /^\\d+$/.test(String(item.id || "")) && Number(item.id) > 0;
      }).map(function (item) {
        return {
          id: String(item.id),
          title: String(item.title || "Premium product"),
          quantity: Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)))
        };
      });
    } catch (error) {
      return [];
    }
  }

  function syncBadge() {
    const badge = document.getElementById("expensiveCartCount");
    if (!badge) return;
    const count = read().reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    syncBadge();
    return items;
  }

  function add(item) {
    if (!item || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0) {
      throw new Error("Invalid product.");
    }

    const id = String(item.id);
    const items = read();
    const existing = items.find(function (entry) {
      return entry.id === id;
    });

    if (existing) {
      existing.quantity = Math.min(20, existing.quantity + 1);
    } else {
      items.push({
        id: id,
        title: String(item.title || "Premium product"),
        quantity: 1
      });
    }

    return write(items);
  }

  function remove(id) {
    return write(read().filter(function (item) {
      return item.id !== String(id);
    }));
  }

  function clear() {
    return write([]);
  }

  window.NLExpensiveCart = {
    read: read,
    add: add,
    remove: remove,
    clear: clear
  };

  document.addEventListener("DOMContentLoaded", syncBadge);
})();