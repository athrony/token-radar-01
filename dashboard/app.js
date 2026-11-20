(() => {
  "use strict";
  const data = window.RADAR;
  const main = document.getElementById("main");
  if (!data || !Array.isArray(data.rows)) {
    main.innerHTML =
      '<div class="missing"><h1>The snapshot is missing.</h1><p>Run main.ts and open the generated dashboard beside data.js.</p></div>';
    return;
  }

  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const money = (value) =>
    "$" +
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const dollars = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  const ratio = (value) => value.toFixed(2) + "×";
  const percent = (value) =>
    value === null
      ? "—"
      : (value >= 0 ? "+" : "−") + Math.abs(value).toFixed(1) + "%";
  const changeClass = (value) =>
    value === null ? "muted" : value >= 0 ? "positive" : "negative";
  const date = new Date(data.as_of + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const initials = (name) =>
    name
      .split(/[\s-]+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  const avatar = (row) =>
    `<span class="avatar tone-${row.rank % 4}" aria-hidden="true">${escape(initials(row.name))}</span>`;
  const valuationBand = (row) =>
    `<div class="value-band" aria-label="Low ${dollars(row.low_usd)}, base ${dollars(row.implied_value_usd)}, high ${dollars(row.high_usd)}">${[
      ["Low", row.low_usd], ["Base", row.implied_value_usd], ["High", row.high_usd],
    ].map(([label, value]) => `<span><small>${label}</small><strong title="${dollars(value)}">${money(value)}</strong></span>`).join("")}</div>`;
  const state = {
    query: "",
    chain: "",
    category: "",
    floor: "",
    width: "",
    scope: "all",
    sort: "implied_value_usd",
    direction: -1,
    page: 1,
  };
  const pageSize = 20;
  let boardHash = "#board";
  let lastView = "";

  document.getElementById("nav-count").textContent = data.rows.length;
  document.getElementById("sidebar-date").textContent = date;
  document.getElementById("top-date").textContent = date;
  document.getElementById("footer-date").textContent = date;

  function options(values, selected, label) {
    return (
      `<option value="">${label}</option>` +
      [...new Set(values)]
        .sort()
        .map(
          (value) =>
            `<option value="${escape(value)}" ${value === selected ? "selected" : ""}>${escape(value)}</option>`,
        )
        .join("")
    );
  }

  function parseFilters() {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    state.query = params.get("q") || "";
    state.chain = params.get("chain") || "";
    state.category = params.get("category") || "";
    state.width = ["100", "200", "400"].includes(params.get("width")) ? params.get("width") : "";
    state.floor = ["50000000", "100000000", "500000000"].includes(
      params.get("floor"),
    )
      ? params.get("floor")
      : "";
    state.scope = ["watchlist", "extended"].includes(params.get("scope"))
      ? params.get("scope")
      : "all";
    state.sort = [
      "implied_value_usd",
      "tvl_usd",
      "change_7d",
      "name",
      "age_days",
      "band_width_pct",
    ].includes(params.get("sort"))
      ? params.get("sort")
      : "implied_value_usd";
    state.direction = params.get("direction") === "1" ? 1 : -1;
    state.page = Math.max(
      1,
      Number.parseInt(params.get("page") || "1", 10) || 1,
    );
  }

  function saveFilters() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      q: state.query,
      chain: state.chain,
      category: state.category,
      floor: state.floor,
      width: state.width,
    })) {
      if (value) params.set(key, value);
    }
    if (state.scope !== "all") params.set("scope", state.scope);
    if (state.sort !== "implied_value_usd") params.set("sort", state.sort);
    if (state.direction !== -1)
      params.set("direction", String(state.direction));
    if (state.page > 1) params.set("page", String(state.page));
    boardHash = "#board" + (params.size ? "?" + params.toString() : "");
    history.replaceState(null, "", boardHash);
  }

  function filteredRows() {
    const query = state.query.trim().toLowerCase();
    return data.rows
      .filter(
        (row) =>
          (!query ||
            [row.name, row.slug, row.category, ...row.chains]
              .join(" ")
              .toLowerCase()
              .includes(query)) &&
          (!state.chain || row.chains.includes(state.chain)) &&
          (!state.category ||
            (row.category || "Uncategorized") === state.category) &&
          (!state.floor || row.tvl_usd >= Number(state.floor)) &&
          (!state.width || row.band_width_pct <= Number(state.width)) &&
          (state.scope !== "watchlist" || row.watchlist) &&
          (state.scope !== "extended" || !row.watchlist),
      )
      .sort((left, right) => {
        const leftValue = left[state.sort];
        const rightValue = right[state.sort];
        if (leftValue === null && rightValue === null)
          return left.rank - right.rank;
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;
        const compared =
          typeof leftValue === "string"
            ? leftValue.localeCompare(rightValue, "en")
            : leftValue - rightValue;
        return compared * state.direction || left.rank - right.rank;
      });
  }

  function board() {
    const categories = data.rows.map((row) => row.category || "Uncategorized");
    const chains = data.rows.flatMap((row) => row.chains);
    const topCategories = Object.entries(
      data.rows.reduce((counts, row) => {
        const category = row.category || "Uncategorized";
        counts[category] = (counts[category] || 0) + 1;
        return counts;
      }, {}),
    ).sort((left, right) => right[1] - left[1]);
    main.innerHTML = `
      <section class="intro">
        <div><div class="eyebrow">PROTOCOL INTELLIGENCE / ${escape(date.toUpperCase())}</div><h1>Token launch radar</h1><p>Find protocols that record no token. Explore their implied value<br class="desktop-break"> and a practical route to participation.</p></div>
        <div class="intro-actions"><a href="#method" class="text-link">How we value a launch <span aria-hidden="true">↗</span></a></div>
      </section>
      <section class="metrics" aria-label="Research coverage">
        <div class="metric"><span class="label">Ranked candidates</span><strong>${data.rows.length}</strong><small>From ${data.universe} sealed protocol records</small></div>
        <div class="metric"><span class="label">Watchlist coverage</span><strong>${data.watchlist_count}<span class="fraction"> / ${data.watchlist_count}</span></strong><small>Every entry above the house floor</small></div>
        <div class="metric"><span class="label">Beyond the watchlist</span><strong>${data.rows.length - data.watchlist_count}</strong><small>Extended candidates to investigate</small></div>
        <div class="metric"><span class="label">Priced valuation peers</span><strong>${data.peer_count}</strong><small>${ratio(data.global_ratio)} pooled market cap / TVL</small></div>
      </section>
      <section class="research-banner" aria-label="Valuation context"><div class="banner-copy"><div class="banner-symbol" aria-hidden="true">↗</div><div><h2>Peer multiples adjusted for the protocol's footprint</h2><p>Implied values combine peer multiples, TVL momentum and tracking age. Token status and participation rights need verification before acting.</p></div></div><div class="banner-chart"><div class="chart-label"><span>CANDIDATES BY CATEGORY</span><span>${topCategories.length} SECTORS</span></div><div class="distribution" role="img" aria-label="${escape(topCategories.map(([category, count]) => `${category}, ${count} candidates`).join(". "))}">${topCategories.map(([category, count]) => `<span style="flex:${count}" title="${escape(category)} · ${count}"></span>`).join("")}</div><div class="chart-caption">${escape(
        topCategories
          .slice(0, 3)
          .map(([category, count]) => `${category} ${count}`)
          .join(" · "),
      )}</div></div></section>
      <section aria-label="Ranked launch board"><div class="board-heading"><h2>The launch board</h2><span class="muted">Implied circulating market cap · USD</span></div>
        <div class="scope-tabs" role="group" aria-label="Candidate scope">${[
          ["all", "All candidates", data.rows.length],
          ["watchlist", "Watchlist", data.watchlist_count],
          ["extended", "Extended", data.rows.length - data.watchlist_count],
        ]
          .map(
            ([key, label, count]) =>
              `<button type="button" data-scope="${key}" class="${state.scope === key ? "active" : ""}" aria-pressed="${state.scope === key}">${label}<span>${count}</span></button>`,
          )
          .join("")}</div>
        <div class="filters">
          <div class="filter-field"><label for="search">Search protocols</label><div class="search-wrap"><input id="search" type="search" value="${escape(state.query)}" placeholder="Name, category or chain…" autocomplete="off"></div></div>
          <div class="filter-field"><label for="chain">Network</label><select id="chain">${options(chains, state.chain, "All networks")}</select></div>
          <div class="filter-field"><label for="category">Category</label><select id="category">${options(categories, state.category, "All categories")}</select></div>
          <div class="filter-field"><label for="floor">Minimum TVL</label><select id="floor"><option value="">Any size</option>${[
            ["50000000", "$50M+"],
            ["100000000", "$100M+"],
            ["500000000", "$500M+"],
          ]
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.floor === value ? "selected" : ""}>${label}</option>`,
            )
            .join("")}</select></div>
          <div class="filter-field"><label for="width">Max band width</label><select id="width"><option value="">Any uncertainty</option>${["100", "200", "400"].map((value) => `<option value="${value}" ${state.width === value ? "selected" : ""}>≤ ${value}% of base</option>`).join("")}</select></div>
          <button class="reset-button" id="reset" type="button">Reset filters ↺</button>
        </div>
        <div class="result-line"><div id="result-count" role="status" aria-live="polite"></div><button id="tightest-bands" class="band-sort" type="button">Tightest bands first</button><div id="chips" class="filter-chips"></div></div>
        <div class="table-frame"><div class="table-scroll"><table aria-label="Protocol value ranking"><thead><tr>
          <th scope="col" class="rank-cell">#</th><th scope="col" data-heading="name"><button data-sort="name">Protocol <span></span></button></th><th scope="col">Category</th>
          <th scope="col" data-heading="implied_value_usd"><button data-sort="implied_value_usd">Low / Base / High · USD <span></span></button></th><th scope="col" data-heading="tvl_usd"><button data-sort="tvl_usd">TVL <span></span></button></th>
          <th scope="col" data-heading="change_7d"><button data-sort="change_7d">7d TVL <span></span></button></th><th scope="col">Networks</th><th scope="col">Farm route</th><th scope="col"><span class="sr-only">Details</span></th>
        </tr></thead><tbody id="board-rows"></tbody></table></div><div id="table-footer" class="table-footer"></div></div>
        <p class="board-note">● Watchlist entry. Low / high use blended peer quartiles with the same momentum, age and rights factors as base. Width = (high − low) / base.<br>Ranks use base value. Narrower bands describe peer dispersion; verify evidence density and rights in each detail.</p>
      </section>`;
    document.getElementById("search").addEventListener("input", (event) => {
      state.query = event.target.value;
      state.page = 1;
      updateBoard();
    });
    for (const key of ["chain", "category", "floor", "width"]) {
      document.getElementById(key).addEventListener("change", (event) => {
        state[key] = event.target.value;
        state.page = 1;
        updateBoard();
      });
    }
    document.getElementById("reset").addEventListener("click", resetFilters);
    document.getElementById("tightest-bands").addEventListener("click", () => {
      const active = state.sort === "band_width_pct" && state.direction === 1;
      state.sort = active ? "implied_value_usd" : "band_width_pct";
      state.direction = active ? -1 : 1;
      state.page = 1;
      updateBoard();
    });
    main.querySelectorAll("[data-scope]").forEach((button) =>
      button.addEventListener("click", () => {
        state.scope = button.dataset.scope;
        state.page = 1;
        updateBoard();
      }),
    );
    main.querySelectorAll("[data-sort]").forEach((button) =>
      button.addEventListener("click", () => {
        state.direction =
          state.sort === button.dataset.sort
            ? -state.direction
            : button.dataset.sort === "name"
              ? 1
              : -1;
        state.sort = button.dataset.sort;
        state.page = 1;
        updateBoard();
      }),
    );
    updateBoard();
  }

  function resetFilters() {
    Object.assign(state, {
      query: "",
      chain: "",
      category: "",
      floor: "",
      width: "",
      scope: "all",
      page: 1,
    });
    board();
  }

  function updateBoard() {
    const rows = filteredRows();
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * pageSize;
    document.getElementById("result-count").textContent =
      `${rows.length} ${rows.length === 1 ? "protocol" : "protocols"} shown · ${state.scope === "all" ? "full radar" : state.scope + " scope"}`;
    const chips = [
      state.query && ["query", "“" + state.query + "”"],
      state.chain && ["chain", state.chain],
      state.category && ["category", state.category],
      state.floor && ["floor", money(Number(state.floor)) + "+ TVL"],
      state.width && ["width", "Band width ≤ " + state.width + "%"],
    ].filter(Boolean);
    const tightest = document.getElementById("tightest-bands");
    tightest.setAttribute("aria-pressed", String(state.sort === "band_width_pct" && state.direction === 1));
    document.getElementById("chips").innerHTML = chips
      .map(
        ([key, label]) =>
          `<button class="filter-chip" data-clear="${key}" aria-label="Remove ${escape(label)} filter">${escape(label)} ×</button>`,
      )
      .join("");
    main.querySelectorAll("[data-clear]").forEach((button) =>
      button.addEventListener("click", () => {
        state[button.dataset.clear] = "";
        state.page = 1;
        board();
      }),
    );
    main.querySelectorAll("[data-scope]").forEach((button) => {
      button.classList.toggle("active", button.dataset.scope === state.scope);
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.scope === state.scope),
      );
    });
    main.querySelectorAll("[data-heading]").forEach((heading) => {
      const selected = heading.dataset.heading === state.sort;
      heading.setAttribute(
        "aria-sort",
        selected
          ? state.direction === 1
            ? "ascending"
            : "descending"
          : "none",
      );
      heading.querySelector("button").classList.toggle("selected", selected);
      heading.querySelector("span").textContent = selected
        ? state.direction === 1
          ? "↑"
          : "↓"
        : "↕";
    });
    document.getElementById("board-rows").innerHTML = rows.length
      ? rows
          .slice(start, start + pageSize)
          .map(
            (row) => `
      <tr><td class="rank-cell">${String(row.rank).padStart(2, "0")}</td><td class="protocol-cell"><div class="protocol-wrap">${avatar(row)}<div><a class="protocol-name" href="#protocol/${encodeURIComponent(row.slug)}">${escape(row.name)}</a><span class="protocol-meta">${row.watchlist ? '<span class="watch-dot">●</span>Watchlist' : "Extended"} · ${row.confidence.toLowerCase()} confidence</span></div></div></td>
      <td><span class="category-tag">${escape(row.category || "Uncategorized")}</span></td><td class="value-cell number">${valuationBand(row)}<small class="band-width">${row.band_width_pct.toFixed(1)}% width</small></td>
      <td class="number">${money(row.tvl_usd)}</td><td class="number ${changeClass(row.change_7d)}">${percent(row.change_7d)}</td>
      <td><span class="chain-list" title="${escape(row.chains.join(", "))}">${escape(state.chain || row.chains[0] || "Unreported")}${row.chains.length > 1 ? `<small>+${row.chains.length - 1}</small>` : ""}</span></td><td><span class="access-tag">${escape(row.access)}</span></td>
      <td><a class="open-row" href="#protocol/${encodeURIComponent(row.slug)}" aria-label="View ${escape(row.name)} details">↗</a></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="9"><div class="empty"><h3>No protocols match these filters</h3><p>Try a broader network, category or TVL floor.</p><button id="empty-reset">Reset filters</button></div></td></tr>';
    document
      .getElementById("empty-reset")
      ?.addEventListener("click", resetFilters);
    document.getElementById("table-footer").innerHTML =
      `<span>${rows.length ? start + 1 : 0}–${Math.min(start + pageSize, rows.length)} of ${rows.length} protocols · ${data.watchlist_count}/${data.watchlist_count} watchlist records included in full board</span><div class="pagination"><button id="prev-page" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>←</button><span>${state.page} / ${pages}</span><button id="next-page" aria-label="Next page" ${state.page === pages ? "disabled" : ""}>→</button></div>`;
    document.getElementById("prev-page").addEventListener("click", () => {
      state.page--;
      updateBoard();
    });
    document.getElementById("next-page").addEventListener("click", () => {
      state.page++;
      updateBoard();
    });
    saveFilters();
  }

  function detail(slug) {
    const row = data.rows.find((candidate) => candidate.slug === slug);
    if (!row) {
      main.innerHTML =
        '<div class="missing"><h1>Protocol record unavailable</h1><a class="text-link" href="#board">Return to the launch board ↗</a></div>';
      return;
    }
    document.getElementById("breadcrumb").textContent = row.name;
    const model = row.model;
    main.innerHTML = `
      <a class="back-link" href="${escape(boardHash)}">← Back to launch board</a>
      <section class="detail-heading"><div class="detail-identity">${avatar(row)}<div><h1>${escape(row.name)}</h1><div class="detail-subtitle"><span>${escape(row.category || "Uncategorized")}</span><span class="badge">${row.watchlist ? "Watchlist" : "Extended candidate"}</span><span>Snapshot records no token</span></div></div></div><span class="rank-badge">Rank ${row.rank} of ${data.rows.length}</span></section>
      <div class="detail-grid">
        <section class="card valuation-card"><div class="card-label">IMPLIED CIRCULATING MARKET CAP</div><div class="valuation-main"><strong class="valuation-amount" title="${dollars(row.implied_value_usd)}">${money(row.implied_value_usd)}</strong><span class="confidence">${row.confidence} confidence</span></div>${valuationBand(row)}<p>${escape(row.band_basis)} · ${row.band_width_pct.toFixed(1)}% width relative to base. Low / base / high multiples ${ratio(row.band.low_multiple)} / ${ratio(model.multiple)} / ${ratio(row.band.high_multiple)}.</p><div class="formula"><div><strong>${ratio(model.multiple)}</strong>Base multiple</div><div><strong>${ratio(model.growth)}</strong>7d momentum</div><div><strong>${ratio(model.maturity)}</strong>Tracking maturity</div><div><strong>${ratio(model.rights)}</strong>Rights factor</div></div><p class="rights-rationale">${escape(row.rights_rationale)}</p></section>
        <section class="card"><div class="card-label">SNAPSHOT FUNDAMENTALS</div><dl class="facts-grid"><div><dt>Total value locked</dt><dd>${money(row.tvl_usd)}<small>${dollars(row.tvl_usd)}</small></dd></div><div><dt>7-day TVL change</dt><dd class="${changeClass(row.change_7d)}">${percent(row.change_7d)}<small>${row.change_7d === null ? "Missing · neutral model factor" : "Bounded to ±40% in model"}</small></dd></div><div><dt>Tracked since</dt><dd class="small">${escape(row.listed_at || "Unreported")}<small>${row.age_days === null ? "Unknown tracking age" : row.age_days.toLocaleString("en-US") + " days at snapshot date"}</small></dd></div><div><dt>Recorded networks · ${row.chains.length}</dt><dd class="small">${escape(row.chains.join(", ") || "Unreported")}</dd></div></dl></section>
        <section class="card comparison-card"><div class="section-header"><div><h2>Peer comparison</h2><p>${row.comparison_peers.length} of ${row.comparison_count} ${escape(row.comparison_source)} peers, closest to the blended base multiple. Multiples are clipped to pooled 10th–90th percentiles.</p></div></div><div class="peer-strip">${row.comparison_peers.map((peer) => `<article class="peer-tile"><h3>${escape(peer.name)}</h3><dl><div><dt>TVL</dt><dd>${money(peer.tvl_usd)}</dd></div><div><dt>Recorded mcap</dt><dd>${peer.mcap_usd === null ? "Unreported" : money(peer.mcap_usd)}</dd></div><div><dt>Raw / used multiple</dt><dd>${ratio(peer.ratio)} / ${ratio(peer.used_ratio)}</dd></div></dl></article>`).join("")}</div></section>
        <section class="card farm-card"><div class="section-header"><div><h2>Participation plan</h2><p>${escape(row.access)} · low-band principal cap ${dollars(row.farm_budget.capital_cap_usd)} + ${dollars(row.farm_budget.fee_cap_usd)} fees · review at 24h / day ${row.farm_budget.review_days}</p></div><span class="badge">Start with verification</span></div><div class="farm-layout"><ol class="farm-steps">${row.farm_steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol><aside class="risk-box"><h3>Before allocating capital</h3>${row.warnings.map((warning) => `<p>${escape(warning)}</p>`).join("")}<div class="budget">Low-band cost plan<small>Principal ${dollars(row.farm_budget.capital_cap_usd)} · fees ${dollars(row.farm_budget.fee_cap_usd)}. Illustrative caps, with rewards unverified.</small></div></aside></div></section>
        <section class="card peer-card"><div class="section-header"><div><h2>Trace the valuation</h2><p>TVL × blended peer multiple × momentum × maturity × rights factor</p></div><a class="text-link" href="#method">Full method ↗</a></div><p class="muted">${model.peer_count} same-category priced ${model.peer_count === 1 ? "peer" : "peers"} · ${(model.category_weight * 100).toFixed(0)}% category weight · ${ratio(model.global_ratio)} pooled median. Category Q25 / Q75 ${ratio(row.band.category_q25)} / ${ratio(row.band.category_q75)}; pooled Q25 / Q75 ${ratio(row.band.pooled_q25)} / ${ratio(row.band.pooled_q75)}. Each quartile uses the same category weight as base. Evidence confidence is ${row.confidence.toLowerCase()}.</p>${row.peers.length ? `<div class="table-scroll"><table aria-label="Same-category valuation peers"><thead><tr><th>Token-bearing peer</th><th>Market cap</th><th>TVL</th><th>Raw cap / TVL</th></tr></thead><tbody>${row.peers.map((peer) => `<tr><td>${escape(peer.name)}</td><td>${money(peer.mcap_usd)}</td><td>${money(peer.tvl_usd)}</td><td>${ratio(peer.ratio)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="board-note">No same-category peer is priced in this snapshot. Pooled quartiles supply the entire band.</p>'}<p class="board-note">All three multiples use the same momentum, tracking maturity and rights factors. Bands reflect recorded peer dispersion and carry no statistical coverage guarantee. Launch timing, fully diluted value and reward allocation remain unestimated.</p></section>
      </div>`;
  }

  function method() {
    main.innerHTML = `<a class="back-link" href="${escape(boardHash)}">← Back to launch board</a><section class="method-intro"><div class="eyebrow">THE RESEARCH MODEL</div><h1>Valuation methodology</h1><p>Every estimate is reproducible from the sealed ${escape(date)} snapshot. Values approximate a hypothetical circulating token market cap under the protocol's recorded footprint. They carry no claim about launch timing or token allocations.</p></section><div class="method-grid">
      <section class="card"><h2>From records to candidates</h2><p>All ${data.watchlist_count} house-watchlist records are retained. Additional records require null symbol, gecko_id and market cap. Category and name checks exclude bridges, liquid staking, wrappers, exchange products, versioned names and identified token-family products.</p><p>Watchlist records with product ambiguity stay visible with a 0.35 rights factor and observation-first steps. The sealed file omits parentProtocol. Extended candidates carry a verification warning.</p><p>${data.token_records} records identify a token by ticker or CoinGecko ID. They are excluded from candidates and can supply priced peers when eligible.</p></section>
      <section class="card"><h2>A conditional market-cap estimate</h2><div class="model-equation">TVL × peer multiple<br>× momentum × maturity × rights</div><p>TVL remains the recorded dollar amount. Supply, FDV, revenue, fees, token rights and unlocks are absent from the snapshot. Launch probability is left unestimated.</p><p>Missing tracking dates receive a 0.85 maturity factor. Missing growth receives a neutral 1.00 factor. Chain count receives no valuation premium.</p></section>
      <section class="card"><h2>Peer multiple</h2><ol><li>Use ${data.peer_count} token-bearing records with positive TVL and market cap, applying category and product-name exclusions.</li><li>Compute each market cap / TVL ratio. Clip ratios between ${ratio(data.ratio_bounds[0])} and ${ratio(data.ratio_bounds[1])}, the pooled 10th and 90th percentiles.</li><li>Take the median for the protocol's category and the pooled median of ${ratio(data.global_ratio)}.</li><li>Blend category × n/(n+6) with pooled × 6/(n+6). A category with no priced peers uses the pooled median.</li></ol></section>
      <section class="card"><h2>Bounded adjustments</h2><ul><li>Momentum equals 1 + clamp(7d TVL change, −40, 40) / 200. Its range is 0.80–1.20.</li><li>Maturity equals 0.75 + 0.25 × min(tracked days / 730, 1). The clock runs from listed_at to the snapshot date.</li><li>The rights factor is 0.35 for product ambiguity, 0.65 for curator and eligibility-gated routes, and 0.85 otherwise. These are subjective haircuts.</li><li>Values are rounded to whole dollars, sorted descending and tied by slug. Rank is global across all filters.</li></ul></section>
      <section class="card"><h2>Reading peer bands</h2><p>Low / high multiples blend the clipped category 25th / 75th percentiles with the pooled quartiles, using the same n/(n+6) weight as base. Without category peers, use pooled quartiles. Multiply each by the same TVL, momentum, age and rights factors and round to dollars.</p><p>Width is (high − low) / base × 100. Filter its maximum or sort tightest first. Confidence separately describes sparse peers, missing tracking age and product ambiguity. A tight band can still have low evidence confidence.</p><p>These are peer-dispersion scenarios with no calibrated coverage probability. TVL may overlap and token rights can differ between peers.</p></section>
      <section class="card"><h2>Using low-band cost plans</h2><p>Each plan uses one millionth of low implied USD, clamped to $10–$100, then reduced by a category cap. Observation and unknown routes use $0. Fees have a separate cap. This illustrative budgeting convention predicts no rewards or return.</p><p>Verify deployment and access first, preview a category-specific action, save receipts, review after 24 hours and day 7, then test the documented exit. Curator routes verify the host manager, gated products require eligibility approval, and derivatives begin on paper.</p><p>Respect protocol minimums, settlement dates and lockups. If these exceed the caps or the exit is unclear, stay on paper.</p></section>
    </div>`;
  }

  function render() {
    const hash = location.hash.slice(1);
    const view = hash.startsWith("protocol/")
      ? "detail"
      : hash === "method"
        ? "method"
        : "board";
    document
      .getElementById("nav-board")
      .classList.toggle("active", view !== "method");
    document
      .getElementById("nav-method")
      .classList.toggle("active", view === "method");
    document.getElementById("breadcrumb").textContent =
      view === "method" ? "Methodology" : "Launch board";
    if (view === "board") {
      parseFilters();
      board();
    }
    if (view === "detail") {
      let slug = "";
      try {
        slug = decodeURIComponent(hash.slice(9));
      } catch {
        slug = "";
      }
      detail(slug);
    }
    if (view === "method") method();
    if (lastView !== hash) window.scrollTo(0, 0);
    lastView = hash;
    document.title =
      view === "detail"
        ? `${document.getElementById("breadcrumb").textContent} — Token Radar`
        : "Token Radar — " +
          (view === "method" ? "Methodology" : "Launch board");
  }

  window.addEventListener("hashchange", render);
  render();
})();
