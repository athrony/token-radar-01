(() => {
  "use strict";
  const data = window.RADAR;
  const main = document.getElementById("main");
  if (!data || !Array.isArray(data.rows)) {
    main.innerHTML = '<section class="empty"><h1>The snapshot is missing.</h1><p>Run main.ts and open the generated dashboard beside data.js.</p></section>';
    return;
  }

  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  const money = (value) => "$" + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const dollars = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  const ratio = (value) => value.toFixed(2) + "×";
  const percent = (value) => value === null ? "Unreported" : (value >= 0 ? "+" : "−") + Math.abs(value).toFixed(1) + "%";
  const changeClass = (value) => value === null ? "muted" : value >= 0 ? "positive" : "negative";
  const initials = (name) => name.split(/[\s-]+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const avatar = (row) => `<span class="avatar" aria-hidden="true">${escape(initials(row.name))}</span>`;
  const date = new Date(data.as_of + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const state = { query: "", chain: "", category: "", floor: "", width: "", scope: "all", sort: "implied_value_usd", direction: -1, page: 1 };
  const pageSize = 20;
  const widthOptions = ["100", "150", "200", "400"];
  const sortOptions = [
    ["implied_value_usd", -1, "Base value · highest"],
    ["implied_value_usd", 1, "Base value · lowest"],
    ["band_width_pct", 1, "Band width · tightest"],
    ["band_width_pct", -1, "Band width · widest"],
    ["tvl_usd", -1, "TVL · highest"],
    ["tvl_usd", 1, "TVL · lowest"],
    ["change_7d", -1, "7d TVL · strongest"],
    ["change_7d", 1, "7d TVL · weakest"],
    ["name", 1, "Protocol · A to Z"],
    ["name", -1, "Protocol · Z to A"],
    ["age_days", -1, "Tracking age · oldest"],
    ["age_days", 1, "Tracking age · newest"],
  ];
  let boardHash = "#board";
  let lastView = "";
  document.getElementById("nav-count").textContent = data.rows.length;
  document.getElementById("top-date").textContent = date;
  document.getElementById("top-date").dateTime = data.as_of;
  document.getElementById("footer-date").textContent = date;

  function valuationBand(row) {
    return `<div class="value-band" aria-label="Low ${dollars(row.low_usd)}, base ${dollars(row.implied_value_usd)}, high ${dollars(row.high_usd)}">
      <div class="band-point low"><small>Low</small><strong title="${dollars(row.low_usd)}">${money(row.low_usd)}</strong></div>
      <div class="band-point base"><small>Base</small><strong title="${dollars(row.implied_value_usd)}">${money(row.implied_value_usd)}</strong></div>
      <div class="band-point high"><small>High</small><strong title="${dollars(row.high_usd)}">${money(row.high_usd)}</strong></div>
    </div>`;
  }

  function options(values, label) {
    return `<option value="">${label}</option>` + [...new Set(values)].sort().map((value) => `<option value="${escape(value)}">${escape(value)}</option>`).join("");
  }

  function parseFilters() {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    state.query = params.get("q") || "";
    state.chain = params.get("chain") || "";
    state.category = params.get("category") || "";
    state.width = widthOptions.includes(params.get("width")) ? params.get("width") : "";
    state.floor = ["50000000", "100000000", "500000000"].includes(params.get("floor")) ? params.get("floor") : "";
    state.scope = ["watchlist", "extended"].includes(params.get("scope")) ? params.get("scope") : "all";
    state.sort = sortOptions.some(([key]) => key === params.get("sort")) ? params.get("sort") : "implied_value_usd";
    state.direction = params.get("direction") === "1" ? 1 : -1;
    state.page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  }

  function saveFilters() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: state.query, chain: state.chain, category: state.category, floor: state.floor, width: state.width })) {
      if (value) params.set(key, value);
    }
    if (state.scope !== "all") params.set("scope", state.scope);
    if (state.sort !== "implied_value_usd") params.set("sort", state.sort);
    if (state.direction !== -1) params.set("direction", String(state.direction));
    if (state.page > 1) params.set("page", String(state.page));
    boardHash = "#board" + (params.size ? "?" + params.toString() : "");
    history.replaceState(null, "", boardHash);
    document.getElementById("nav-board").href = boardHash;
  }

  function filteredRows(ignoreWidth = false) {
    const query = state.query.trim().toLowerCase();
    return data.rows.filter((row) =>
      (!query || [row.name, row.slug, row.category, ...row.chains].join(" ").toLowerCase().includes(query)) &&
      (!state.chain || row.chains.includes(state.chain)) &&
      (!state.category || (row.category || "Uncategorized") === state.category) &&
      (!state.floor || row.tvl_usd >= Number(state.floor)) &&
      (ignoreWidth || !state.width || row.band_width_pct <= Number(state.width)) &&
      (state.scope !== "watchlist" || row.watchlist) &&
      (state.scope !== "extended" || !row.watchlist),
    ).sort((left, right) => {
      const leftValue = left[state.sort];
      const rightValue = right[state.sort];
      if (leftValue === null && rightValue === null) return left.rank - right.rank;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      const compared = typeof leftValue === "string" ? leftValue.localeCompare(rightValue, "en") : leftValue - rightValue;
      return compared * state.direction || left.rank - right.rank;
    });
  }

  function board() {
    const pooledCount = data.rows.filter((row) => row.comparison_source === "pooled").length;
    main.innerHTML = `
      <header class="page-heading">
        <div><div class="eyebrow">Sealed protocol intelligence · ${escape(date)}</div><h1>Token launch research</h1><p>Compare implied value, peer dispersion and participation routes across protocols that record no token.</p></div>
        <a class="text-link" href="#method">Read the valuation model ↗</a>
      </header>
      <dl class="summary-grid" aria-label="Dataset coverage">
        <div><dt>Candidates from ${data.universe} records</dt><dd>${data.rows.length}</dd></div>
        <div><dt>Watchlist coverage</dt><dd>${data.watchlist_count} / ${data.watchlist_count}</dd></div>
        <div><dt>Priced valuation peers</dt><dd>${data.peer_count}</dd></div>
        <div><dt>Without category peers</dt><dd>${pooledCount}</dd></div>
      </dl>
      <section class="uncertainty-panel" aria-labelledby="uncertainty-heading">
        <div class="uncertainty-intro"><h2 id="uncertainty-heading">How wide a band will you research?</h2><p>Width = (high − low) / base. Set a maximum or surface tighter bands first.</p></div>
        <div class="uncertainty-controls">
          <div class="field"><label for="width">Maximum band width</label><select id="width"><option value="">Any width</option>${widthOptions.map((value) => `<option value="${value}">≤ ${value}% of base</option>`).join("")}</select></div>
          <button class="band-sort" id="tightest-bands" type="button" aria-pressed="false">Tightest bands first ↑</button>
          <div class="width-presets" role="group" aria-label="Band width quick filters">${["", "150", "200", "400"].map((value) => `<button type="button" class="width-preset" data-width="${value}" aria-pressed="false">${value ? "≤ " + value + "%" : "All widths"}<span data-width-count="${value}"></span></button>`).join("")}</div>
        </div>
      </section>
      <section aria-labelledby="board-heading">
        <div class="research-controls">
          <div class="control-heading"><h2 id="board-heading">The research board</h2><div class="scope-tabs" role="group" aria-label="Candidate scope"><button data-scope="all">All candidates <span>${data.rows.length}</span></button><button data-scope="watchlist">Watchlist <span>${data.watchlist_count}</span></button><button data-scope="extended">Extended <span>${data.rows.length - data.watchlist_count}</span></button></div></div>
          <div class="filter-grid">
            <div class="field"><label for="search">Search protocols</label><input id="search" type="search" placeholder="Name, category or chain…" autocomplete="off" /></div>
            <div class="field"><label for="chain">Network</label><select id="chain">${options(data.rows.flatMap((row) => row.chains), "All networks")}</select></div>
            <div class="field"><label for="category">Category</label><select id="category">${options(data.rows.map((row) => row.category || "Uncategorized"), "All categories")}</select></div>
            <div class="field"><label for="floor">Minimum TVL</label><select id="floor"><option value="">Any size</option><option value="50000000">$50M+</option><option value="100000000">$100M+</option><option value="500000000">$500M+</option></select></div>
            <button id="reset" class="reset-button" type="button">Reset filters</button>
          </div>
          <div class="board-tools"><div id="result-count" role="status" aria-live="polite"></div><label class="sort-control" for="sort">Order by<select id="sort">${sortOptions.map(([key, direction, label]) => `<option value="${key}:${direction}">${label}</option>`).join("")}</select></label></div>
          <div id="chips" class="filter-chips" aria-label="Active filters"></div>
        </div>
        <div class="table-frame"><div class="table-scroll"><table class="research-table" role="table" aria-label="Protocol value ranking">
          <thead role="rowgroup"><tr role="row">
            <th class="rank-cell" scope="col">Rank</th><th scope="col" data-heading="name"><button data-sort="name">Protocol <span></span></button></th>
            <th scope="col">Category / networks</th><th scope="col" data-heading="tvl_usd"><button data-sort="tvl_usd">TVL / 7d <span></span></button></th>
            <th scope="col" data-heading="implied_value_usd"><button data-sort="implied_value_usd">Implied launch value · USD <span></span></button></th>
            <th scope="col" data-heading="band_width_pct"><button data-sort="band_width_pct">Band width <span></span></button></th><th scope="col">Participation</th>
          </tr></thead><tbody id="board-rows" role="rowgroup"></tbody>
        </table></div><div id="table-footer" class="table-footer"></div></div>
        <p class="board-note">Low / high use peer quartiles with base adjustments. Width meters span 0–500%. Global ranks use base. Narrow bands can have sparse evidence or unclear rights.</p>
      </section>`;
    updateBoard();
  }

  function boardRow(row) {
    const network = state.chain || row.chains[0] || "Unreported";
    return `<tr role="row">
      <td role="cell" class="rank-cell" aria-label="Global rank ${row.rank}">${String(row.rank).padStart(2, "0")}</td>
      <td role="cell" class="protocol-cell"><div class="protocol-wrap">${avatar(row)}<div><a class="protocol-name" href="#protocol/${encodeURIComponent(row.slug)}">${escape(row.name)}</a><span class="protocol-meta">${row.watchlist ? '<span class="watch-dot">●</span>Watchlist' : "Extended"} · ${escape(row.confidence.toLowerCase())} confidence</span></div></div></td>
      <td role="cell" class="context-cell"><span class="category-tag">${escape(row.category || "Uncategorized")}</span><span class="chain-list" title="${escape(row.chains.join(", "))}">${escape(network)}${row.chains.length > 1 ? " +" + (row.chains.length - 1) : ""}</span></td>
      <td role="cell" class="metric-cell"><span class="sr-only">TVL </span><span title="${dollars(row.tvl_usd)}">${money(row.tvl_usd)}</span><small class="${changeClass(row.change_7d)}">${percent(row.change_7d)} <span class="muted">7d</span></small></td>
      <td role="cell" class="value-cell">${valuationBand(row)}</td>
      <td role="cell" class="width-cell"><div class="width-number">${row.band_width_pct.toFixed(1)}%</div><small>of base value</small><div class="dispersion-meter" aria-hidden="true"><span style="width:${Math.min(100, row.band_width_pct / 5)}%"></span></div></td>
      <td role="cell" class="route-cell">${escape(row.access)}<br><a class="open-row" href="#protocol/${encodeURIComponent(row.slug)}" aria-label="View ${escape(row.name)} evidence and plan">Research ↗</a></td>
    </tr>`;
  }

  function updateBoard() {
    const rows = filteredRows();
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * pageSize;
    document.getElementById("result-count").textContent = `${rows.length} ${rows.length === 1 ? "protocol" : "protocols"} shown · ${state.scope === "all" ? "full radar" : state.scope + " scope"}`;
    for (const [id, value] of Object.entries({ search: state.query, chain: state.chain, category: state.category, floor: state.floor, width: state.width, sort: state.sort + ":" + state.direction })) {
      const control = document.getElementById(id);
      if (control.value !== value) control.value = value;
    }
    const chips = [
      state.query && ["query", "Search “" + state.query + "”"],
      state.chain && ["chain", state.chain],
      state.category && ["category", state.category],
      state.floor && ["floor", money(Number(state.floor)) + "+ TVL"],
      state.width && ["width", "Band width ≤ " + state.width + "%"],
    ].filter(Boolean);
    document.getElementById("chips").innerHTML = chips.map(([key, label]) => `<button class="filter-chip" data-clear="${key}" aria-label="Remove ${escape(label)} filter">${escape(label)} ×</button>`).join("");
    document.getElementById("tightest-bands").setAttribute("aria-pressed", String(state.sort === "band_width_pct" && state.direction === 1));
    const withoutWidth = filteredRows(true);
    main.querySelectorAll("[data-width]").forEach((button) => {
      const width = button.dataset.width;
      const count = withoutWidth.filter((row) => !width || row.band_width_pct <= Number(width)).length;
      button.setAttribute("aria-pressed", String(state.width === width));
      button.querySelector("[data-width-count]").textContent = count;
      button.setAttribute("aria-label", `${width ? "Maximum width " + width + "%" : "All widths"}, ${count} matching protocols`);
    });
    main.querySelectorAll("[data-scope]").forEach((button) => button.setAttribute("aria-pressed", String(state.scope === button.dataset.scope)));
    main.querySelectorAll("[data-heading]").forEach((heading) => {
      const selected = heading.dataset.heading === state.sort;
      heading.setAttribute("aria-sort", selected ? state.direction === 1 ? "ascending" : "descending" : "none");
      heading.querySelector("span").textContent = selected ? state.direction === 1 ? "↑" : "↓" : "↕";
    });
    document.getElementById("board-rows").innerHTML = rows.length ? rows.slice(start, start + pageSize).map(boardRow).join("") : `<tr role="row"><td role="cell" class="empty-cell" colspan="7"><div class="empty"><h3>No protocols match these filters</h3><p>Increase the width cap or broaden the network, category or TVL selection.</p><button id="empty-reset" class="primary-button" type="button">Reset filters</button></div></td></tr>`;
    document.getElementById("table-footer").innerHTML = `<span>${rows.length ? start + 1 : 0}–${Math.min(start + pageSize, rows.length)} of ${rows.length} protocols · global ranks preserved</span><div class="pagination"><button id="prev-page" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>←</button><span>${state.page} / ${pages}</span><button id="next-page" aria-label="Next page" ${state.page === pages ? "disabled" : ""}>→</button></div>`;
    saveFilters();
  }

  function resetFilters() {
    Object.assign(state, { query: "", chain: "", category: "", floor: "", width: "", scope: "all", page: 1 });
    updateBoard();
  }

  function peerTile(peer) {
    return `<article class="peer-tile"><div><h3>${escape(peer.name)}</h3><p class="muted">${escape(peer.category || "Uncategorized")}</p></div>
      <dl><div><dt>TVL</dt><dd title="${dollars(peer.tvl_usd)}">${money(peer.tvl_usd)}</dd></div><div><dt>Recorded mcap</dt><dd title="${peer.mcap_usd === null ? "Unreported" : dollars(peer.mcap_usd)}">${peer.mcap_usd === null ? "Unreported" : money(peer.mcap_usd)}</dd></div></dl>
      <div class="peer-multiple"><strong>${ratio(peer.used_ratio)}</strong><span>used multiple · ${ratio(peer.ratio)} raw</span></div>
    </article>`;
  }

  function detail(slug) {
    const row = data.rows.find((candidate) => candidate.slug === slug);
    if (!row) {
      main.innerHTML = `<section class="empty"><h1>Protocol record unavailable</h1><p>This slug does not appear in the sealed research dataset.</p><a class="back-link" href="${escape(boardHash)}">Return to the board</a></section>`;
      return;
    }
    document.getElementById("breadcrumb").textContent = row.name;
    const model = row.model;
    const range = row.high_usd - row.low_usd;
    const marker = range > 0 ? Math.max(0, Math.min(100, (row.base_usd - row.low_usd) / range * 100)) : 50;
    const tracked = row.age_days === null ? "Unreported" : row.age_days.toLocaleString("en-US") + " days";
    main.innerHTML = `
      <a class="back-link" href="${escape(boardHash)}">← Back to research board</a>
      <header class="detail-heading">${avatar(row)}<div><h1>${escape(row.name)}</h1><p>${escape(row.category || "Uncategorized")} · ${row.watchlist ? "Watchlist" : "Extended candidate"} · Snapshot records no token</p></div><div class="rank-stamp"><strong>#${row.rank}</strong>of ${data.rows.length} by base value</div></header>
      <nav class="detail-links" aria-label="Protocol research sections"><button data-jump="valuation">Valuation & rights</button><button data-jump="peers">Peer evidence</button><button data-jump="participation">Participation plan</button></nav>
      <div class="detail-overview" id="valuation" tabindex="-1">
        <section class="valuation-card" aria-labelledby="valuation-title">
          <div class="section-kicker"><span id="valuation-title">Implied circulating market cap</span><span class="confidence">${escape(row.confidence)} confidence</span></div>
          <div class="valuation-lead"><strong class="valuation-amount" title="${dollars(row.implied_value_usd)}">${money(row.implied_value_usd)}</strong><span>base estimate</span></div>
          ${valuationBand(row)}
          <div class="band-axis" role="img" aria-label="Base is ${marker.toFixed(1)}% of the way from low to high"><div class="band-axis-track"><span class="base-marker" style="left:${marker}%"></span></div><div class="axis-labels"><span>Low bound</span><span>Base marker on a linear USD scale</span><span>High bound</span></div></div>
          <p class="band-explanation"><strong>${row.band_width_pct.toFixed(1)}% band width</strong> relative to base · ${escape(row.band_basis)}. Multiples ${ratio(row.band.low_multiple)} low / ${ratio(row.band.base_multiple)} base / ${ratio(row.band.high_multiple)} high.</p>
          <p class="rights-rationale">${escape(row.rights_rationale)}</p>
        </section>
        <section class="facts-panel" aria-labelledby="facts-heading"><h2 id="facts-heading">Footprint & model inputs</h2>
          <dl class="facts-grid"><div><dt>Total value locked</dt><dd title="${dollars(row.tvl_usd)}">${money(row.tvl_usd)}</dd></div><div><dt>Seven-day TVL</dt><dd class="${changeClass(row.change_7d)}">${percent(row.change_7d)}</dd></div><div><dt>Tracking age</dt><dd>${tracked}<small>${row.listed_at ? "Listed " + escape(row.listed_at) : "0.85 maturity fallback"}</small></dd></div><div><dt>Category peer weight</dt><dd>${(model.category_weight * 100).toFixed(1)}%<small>${model.peer_count} priced category peers</small></dd></div></dl>
          <ul class="factor-list" aria-label="Valuation multipliers"><li><strong>${ratio(model.multiple)}</strong><span>Peer multiple</span></li><li><strong>${ratio(model.growth)}</strong><span>Momentum</span></li><li><strong>${ratio(model.maturity)}</strong><span>Maturity</span></li><li><strong>${ratio(model.rights)}</strong><span>Rights factor</span></li></ul>
          <p class="network-fact"><strong>${row.chains.length} RECORDED NETWORKS</strong>${escape(row.chains.join(", ") || "Unreported")}</p>
        </section>
      </div>
      <section class="research-section comparison-card" id="peers" tabindex="-1" aria-labelledby="peers-heading">
        <header class="section-heading"><div><div class="eyebrow">Evidence behind the multiple</div><h2 id="peers-heading">Peer comparison</h2><p>${escape(row.comparison_source)} benchmark · showing ${row.comparison_peers.length} closest peers to the blended base multiple. Raw mcap / TVL ratios are clipped to pooled bounds of ${ratio(data.ratio_bounds[0])}–${ratio(data.ratio_bounds[1])} before use.</p></div><div class="evidence-count"><strong>${row.comparison_count}</strong>available peers</div></header>
        <div class="peer-strip">${row.comparison_peers.map(peerTile).join("")}</div>
        ${row.peers.length ? `<details class="peer-disclosure"><summary>Inspect all ${row.peers.length} same-category peers and recorded values</summary><div class="table-scroll"><table class="peer-table"><caption class="sr-only">Same-category peer multiples used by the model</caption><thead><tr><th scope="col">Peer</th><th scope="col">TVL</th><th scope="col">Recorded mcap</th><th scope="col">Raw multiple</th><th scope="col">Used multiple</th></tr></thead><tbody>${row.peers.map((peer) => `<tr><th scope="row">${escape(peer.name)}</th><td title="${dollars(peer.tvl_usd)}">${money(peer.tvl_usd)}</td><td title="${dollars(peer.mcap_usd)}">${money(peer.mcap_usd)}</td><td>${ratio(peer.ratio)}</td><td>${ratio(peer.used_ratio)}</td></tr>`).join("")}</tbody></table></div></details>` : '<p class="board-note">No same-category peer is priced in this snapshot. The pooled benchmark supplies the complete band.</p>'}
      </section>
      <section class="research-section" id="participation" tabindex="-1" aria-labelledby="participation-heading">
        <header class="section-heading"><div><div class="eyebrow">Verify → test → review → exit</div><h2 id="participation-heading">Participation plan</h2><p>${escape(row.access)} · Cost planning assumes the low valuation band. These illustrative caps predict no reward allocation.</p></div></header>
        <dl class="cost-strip"><div><dt>Principal cap · low band</dt><dd>${dollars(row.farm_budget.capital_cap_usd)}</dd></div><div><dt>Separate fee cap</dt><dd>${dollars(row.farm_budget.fee_cap_usd)}</dd></div><div><dt>Review cadence</dt><dd>24h <small>then day ${row.farm_budget.review_days}</small></dd></div></dl>
        <div class="farm-layout"><ol class="farm-steps">${row.farm_steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol><aside class="risk-box" aria-label="Participation qualifications"><h3>Before allocating capital</h3>${row.warnings.map((warning) => `<p>${escape(warning)}</p>`).join("")}</aside></div>
      </section>`;
  }

  function method() {
    main.innerHTML = `
      <header class="page-heading"><div><div class="eyebrow">Model notes · ${escape(date)}</div><h1>Follow the evidence</h1><p>One sealed snapshot, an explicit peer model and disclosed participation assumptions.</p></div><a class="text-link" href="${escape(boardHash)}">Return to research ↗</a></header>
      <div class="method-grid">
        <section class="method-card"><h2>Universe & limits</h2><p>Retain all ${data.watchlist_count} watchlist entries. Extended candidates exclude recorded tokens and wrapped, staked, bridged or token-family products. Missing parent relationships require an independence check.</p><p>Estimate = TVL × blended multiple × momentum × maturity × rights. The snapshot lacks revenue, supply, unlocks, launch dates and token terms. TVL may overlap. Participation establishes no entitlement.</p></section>
        <section class="method-card"><h2>Peers & bands</h2><p>${data.peer_count} eligible priced peers supply mcap / TVL ratios, clipped to pooled P10–P90 (${ratio(data.ratio_bounds[0])}–${ratio(data.ratio_bounds[1])}). Blend category and pool P25 / median / P75 with weights n/(n+6) and 6/(n+6). Pool median is ${ratio(data.global_ratio)}. Zero category peers use the pool.</p><p>Apply identical factors to low / base / high, rounded to dollars. Width = (high − low) / base × 100. Width has no calibrated probability. Confidence tracks sparse evidence and ambiguity separately.</p></section>
        <section class="method-card"><h2>Factors & ordering</h2><p>Momentum = 1 + clamp(7d change, −40, 40) / 200, missing = 1. Maturity = 0.75 + 0.25 × min(days / 730, 1), missing = 0.85. Subjective rights factors retain 35% for ambiguous products, 65% for gated or curator access, 85% otherwise.</p><p>Rank by descending base, ties by slug. Interactive ordering preserves global ranks and places missing values last. Width meters saturate at 500%. Quick-filter counts respect other filters.</p></section>
        <section class="method-card"><h2>Participation budget</h2><p>Principal = low USD / 1,000,000, clamped to $10–$100 and capped by category. Observation and unknown routes use $0. Fees have separate route caps.</p><p>Each detail includes verification, a category action, receipts, 24-hour/day-7 review and exit. Check live access, minimums, fees, settlement and lockups before using the illustrative caps.</p></section>
      </div>`;
  }

  main.addEventListener("input", (event) => {
    if (event.target.id !== "search") return;
    state.query = event.target.value;
    state.page = 1;
    updateBoard();
  });

  main.addEventListener("change", (event) => {
    const control = event.target;
    if (control.id === "sort") {
      const [key, direction] = control.value.split(":");
      state.sort = key;
      state.direction = Number(direction);
    } else if (["chain", "category", "floor", "width"].includes(control.id)) {
      state[control.id] = control.value;
    } else return;
    state.page = 1;
    updateBoard();
  });

  main.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.jump) {
      const section = document.getElementById(button.dataset.jump);
      section.scrollIntoView({ block: "start" });
      section.focus({ preventScroll: true });
      return;
    }
    if (button.id === "reset" || button.id === "empty-reset") {
      resetFilters();
      return;
    }
    if (button.dataset.clear) state[button.dataset.clear] = "";
    else if (button.dataset.scope) state.scope = button.dataset.scope;
    else if (button.hasAttribute("data-width")) state.width = button.dataset.width;
    else if (button.id === "tightest-bands") {
      const active = state.sort === "band_width_pct" && state.direction === 1;
      state.sort = active ? "implied_value_usd" : "band_width_pct";
      state.direction = active ? -1 : 1;
    } else if (button.dataset.sort) {
      const key = button.dataset.sort;
      state.direction = state.sort === key ? -state.direction : ["name", "band_width_pct"].includes(key) ? 1 : -1;
      state.sort = key;
    } else if (button.id === "prev-page" || button.id === "next-page") {
      state.page += button.id === "next-page" ? 1 : -1;
      updateBoard();
      return;
    } else return;
    state.page = 1;
    updateBoard();
  });

  function render() {
    const hash = location.hash.slice(1).split("?")[0];
    const view = hash.startsWith("protocol/") ? "detail" : hash === "method" ? "method" : "board";
    for (const key of ["board", "method"]) {
      const link = document.getElementById("nav-" + key);
      const active = key === "method" ? view === "method" : view !== "method";
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.getElementById("breadcrumb").textContent = view === "method" ? "Model notes" : "Launch board";
    if (view === "board") {
      parseFilters();
      board();
    } else if (view === "method") method();
    else {
      let slug = "";
      try { slug = decodeURIComponent(hash.slice(9)); } catch { slug = ""; }
      detail(slug);
    }
    if (lastView !== hash) window.scrollTo(0, 0);
    lastView = hash;
    document.title = document.getElementById("breadcrumb").textContent + " — Token Radar";
  }

  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
  });
  window.addEventListener("hashchange", render);
  render();
})();
