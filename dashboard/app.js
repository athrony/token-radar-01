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
  const state = {
    query: "",
    chain: "",
    category: "",
    floor: "",
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
          <button class="reset-button" id="reset" type="button">Reset filters ↺</button>
        </div>
        <div class="result-line"><div id="result-count" role="status" aria-live="polite"></div><div id="chips" class="filter-chips"></div></div>
        <div class="table-frame"><div class="table-scroll"><table aria-label="Protocol value ranking"><thead><tr>
          <th scope="col" class="rank-cell">#</th><th scope="col" data-heading="name"><button data-sort="name">Protocol <span></span></button></th><th scope="col">Category</th>
          <th scope="col" data-heading="implied_value_usd"><button data-sort="implied_value_usd">Implied value <span></span></button></th><th scope="col" data-heading="tvl_usd"><button data-sort="tvl_usd">TVL <span></span></button></th>
          <th scope="col" data-heading="change_7d"><button data-sort="change_7d">7d TVL <span></span></button></th><th scope="col">Networks</th><th scope="col">Farm route</th><th scope="col"><span class="sr-only">Details</span></th>
        </tr></thead><tbody id="board-rows"></tbody></table></div><div id="table-footer" class="table-footer"></div></div>
        <p class="board-note">● Watchlist entry. Global rank stays fixed when filtering. Ranges show model sensitivity. TVL may overlap across protocols.<br>Tracking age measures time on DefiLlama. The snapshot contains no launch schedule, incentive terms, supply or revenue.</p>
      </section>`;
    document.getElementById("search").addEventListener("input", (event) => {
      state.query = event.target.value;
      state.page = 1;
      updateBoard();
    });
    for (const key of ["chain", "category", "floor"]) {
      document.getElementById(key).addEventListener("change", (event) => {
        state[key] = event.target.value;
        state.page = 1;
        updateBoard();
      });
    }
    document.getElementById("reset").addEventListener("click", resetFilters);
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
    ].filter(Boolean);
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
      <td><span class="category-tag">${escape(row.category || "Uncategorized")}</span></td><td class="value-cell number"><strong>${money(row.implied_value_usd)}</strong><small>${money(row.low_usd)} – ${money(row.high_usd)}</small></td>
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
        <section class="card valuation-card"><div class="card-label">IMPLIED CIRCULATING MARKET CAP</div><div class="valuation-main"><strong class="valuation-amount" title="${dollars(row.implied_value_usd)}">${money(row.implied_value_usd)}</strong><span class="confidence">${row.confidence} confidence</span></div><p>Conditional value under the snapshot's operating footprint</p><div class="range-track" aria-hidden="true"></div><div class="range-labels"><span>${money(row.low_usd)} downside</span><span>Base case</span><span>${money(row.high_usd)} upside</span></div><div class="formula"><div><strong>${ratio(model.multiple)}</strong>Peer multiple</div><div><strong>${ratio(model.growth)}</strong>7d momentum</div><div><strong>${ratio(model.maturity)}</strong>Tracking maturity</div><div><strong>${ratio(model.rights)}</strong>Rights haircut</div></div></section>
        <section class="card"><div class="card-label">SNAPSHOT FUNDAMENTALS</div><dl class="facts-grid"><div><dt>Total value locked</dt><dd>${money(row.tvl_usd)}<small>${dollars(row.tvl_usd)}</small></dd></div><div><dt>7-day TVL change</dt><dd class="${changeClass(row.change_7d)}">${percent(row.change_7d)}<small>${row.change_7d === null ? "Missing · neutral model factor" : "Bounded to ±40% in model"}</small></dd></div><div><dt>Tracked since</dt><dd class="small">${escape(row.listed_at || "Unreported")}<small>${row.age_days === null ? "Unknown tracking age" : row.age_days.toLocaleString("en-US") + " days at snapshot date"}</small></dd></div><div><dt>Recorded networks · ${row.chains.length}</dt><dd class="small">${escape(row.chains.join(", ") || "Unreported")}</dd></div></dl></section>
        <section class="card farm-card"><div class="section-header"><div><h2>Participation plan</h2><p>A conditional research route · ${escape(row.access)} · review over 7–14 days</p></div><span class="badge">Start with verification</span></div><div class="farm-layout"><ol class="farm-steps">${row.farm_steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol><aside class="risk-box"><h3>Before allocating capital</h3>${row.warnings.map((warning) => `<p>${escape(warning)}</p>`).join("")}<div class="budget">Rewards unverified<small>Planning caps are illustrative. Principal can be lost.</small></div></aside></div></section>
        <section class="card peer-card"><div class="section-header"><div><h2>Trace the valuation</h2><p>TVL × blended peer multiple × momentum × maturity × rights haircut</p></div><a class="text-link" href="#method">Full method ↗</a></div><p class="muted">${model.peer_count} same-category priced ${model.peer_count === 1 ? "peer" : "peers"} · ${(model.category_weight * 100).toFixed(0)}% category weight · ${ratio(model.global_ratio)} pooled benchmark. ${model.peer_count < 3 ? "Sparse peer evidence broadens the sensitivity range." : "Sensitivity is a fixed ±45% scenario band."} ${row.confidence === "Low" ? "This record uses a fixed ±65% scenario band." : ""}</p>${row.peers.length ? `<div class="table-scroll"><table aria-label="Same-category valuation peers"><thead><tr><th>Token-bearing peer</th><th>Market cap</th><th>TVL</th><th>Raw cap / TVL</th></tr></thead><tbody>${row.peers.map((peer) => `<tr><td>${escape(peer.name)}</td><td>${money(peer.mcap_usd)}</td><td>${money(peer.tvl_usd)}</td><td>${ratio(peer.ratio)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="board-note">No same-category peer is priced in this snapshot. The pooled benchmark supplies the entire multiple.</p>'}<p class="board-note">Peer ratios are clipped at the pooled 10th and 90th percentiles before taking medians. These bands express chosen assumptions. Launch timing, fully diluted value and reward allocation remain unestimated.</p></section>
      </div>`;
  }

  function method() {
    main.innerHTML = `<a class="back-link" href="${escape(boardHash)}">← Back to launch board</a><section class="method-intro"><div class="eyebrow">THE RESEARCH MODEL</div><h1>Valuation methodology</h1><p>Every estimate is reproducible from the sealed ${escape(date)} snapshot. Values approximate a hypothetical circulating token market cap under the protocol's recorded footprint. They carry no claim about launch timing or token allocations.</p></section><div class="method-grid">
      <section class="card"><h2>From records to candidates</h2><p>All ${data.watchlist_count} house-watchlist records are retained. Additional records require null symbol, gecko_id and market cap. Category and name checks exclude bridges, liquid staking, wrappers, exchange products, versioned names and identified token-family products.</p><p>Watchlist records with product ambiguity stay visible with a 0.35 rights factor and observation-first steps. The sealed file omits parentProtocol. Extended candidates carry a verification warning.</p><p>${data.token_records} records identify a token by ticker or CoinGecko ID. They are excluded from candidates and can supply priced peers when eligible.</p></section>
      <section class="card"><h2>A conditional market-cap estimate</h2><div class="model-equation">TVL × peer multiple<br>× momentum × maturity × rights</div><p>TVL remains the recorded dollar amount. Supply, FDV, revenue, fees, token rights and unlocks are absent from the snapshot. Launch probability is left unestimated.</p><p>Missing tracking dates receive a 0.85 maturity factor. Missing growth receives a neutral 1.00 factor. Chain count receives no valuation premium.</p></section>
      <section class="card"><h2>Peer multiple</h2><ol><li>Use ${data.peer_count} token-bearing records with positive TVL and market cap, applying category and product-name exclusions.</li><li>Compute each market cap / TVL ratio. Clip ratios between ${ratio(data.ratio_bounds[0])} and ${ratio(data.ratio_bounds[1])}, the pooled 10th and 90th percentiles.</li><li>Take the median for the protocol's category and the pooled median of ${ratio(data.global_ratio)}.</li><li>Blend category × n/(n+6) with pooled × 6/(n+6). A category with no priced peers uses the pooled median.</li></ol></section>
      <section class="card"><h2>Bounded adjustments</h2><ul><li>Momentum equals 1 + clamp(7d TVL change, −40, 40) / 200. Its range is 0.80–1.20.</li><li>Maturity equals 0.75 + 0.25 × min(tracked days / 730, 1). The clock runs from listed_at to the snapshot date.</li><li>The rights factor is 0.35 for product ambiguity, 0.65 for curator and eligibility-gated routes, and 0.85 otherwise. These are subjective haircuts.</li><li>Values are rounded to whole dollars, sorted descending and tied by slug. Rank is global across all filters.</li></ul></section>
      <section class="card"><h2>Reading uncertainty</h2><p>Ranges are chosen sensitivity bands. They are ±65% when fewer than three same-category peers are available, tracking age is missing, or product status is ambiguous. Other records use ±45%.</p><p>Confidence labels describe evidence density. They are low for sparse peers, missing tracking age or product ambiguity, and moderate otherwise. Bands are scenario assumptions without statistical calibration.</p><p>TVL can be recursively counted and may represent assets with weak token value capture. Peer tokens can have very different circulating supplies.</p></section>
      <section class="card"><h2>Using participation plans</h2><p>Plans are generated from the protocol's category, name and recorded network. They specify a verification step, a bounded test, a review period and an exit. Budget caps are illustrative.</p><p>Curator routes verify the manager at a host vault. RWA routes check eligibility before funding. Derivatives begin with paper trading. Wrapper, network and staking-pool records begin with observation.</p><p>The snapshot includes no contracts, fee quotes, points program or airdrop terms. Verify each live route independently before using it.</p></section>
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
