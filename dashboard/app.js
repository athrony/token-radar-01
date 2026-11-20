(() => {
  'use strict';
  const radarData = window.RADAR;
  const contentRoot = document.getElementById('main');
  if (!radarData || !Array.isArray(radarData.rows)) {
    contentRoot.innerHTML = '<div class="missing"><h1>The snapshot is missing.</h1><p>Run main.ts and open the generated dashboard beside data.js.</p></div>';
    return;
  }

  const escape = (value) => String(value ?? '').replace(
    /[&<>"']/g,
    (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;',
    })[character],
  );
  const money = (value) => '$' + new Intl.NumberFormat('en-US', {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(value);
  const dollars = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(value);
  const ratio = (value) => value.toFixed(2) + '×';
  const percent = (value) => value === null
    ? '—'
    : (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(1) + '%';
  const changeClass = (value) => value === null ? 'muted' : value >= 0 ? 'positive' : 'negative';
  const snapshotDate = new Date(radarData.as_of + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const initials = (name) => name.split(/[\s-]+/)
    .map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (protocol) =>
    `<span class="avatar tone-${protocol.rank % 4}" aria-hidden="true">${escape(initials(protocol.name))}</span>`;
  const filters = {
    query: '', chain: '', category: '', floor: '', scope: 'all',
    sort: 'implied_value_usd', direction: -1, page: 1,
  };
  const pageSize = 20;
  let boardHash = '#board';
  let previousView = '';

  document.getElementById('nav-count').textContent = radarData.rows.length;
  document.getElementById('sidebar-date').textContent = snapshotDate;
  document.getElementById('top-date').textContent = snapshotDate;
  document.getElementById('footer-date').textContent = snapshotDate;

  function options(values, selected, label) {
    return `<option value="">${label}</option>` + [...new Set(values)].sort()
      .map((value) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(value)}</option>`)
      .join('');
  }

  function parseFilters() {
    const parameters = new URLSearchParams(location.hash.split('?')[1] || '');
    filters.query = parameters.get('q') || '';
    filters.chain = parameters.get('chain') || '';
    filters.category = parameters.get('category') || '';
    filters.floor = ['50000000', '100000000', '500000000'].includes(parameters.get('floor'))
      ? parameters.get('floor') : '';
    filters.scope = ['watchlist', 'extended'].includes(parameters.get('scope'))
      ? parameters.get('scope') : 'all';
    filters.sort = ['implied_value_usd', 'tvl_usd', 'change_7d', 'name', 'age_days'].includes(parameters.get('sort'))
      ? parameters.get('sort') : 'implied_value_usd';
    filters.direction = parameters.get('direction') === '1' ? 1 : -1;
    filters.page = Math.max(1, Number.parseInt(parameters.get('page') || '1', 10) || 1);
  }

  function saveFilters() {
    const parameters = new URLSearchParams();
    for (const [key, value] of Object.entries({
      q: filters.query, chain: filters.chain, category: filters.category, floor: filters.floor,
    })) {
      if (value) parameters.set(key, value);
    }
    if (filters.scope !== 'all') parameters.set('scope', filters.scope);
    if (filters.sort !== 'implied_value_usd') parameters.set('sort', filters.sort);
    if (filters.direction !== -1) parameters.set('direction', String(filters.direction));
    if (filters.page > 1) parameters.set('page', String(filters.page));
    boardHash = '#board' + (parameters.size ? '?' + parameters.toString() : '');
    history.replaceState(null, '', boardHash);
  }

  function filteredRows() {
    const searchQuery = filters.query.trim().toLowerCase();
    return radarData.rows.filter((protocol) =>
      (!searchQuery || [protocol.name, protocol.slug, protocol.category, ...protocol.chains]
        .join(' ').toLowerCase().includes(searchQuery)) &&
      (!filters.chain || protocol.chains.includes(filters.chain)) &&
      (!filters.category || (protocol.category || 'Uncategorized') === filters.category) &&
      (!filters.floor || protocol.tvl_usd >= Number(filters.floor)) &&
      (filters.scope !== 'watchlist' || protocol.watchlist) &&
      (filters.scope !== 'extended' || !protocol.watchlist),
    ).sort((left, right) => {
      const leftValue = left[filters.sort];
      const rightValue = right[filters.sort];
      if (leftValue === null && rightValue === null) return left.rank - right.rank;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      const comparison = typeof leftValue === 'string'
        ? leftValue.localeCompare(rightValue, 'en') : leftValue - rightValue;
      return comparison * filters.direction || left.rank - right.rank;
    });
  }

  function board() {
    const categories = radarData.rows.map((protocol) => protocol.category || 'Uncategorized');
    const chains = radarData.rows.flatMap((protocol) => protocol.chains);
    const topCategories = Object.entries(radarData.rows.reduce((counts, protocol) => {
      const categoryName = protocol.category || 'Uncategorized';
      counts[categoryName] = (counts[categoryName] || 0) + 1;
      return counts;
    }, {})).sort((left, right) => right[1] - left[1]);
    contentRoot.innerHTML = `
      <section class="intro">
        <div><div class="eyebrow">PROTOCOL INTELLIGENCE / ${escape(snapshotDate.toUpperCase())}</div><h1>Token launch radar</h1><p>Find protocols that record no token. Explore their implied value<br class="desktop-break"> and a practical route to participation.</p></div>
        <div class="intro-actions"><a href="#method" class="text-link">How we value a launch <span aria-hidden="true">↗</span></a></div>
      </section>
      <section class="metrics" aria-label="Research coverage">
        <div class="metric"><span class="label">Ranked candidates</span><strong>${radarData.rows.length}</strong><small>From ${radarData.universe} sealed protocol records</small></div>
        <div class="metric"><span class="label">Watchlist coverage</span><strong>${radarData.watchlist_count}<span class="fraction"> / ${radarData.watchlist_count}</span></strong><small>Every entry above the house floor</small></div>
        <div class="metric"><span class="label">Beyond the watchlist</span><strong>${radarData.rows.length - radarData.watchlist_count}</strong><small>Extended candidates to investigate</small></div>
        <div class="metric"><span class="label">Priced valuation peers</span><strong>${radarData.peer_count}</strong><small>${ratio(radarData.global_ratio)} pooled market cap / TVL</small></div>
      </section>
      <section class="research-banner" aria-label="Valuation context"><div class="banner-copy"><div class="banner-symbol" aria-hidden="true">↗</div><div><h2>Peer multiples adjusted for the protocol's footprint</h2><p>Implied values combine peer multiples, TVL momentum and tracking age. Token status and participation rights need verification before acting.</p></div></div><div class="banner-chart"><div class="chart-label"><span>CANDIDATES BY CATEGORY</span><span>${topCategories.length} SECTORS</span></div><div class="distribution" role="img" aria-label="${escape(topCategories.map(([category, count]) => `${category}, ${count} candidates`).join('. '))}">${topCategories.map(([category, count]) => `<span style="flex:${count}" title="${escape(category)} · ${count}"></span>`).join('')}</div><div class="chart-caption">${escape(
        topCategories.slice(0, 3).map(([category, count]) => `${category} ${count}`).join(' · '),
      )}</div></div></section>
      <section aria-label="Ranked launch board"><div class="board-heading"><h2>The launch board</h2><span class="muted">Implied circulating market cap · USD</span></div>
        <div class="scope-tabs" role="group" aria-label="Candidate scope">${[
          ['all', 'All candidates', radarData.rows.length],
          ['watchlist', 'Watchlist', radarData.watchlist_count],
          ['extended', 'Extended', radarData.rows.length - radarData.watchlist_count],
        ].map(([key, label, count]) =>
          `<button type="button" data-scope="${key}" class="${filters.scope === key ? 'active' : ''}" aria-pressed="${filters.scope === key}">${label}<span>${count}</span></button>`,
        ).join('')}</div>
        <div class="filters">
          <div class="filter-field"><label for="search">Search protocols</label><div class="search-wrap"><input id="search" type="search" value="${escape(filters.query)}" placeholder="Name, category or chain…" autocomplete="off"></div></div>
          <div class="filter-field"><label for="chain">Network</label><select id="chain">${options(chains, filters.chain, 'All networks')}</select></div>
          <div class="filter-field"><label for="category">Category</label><select id="category">${options(categories, filters.category, 'All categories')}</select></div>
          <div class="filter-field"><label for="floor">Minimum TVL</label><select id="floor"><option value="">Any size</option>${[
            ['50000000', '$50M+'], ['100000000', '$100M+'], ['500000000', '$500M+'],
          ].map(([value, label]) =>
            `<option value="${value}" ${filters.floor === value ? 'selected' : ''}>${label}</option>`,
          ).join('')}</select></div>
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
    document.getElementById('search').addEventListener('input', (event) => {
      filters.query = event.target.value;
      filters.page = 1;
      updateBoard();
    });
    for (const filterKey of ['chain', 'category', 'floor']) {
      document.getElementById(filterKey).addEventListener('change', (event) => {
        filters[filterKey] = event.target.value;
        filters.page = 1;
        updateBoard();
      });
    }
    document.getElementById('reset').addEventListener('click', resetFilters);
    contentRoot.querySelectorAll('[data-scope]').forEach((button) =>
      button.addEventListener('click', () => {
        filters.scope = button.dataset.scope;
        filters.page = 1;
        updateBoard();
      }),
    );
    contentRoot.querySelectorAll('[data-sort]').forEach((button) =>
      button.addEventListener('click', () => {
        filters.direction = filters.sort === button.dataset.sort
          ? -filters.direction : button.dataset.sort === 'name' ? 1 : -1;
        filters.sort = button.dataset.sort;
        filters.page = 1;
        updateBoard();
      }),
    );
    updateBoard();
  }

  function resetFilters() {
    Object.assign(filters, {
      query: '', chain: '', category: '', floor: '', scope: 'all', page: 1,
    });
    board();
  }

  function updateBoard() {
    const visibleRows = filteredRows();
    const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    filters.page = Math.min(filters.page, pageCount);
    const startIndex = (filters.page - 1) * pageSize;
    document.getElementById('result-count').textContent =
      `${visibleRows.length} ${visibleRows.length === 1 ? 'protocol' : 'protocols'} shown · ${filters.scope === 'all' ? 'full radar' : filters.scope + ' scope'}`;
    const chips = [
      filters.query && ['query', '“' + filters.query + '”'],
      filters.chain && ['chain', filters.chain],
      filters.category && ['category', filters.category],
      filters.floor && ['floor', money(Number(filters.floor)) + '+ TVL'],
    ].filter(Boolean);
    document.getElementById('chips').innerHTML = chips.map(([key, label]) =>
      `<button class="filter-chip" data-clear="${key}" aria-label="Remove ${escape(label)} filter">${escape(label)} ×</button>`,
    ).join('');
    contentRoot.querySelectorAll('[data-clear]').forEach((button) =>
      button.addEventListener('click', () => {
        filters[button.dataset.clear] = '';
        filters.page = 1;
        board();
      }),
    );
    contentRoot.querySelectorAll('[data-scope]').forEach((button) => {
      button.classList.toggle('active', button.dataset.scope === filters.scope);
      button.setAttribute('aria-pressed', String(button.dataset.scope === filters.scope));
    });
    contentRoot.querySelectorAll('[data-heading]').forEach((heading) => {
      const isSelected = heading.dataset.heading === filters.sort;
      heading.setAttribute('aria-sort', isSelected
        ? filters.direction === 1 ? 'ascending' : 'descending' : 'none');
      heading.querySelector('button').classList.toggle('selected', isSelected);
      heading.querySelector('span').textContent = isSelected
        ? filters.direction === 1 ? '↑' : '↓' : '↕';
    });
    document.getElementById('board-rows').innerHTML = visibleRows.length
      ? visibleRows.slice(startIndex, startIndex + pageSize).map((protocol) => `
      <tr><td class="rank-cell">${String(protocol.rank).padStart(2, '0')}</td><td class="protocol-cell"><div class="protocol-wrap">${avatar(protocol)}<div><a class="protocol-name" href="#protocol/${encodeURIComponent(protocol.slug)}">${escape(protocol.name)}</a><span class="protocol-meta">${protocol.watchlist ? '<span class="watch-dot">●</span>Watchlist' : 'Extended'} · ${protocol.confidence.toLowerCase()} confidence</span></div></div></td>
      <td><span class="category-tag">${escape(protocol.category || 'Uncategorized')}</span></td><td class="value-cell number"><strong>${money(protocol.implied_value_usd)}</strong><small>${money(protocol.low_usd)} – ${money(protocol.high_usd)}</small></td>
      <td class="number">${money(protocol.tvl_usd)}</td><td class="number ${changeClass(protocol.change_7d)}">${percent(protocol.change_7d)}</td>
      <td><span class="chain-list" title="${escape(protocol.chains.join(', '))}">${escape(filters.chain || protocol.chains[0] || 'Unreported')}${protocol.chains.length > 1 ? `<small>+${protocol.chains.length - 1}</small>` : ''}</span></td><td><span class="access-tag">${escape(protocol.access)}</span></td>
      <td><a class="open-row" href="#protocol/${encodeURIComponent(protocol.slug)}" aria-label="View ${escape(protocol.name)} details">↗</a></td></tr>`,
      ).join('')
      : '<tr><td colspan="9"><div class="empty"><h3>No protocols match these filters</h3><p>Try a broader network, category or TVL floor.</p><button id="empty-reset">Reset filters</button></div></td></tr>';
    document.getElementById('empty-reset')?.addEventListener('click', resetFilters);
    document.getElementById('table-footer').innerHTML =
      `<span>${visibleRows.length ? startIndex + 1 : 0}–${Math.min(startIndex + pageSize, visibleRows.length)} of ${visibleRows.length} protocols · ${radarData.watchlist_count}/${radarData.watchlist_count} watchlist records included in full board</span><div class="pagination"><button id="prev-page" aria-label="Previous page" ${filters.page === 1 ? 'disabled' : ''}>←</button><span>${filters.page} / ${pageCount}</span><button id="next-page" aria-label="Next page" ${filters.page === pageCount ? 'disabled' : ''}>→</button></div>`;
    document.getElementById('prev-page').addEventListener('click', () => {
      filters.page--;
      updateBoard();
    });
    document.getElementById('next-page').addEventListener('click', () => {
      filters.page++;
      updateBoard();
    });
    saveFilters();
  }

  function detail(slug) {
    const protocol = radarData.rows.find((candidate) => candidate.slug === slug);
    if (!protocol) {
      contentRoot.innerHTML = '<div class="missing"><h1>Protocol record unavailable</h1><a class="text-link" href="#board">Return to the launch board ↗</a></div>';
      return;
    }
    document.getElementById('breadcrumb').textContent = protocol.name;
    const valuationModel = protocol.model;
    contentRoot.innerHTML = `
      <a class="back-link" href="${escape(boardHash)}">← Back to launch board</a>
      <section class="detail-heading"><div class="detail-identity">${avatar(protocol)}<div><h1>${escape(protocol.name)}</h1><div class="detail-subtitle"><span>${escape(protocol.category || 'Uncategorized')}</span><span class="badge">${protocol.watchlist ? 'Watchlist' : 'Extended candidate'}</span><span>Snapshot records no token</span></div></div></div><span class="rank-badge">Rank ${protocol.rank} of ${radarData.rows.length}</span></section>
      <div class="detail-grid">
        <section class="card valuation-card"><div class="card-label">IMPLIED CIRCULATING MARKET CAP</div><div class="valuation-main"><strong class="valuation-amount" title="${dollars(protocol.implied_value_usd)}">${money(protocol.implied_value_usd)}</strong><span class="confidence">${protocol.confidence} confidence</span></div><p>Conditional value under the snapshot's operating footprint</p><div class="range-track" aria-hidden="true"></div><div class="range-labels"><span>${money(protocol.low_usd)} downside</span><span>Base case</span><span>${money(protocol.high_usd)} upside</span></div><div class="formula"><div><strong>${ratio(valuationModel.multiple)}</strong>Peer multiple</div><div><strong>${ratio(valuationModel.growth)}</strong>7d momentum</div><div><strong>${ratio(valuationModel.maturity)}</strong>Tracking maturity</div><div><strong>${ratio(valuationModel.rights)}</strong>Rights haircut</div></div></section>
        <section class="card"><div class="card-label">SNAPSHOT FUNDAMENTALS</div><dl class="facts-grid"><div><dt>Total value locked</dt><dd>${money(protocol.tvl_usd)}<small>${dollars(protocol.tvl_usd)}</small></dd></div><div><dt>7-day TVL change</dt><dd class="${changeClass(protocol.change_7d)}">${percent(protocol.change_7d)}<small>${protocol.change_7d === null ? 'Missing · neutral model factor' : 'Bounded to ±40% in model'}</small></dd></div><div><dt>Tracked since</dt><dd class="small">${escape(protocol.listed_at || 'Unreported')}<small>${protocol.age_days === null ? 'Unknown tracking age' : protocol.age_days.toLocaleString('en-US') + ' days at snapshot date'}</small></dd></div><div><dt>Recorded networks · ${protocol.chains.length}</dt><dd class="small">${escape(protocol.chains.join(', ') || 'Unreported')}</dd></div></dl></section>
        <section class="card farm-card"><div class="section-header"><div><h2>Participation plan</h2><p>A conditional research route · ${escape(protocol.access)} · review over 7–14 days</p></div><span class="badge">Start with verification</span></div><div class="farm-layout"><ol class="farm-steps">${protocol.farm_steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol><aside class="risk-box"><h3>Before allocating capital</h3>${protocol.warnings.map((warning) => `<p>${escape(warning)}</p>`).join('')}<div class="budget">Rewards unverified<small>Planning caps are illustrative. Principal can be lost.</small></div></aside></div></section>
        <section class="card peer-card"><div class="section-header"><div><h2>Trace the valuation</h2><p>TVL × blended peer multiple × momentum × maturity × rights haircut</p></div><a class="text-link" href="#method">Full method ↗</a></div><p class="muted">${valuationModel.peer_count} same-category priced ${valuationModel.peer_count === 1 ? 'peer' : 'peers'} · ${(valuationModel.category_weight * 100).toFixed(0)}% category weight · ${ratio(valuationModel.global_ratio)} pooled benchmark. ${valuationModel.peer_count < 3 ? 'Sparse peer evidence broadens the sensitivity range.' : 'Sensitivity is a fixed ±45% scenario band.'} ${protocol.confidence === 'Low' ? 'This record uses a fixed ±65% scenario band.' : ''}</p>${protocol.peers.length ? `<div class="table-scroll"><table aria-label="Same-category valuation peers"><thead><tr><th>Token-bearing peer</th><th>Market cap</th><th>TVL</th><th>Raw cap / TVL</th></tr></thead><tbody>${protocol.peers.map((peer) => `<tr><td>${escape(peer.name)}</td><td>${money(peer.mcap_usd)}</td><td>${money(peer.tvl_usd)}</td><td>${ratio(peer.ratio)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="board-note">No same-category peer is priced in this snapshot. The pooled benchmark supplies the entire multiple.</p>'}<p class="board-note">Peer ratios are clipped at the pooled 10th and 90th percentiles before taking medians. These bands express chosen assumptions. Launch timing, fully diluted value and reward allocation remain unestimated.</p></section>
      </div>`;
  }

  function method() {
    contentRoot.innerHTML = `<a class="back-link" href="${escape(boardHash)}">← Back to launch board</a><section class="method-intro"><div class="eyebrow">THE RESEARCH MODEL</div><h1>Valuation methodology</h1><p>Every estimate is reproducible from the sealed ${escape(snapshotDate)} snapshot. Values approximate a hypothetical circulating token market cap under the protocol's recorded footprint. They carry no claim about launch timing or token allocations.</p></section><div class="method-grid">
      <section class="card"><h2>From records to candidates</h2><p>All ${radarData.watchlist_count} house-watchlist records are retained. Additional records require null symbol, gecko_id and market cap. Category and name checks exclude bridges, liquid staking, wrappers, exchange products, versioned names and identified token-family products.</p><p>Watchlist records with product ambiguity stay visible with a 0.35 rights factor and observation-first steps. The sealed file omits parentProtocol. Extended candidates carry a verification warning.</p><p>${radarData.token_records} records identify a token by ticker or CoinGecko ID. They are excluded from candidates and can supply priced peers when eligible.</p></section>
      <section class="card"><h2>A conditional market-cap estimate</h2><div class="model-equation">TVL × peer multiple<br>× momentum × maturity × rights</div><p>TVL remains the recorded dollar amount. Supply, FDV, revenue, fees, token rights and unlocks are absent from the snapshot. Launch probability is left unestimated.</p><p>Missing tracking dates receive a 0.85 maturity factor. Missing growth receives a neutral 1.00 factor. Chain count receives no valuation premium.</p></section>
      <section class="card"><h2>Peer multiple</h2><ol><li>Use ${radarData.peer_count} token-bearing records with positive TVL and market cap, applying category and product-name exclusions.</li><li>Compute each market cap / TVL ratio. Clip ratios between ${ratio(radarData.ratio_bounds[0])} and ${ratio(radarData.ratio_bounds[1])}, the pooled 10th and 90th percentiles.</li><li>Take the median for the protocol's category and the pooled median of ${ratio(radarData.global_ratio)}.</li><li>Blend category × n/(n+6) with pooled × 6/(n+6). A category with no priced peers uses the pooled median.</li></ol></section>
      <section class="card"><h2>Bounded adjustments</h2><ul><li>Momentum equals 1 + clamp(7d TVL change, −40, 40) / 200. Its range is 0.80–1.20.</li><li>Maturity equals 0.75 + 0.25 × min(tracked days / 730, 1). The clock runs from listed_at to the snapshot date.</li><li>The rights factor is 0.35 for product ambiguity, 0.65 for curator and eligibility-gated routes, and 0.85 otherwise. These are subjective haircuts.</li><li>Values are rounded to whole dollars, sorted descending and tied by slug. Rank is global across all filters.</li></ul></section>
      <section class="card"><h2>Reading uncertainty</h2><p>Ranges are chosen sensitivity bands. They are ±65% when fewer than three same-category peers are available, tracking age is missing, or product status is ambiguous. Other records use ±45%.</p><p>Confidence labels describe evidence density. They are low for sparse peers, missing tracking age or product ambiguity, and moderate otherwise. Bands are scenario assumptions without statistical calibration.</p><p>TVL can be recursively counted and may represent assets with weak token value capture. Peer tokens can have very different circulating supplies.</p></section>
      <section class="card"><h2>Using participation plans</h2><p>Plans are generated from the protocol's category, name and recorded network. They specify a verification step, a bounded test, a review period and an exit. Budget caps are illustrative.</p><p>Curator routes verify the manager at a host vault. RWA routes check eligibility before funding. Derivatives begin with paper trading. Wrapper, network and staking-pool records begin with observation.</p><p>The snapshot includes no contracts, fee quotes, points program or airdrop terms. Verify each live route independently before using it.</p></section>
    </div>`;
  }

  function render() {
    const routeHash = location.hash.slice(1);
    const viewName = routeHash.startsWith('protocol/')
      ? 'detail' : routeHash === 'method' ? 'method' : 'board';
    document.getElementById('nav-board').classList.toggle('active', viewName !== 'method');
    document.getElementById('nav-method').classList.toggle('active', viewName === 'method');
    document.getElementById('breadcrumb').textContent = viewName === 'method' ? 'Methodology' : 'Launch board';
    if (viewName === 'board') {
      parseFilters();
      board();
    }
    if (viewName === 'detail') {
      let protocolSlug = '';
      try {
        protocolSlug = decodeURIComponent(routeHash.slice(9));
      } catch {
        protocolSlug = '';
      }
      detail(protocolSlug);
    }
    if (viewName === 'method') method();
    if (previousView !== routeHash) window.scrollTo(0, 0);
    previousView = routeHash;
    document.title = viewName === 'detail'
      ? `${document.getElementById('breadcrumb').textContent} — Token Radar`
      : 'Token Radar — ' + (viewName === 'method' ? 'Methodology' : 'Launch board');
  }

  window.addEventListener('hashchange', render);
  render();
})();
