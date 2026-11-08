/* ==========================================================================
   Northlight storefront — menu.js
   Dropdown behaviour for every [data-menu] container: the account menu, the
   "Goods" / "Tools" / "Orders" tabs and anything else marked the same way.

   Shared by every page that has the top bar / red nav (index, deposit,
   messages), so the markup alone decides what becomes a menu.
   ========================================================================== */

(function () {
  "use strict";

  var openMenu = { button: null, panel: null };

  function closeMenu() {
    if (!openMenu.button) return;
    openMenu.button.setAttribute("aria-expanded", "false");
    openMenu.panel.hidden = true;
    openMenu.panel.style.marginRight = "";
    openMenu.button = null;
    openMenu.panel = null;
  }

  /* Wide panels (the account menu especially) can overhang a narrow screen.
     Nudge the panel back inside the viewport with a negative/positive right
     margin — geometry only, so it cannot fight the opening animation. */
  function keepInView(panel) {
    var MARGIN = 10;

    panel.style.marginRight = "";
    var rect = panel.getBoundingClientRect();
    var shift = 0;

    if (rect.left < MARGIN) {
      shift = MARGIN - rect.left; // move right
    } else if (rect.right > window.innerWidth - MARGIN) {
      shift = window.innerWidth - MARGIN - rect.right; // move left
    }

    panel.style.marginRight = shift ? -shift + "px" : "";
  }

  function toggleMenu(button, panel) {
    var isOpen = button === openMenu.button;
    closeMenu();
    if (isOpen) return;

    button.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    keepInView(panel);
    openMenu.button = button;
    openMenu.panel = panel;
  }

  var menus = document.querySelectorAll("[data-menu]");
  Array.prototype.forEach.call(menus, function (menuEl) {
    var button = menuEl.querySelector("[aria-expanded]");
    var panel = menuEl.querySelector(".menu__panel");
    if (!button || !panel) return;

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu(button, panel);
    });
  });

  document.addEventListener("click", function (event) {
    if (!openMenu.panel) return;

    // a click on one of the items closes the menu after it is followed
    if (event.target.closest(".menu__item, .acct__item")) {
      closeMenu();
      return;
    }
    if (!openMenu.panel.contains(event.target)) closeMenu();
  });

  /* Scrolling dismisses the menu. `capture` is on so a scroll inside any
     scrollable container (the results table, a dialog) closes it too, and the
     handler is passive because it never calls preventDefault. */
  function closeOnScroll() {
    if (openMenu.panel) closeMenu();
  }

  window.addEventListener("scroll", closeOnScroll, { passive: true, capture: true });
  window.addEventListener("resize", closeOnScroll, { passive: true });
  window.addEventListener("wheel", closeOnScroll, { passive: true });
  window.addEventListener("touchmove", closeOnScroll, { passive: true });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;

    if (openMenu.panel) {
      closeMenu();
      return;
    }

    // pages with the detail dialog get Escape-to-close for free
    var dialog = document.getElementById("dropDialog");
    if (dialog && dialog.open) dialog.close();
  });
})();
