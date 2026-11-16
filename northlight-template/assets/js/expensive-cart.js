(function () {
  "use strict";

  const KEY = "nl.expensive.cart.v1";

  function read() {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
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
        title: String(item.title || "Product"),
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
})();