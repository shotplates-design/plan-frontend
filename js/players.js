(function () {
  const searchEl = document.getElementById("search");
  const teamEl = document.getElementById("filterTeam");
  const posEl = document.getElementById("filterPos");
  const countEl = document.getElementById("resultCount");
  const cards = Array.from(document.querySelectorAll("[data-player-card]"));
  const rows = Array.from(document.querySelectorAll("#playerTable tbody tr"));
  if (!cards.length && !rows.length) return;

  function norm(s) {
    return (s || "").toString().toLowerCase().trim();
  }

  function match(el) {
    const q = norm(searchEl && searchEl.value);
    const team = teamEl ? teamEl.value : "";
    const pos = posEl ? posEl.value : "";
    const name = norm(el.dataset.name);
    const t = el.dataset.team || "";
    const p = el.dataset.position || "";
    return (!q || name.includes(q)) && (!team || t === team) && (!pos || p === pos);
  }

  function apply() {
    let shown = 0;
    cards.forEach((el) => {
      const ok = match(el);
      el.classList.toggle("is-hidden", !ok);
      if (ok) shown += 1;
    });
    rows.forEach((tr) => {
      const ok = match(tr);
      tr.classList.toggle("is-hidden", !ok);
      if (ok && !cards.length) shown += 1;
    });
    if (countEl) {
      countEl.textContent = String(cards.length ? shown : shown);
    }
  }

  [searchEl, teamEl, posEl].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  const tbody = document.querySelector("#playerTable tbody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-href]");
      if (!tr) return;
      if (e.target.closest("a")) return;
      window.location.href = tr.dataset.href;
    });
  }

  apply();
})();
