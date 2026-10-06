(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".cat-tab[data-tab]"));
  var valid = tabs.map(function (t) { return t.dataset.tab; });

  function centerLadders(scope) {
    (scope || document).querySelectorAll("[data-ladder]").forEach(function (ladder) {
      var a = ladder.querySelector(".is-anchor");
      if (!a || !ladder.clientWidth) return;
      ladder.scrollLeft = Math.max(0, a.offsetLeft - ladder.offsetLeft - (ladder.clientWidth - a.offsetWidth) / 2);
    });
  }

  function activate(id, push) {
    if (valid.indexOf(id) === -1) id = valid[0];
    tabs.forEach(function (t) {
      var on = t.dataset.tab === id;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      var panel = document.getElementById("panel-" + t.dataset.tab);
      if (panel) panel.hidden = !on;
      if (on && t.scrollIntoView) {
        var bar = t.parentElement;
        bar.scrollLeft = Math.max(0, t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2);
      }
    });
    if (push && history.replaceState) history.replaceState(null, "", "#" + id);
    centerLadders(document.getElementById("panel-" + id));
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { activate(t.dataset.tab, true); });
  });

  document.querySelectorAll("[data-view-more]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var market = btn.closest(".market");
      var on = !market.classList.contains("is-expanded");
      market.classList.toggle("is-expanded", on);
      btn.textContent = on ? btn.dataset.lessLabel : btn.dataset.moreLabel;
      if (on) centerLadders(market);
    });
  });

  document.querySelectorAll("details.market").forEach(function (d) {
    d.addEventListener("toggle", function () { if (d.open) centerLadders(d); });
  });

  window.addEventListener("hashchange", function () { activate(location.hash.slice(1), false); });
  activate((location.hash || "").slice(1), false);
})();
