export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

const excludedCategories = new Set([
  "Bridge",
  "Canonical Bridge",
  "Cross Chain Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
  "Staking Pool",
  "Stablecoin Wrapper",
  "Anchor BTC",
  "Decentralized BTC",
]);
const productName =
  /\b(wrapped|staked|staking)\b|^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)|\s(v\d+(\.\d+)?|\d+\.\d+)$/i;
const familyProduct =
  /^(gmx-|ipor-|kava-|manta-|solv-|hyperbeat-|flying-tulip-|valantis-|bitlayer-|bouncebit-|cian-|stellar-|xrpl-|bittensor-)|-(aveth|avusd|aflp|thbill|thusd|ftusd)$/;

export function quantile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return (
    sorted[lower]! +
    (sorted[Math.ceil(position)]! - sorted[lower]!) * (position - lower)
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function ageDays(protocol: Protocol, asOf: string): number | null {
  if (protocol.listed_at === null) return null;
  return Math.max(
    0,
    Math.floor(
      (Date.parse(asOf) - Date.parse(protocol.listed_at)) / 86_400_000,
    ),
  );
}

function route(category: string | null): string {
  if (category === "Risk Curators") return "Curated vault";
  if (
    category === "RWA" ||
    category === "CeDeFi" ||
    category === "OTC Marketplace" ||
    category === "Crypto Card Issuer"
  )
    return "Eligibility check";
  if (
    category === "Chain" ||
    category === "Payments" ||
    category === "Staking Pool" ||
    category === "Stablecoin Wrapper"
  )
    return "Observe first";
  if (
    category === "Derivatives" ||
    category === "Prediction Market" ||
    category === "Interest Rate Derivatives"
  )
    return "Trading route";
  return "Onchain route";
}

interface FarmBudget {
  band: "low";
  capital_cap_usd: number;
  fee_cap_usd: number;
  review_days: number;
}

const farmRouteCaps: Record<string, number> = {
  Lending: 100, "Uncollateralized Lending": 100,
  Dexs: 25, "Liquidity Manager": 25, "Risk Curators": 100,
  RWA: 100, CeDeFi: 100, "OTC Marketplace": 25, "Crypto Card Issuer": 25,
  "Collateral Markets": 50, Restaking: 50, Insurance: 10,
  "Governance Incentives": 25, "Leveraged Farming": 50, "Basis Trading": 50,
  Derivatives: 25, "Interest Rate Derivatives": 25, "Prediction Market": 25,
  CDP: 100, "Dual-Token Stablecoin": 100, "CDP Manager": 100,
  Yield: 100, "Yield Aggregator": 100, "Onchain Capital Allocator": 100,
  Indexes: 100, Farm: 100,
};

function farmPlan(protocol: Protocol, ambiguity: boolean, lowValue: number, planBudget: FarmBudget): string[] {
  const chain = protocol.chains[0] ?? "the recorded network";
  const cap = planBudget.capital_cap_usd;
  const identity = `Verify ${protocol.name}'s official documentation, deployment on ${chain}, existing token status and withdrawal route before connecting. Cross-check the app's contract against its documentation and record the source and date. Stop if they disagree. Allow 20–30 minutes with $0 deployed; the sealed snapshot supplies no addresses or incentive terms.`;
  const budget = `Assume the LOW valuation band ($${lowValue.toLocaleString("en-US")}) for cost planning. The illustrative rule takes one millionth of low implied USD, clamps it to $10–$100, then applies the product-route cap. Principal is capped at $${cap} and separate fees at $${planBudget.fee_cap_usd} on ${chain}. This convention predicts no rewards or return. Stay on paper if live minimums or fees exceed either cap.`;
  const close = `Review receipts, asset value, fees and exit availability after 24 hours and on day ${planBudget.review_days}; save dated observations. At the planned exit, close the full test, repay any debt plus fees, and withdraw unused collateral. Respect lockup and settlement dates, verify wallet balances and revoke unused approvals. Log costs or delayed redemptions. Continue only for product utility within your cap.`;
  switch (ambiguity ? "Observation" : protocol.category) {
    case "Lending":
    case "Uncollateralized Lending":
      return [
        identity,
        budget,
        `On ${protocol.name}, check one market's asset, liquidity, utilization, oracle and collateral rules. Save deposit and redemption previews. If access is verified, supply at most $${cap} and record the receipt and share balance. Keep borrowing disabled and remain on paper if withdrawal liquidity is unclear.`,
        `Return once after 7 days to review utilization and supply interest. Withdraw $5 to test liquidity before adding capital. A supply position can lose principal through asset depegs, bad debt or contract failures.`,
        close,
      ];
    case "Dexs":
    case "Liquidity Manager":
      return [
        identity,
        budget,
        `Find a documented ${protocol.name} pool on ${chain}. Check both asset contracts, pool depth and fees; quote one swap within $${cap}. Reject slippage above 0.5% or fees above the separate cap. Record the minimum received before signing.`,
        `Choose either that single swap or one liquidity position within the same $${cap} total principal cap. For liquidity, save the entry ratio, fee tier and range and compare an exit preview against holding both assets. Review after 7 days; avoid repeated volume loops.`,
        close,
      ];
    case "Risk Curators":
      return [
        identity,
        budget,
        `Find a vault explicitly managed by ${protocol.name} on ${chain} and confirm the curator in the host app's onchain configuration. Read collateral caps, curator powers and exit liquidity. Allow 30 minutes and stop if that attribution cannot be verified.`,
        `If the host vault accepts public deposits, preview and supply at most $${cap} to one vault. Save the host contract, receipt and share balance; preview a redemption immediately and test a small exit on day 7. A host-vault deposit establishes no curator reward entitlement.`,
        close,
      ];
    case "RWA":
    case "CeDeFi":
      return [
        identity,
        budget,
        `Read ${protocol.name}'s investor eligibility, jurisdiction, KYC, minimum subscription and redemption documents. Spend 30 minutes on review with $0 deployed. Treat access as gated until the issuer confirms all of these terms.`,
        `After written eligibility approval, obtain exact subscription, custody and redemption quotes. Compare minimum principal with $${cap} and all fees with $${planBudget.fee_cap_usd}. If either is too large, retain a $0 paper quote. Record settlement and earliest permitted exit dates before funding.`,
        `Only after approval, test the smallest permitted subscription on ${chain} and record settlement time. Review custody and counterparty exposure after 7 days, then request a permitted redemption. Reserve the disclosed exit fee in advance.`,
        close,
      ];
    case "OTC Marketplace":
    case "Crypto Card Issuer":
      return [
        identity,
        budget,
        `Review ${protocol.name}'s account eligibility, KYC, custody, regional access and fee schedule for 30 minutes with $0 funded. Confirm withdrawal or account-closure rules before completing any onboarding.`,
        `After access is approved, test one ordinary service you need within $${cap} principal and $${planBudget.fee_cap_usd} total disclosed fees. Save the quote, settlement receipt and account-closure instructions. Stay on paper if a minimum balance or order exceeds the cap.`,
        `After 7 days, reconcile the settlement, withdraw unused balances and remove unused spending permissions. Check for recurring account fees. Product activity carries no documented future-token entitlement in this snapshot.`,
        close,
      ];
    case "Collateral Markets":
    case "Restaking":
      return [
        identity,
        budget,
        `Read ${protocol.name}'s vault collateral, slashing conditions, operator permissions and withdrawal delay for 30 minutes with $0 deployed. Identify whether the position is a receipt for an existing asset before discussing any independent protocol token.`,
        `If a public route and acceptable exit exist, preview one deposit within $${cap} on ${chain} and $${planBudget.fee_cap_usd} in separate fees. Record the receipt, operator, slashing exposure and earliest withdrawal date before signing. Avoid recursive borrowing.`,
        `Review the position after 7 days and submit a small withdrawal request if permitted. Wait through the documented exit delay before closing the test. Stop if the minimum deposit exceeds your cap or slashing conditions remain unclear.`,
        close,
      ];
    case "Insurance":
      return [
        identity,
        budget,
        `Inspect ${protocol.name}'s coverage or underwriting terms for 30 minutes at $0 cost. Identify covered events, exclusions, claims discretion and whether a public participation route exists. Verify any collateral receipt and its underlying asset.`,
        `For a risk you actually need covered, request one policy within $${cap} premium and $${planBudget.fee_cap_usd} fees. Save policy dates, wording and claim instructions. Model underwriting separately at $0 until its principal loss and lockup are understood.`,
        `After 7 days, review policy validity or underwriting status and save the terms. Test withdrawal only when the documented lockup permits it. Include premiums, gas and possible denied claims in the cost log.`,
        close,
      ];
    case "Governance Incentives":
      return [
        identity,
        budget,
        `Read ${protocol.name}'s incentive source, voting asset, lock period and withdrawal rules for 20–30 minutes. Start with $0 committed. Identify whether rewards require an existing token and whether reward terms are actually published.`,
        `Model one position of at most $${cap} and its full-duration exit penalty on paper. Save the published reward formula and earliest exit date. Use a live lock only when its minimum and duration fit your caps and horizon; an undocumented new-token promise is a stop condition.`,
        `Review the position after 7 days, record any published reward calculation and schedule the earliest permitted exit. Reserve gas within the $${planBudget.fee_cap_usd} fee cap. The review period does not shorten a protocol lockup.`,
        close,
      ];
    case "Leveraged Farming":
    case "Basis Trading":
      return [
        identity,
        budget,
        `Paper-test ${protocol.name}'s strategy for 30 minutes with $0 committed. Map borrowing, funding rates, hedge venues, custody and liquidation exposure. Use an unlevered public route only if the app explicitly supports one.`,
        `Only through a verified unlevered route, cap one test at $${cap} for 7 days and save its receipt and an exit quote. Otherwise remain on paper. Record stressed funding costs and collateral health. Internal strategy leverage can still transmit losses to a depositor.`,
        close,
      ];
    case "Derivatives":
    case "Interest Rate Derivatives":
    case "Prediction Market":
      return [
        identity,
        budget,
        `Check ${protocol.name}'s market access, jurisdiction and settlement rules for 20 minutes. Use a demo or paper position first with $0 at risk. If local access or the loss calculation is unclear, stop at observation.`,
        `If permitted and understood, use one fully collateralized position within $${cap}, with total costs within $${planBudget.fee_cap_usd}. Save the maximum loss, order receipt and settlement date before placing it. Skip extra leverage and volume-for-rewards loops.`,
        `Close or settle the position after the planned session, withdraw unused collateral and log every fee. Do one meaningful test over a 7-day review window. Account activity carries no recorded entitlement to a token.`,
        close,
      ];
    case "CDP":
    case "Dual-Token Stablecoin":
    case "CDP Manager":
      return [
        identity,
        budget,
        `Review ${protocol.name}'s collateral, oracle, liquidation threshold, stability fee and peg mechanism. Use its simulator for 20 minutes. If minting requires debt, keep the first session as a $0 paper position until the repayment path is clear.`,
        `If choosing a live test, cap collateral at $${cap} and debt at $${Math.min(20, Math.floor(cap / 5))}, subject to stricter protocol collateral rules. Save a stressed collateral price, repayment and withdrawal previews. Hold repayment assets and gas separately; stay on paper if the minimum exceeds your cap.`,
        `Within 7 days, repay debt plus fees and withdraw collateral before closing the test. Keep the repayment asset and gas available throughout. A CDP position has liquidation, oracle and stablecoin depeg exposure.`,
        close,
      ];
    case "Observation":
    case "Chain":
    case "Payments":
    case "Staking Pool":
    case "Stablecoin Wrapper":
      return [
        identity,
        budget,
        `Observe ${protocol.name}'s network or product documentation for 30 minutes with $0 committed. Confirm whether activity concerns an existing network asset, receipt token or separate protocol, and whether any governance rights are documented.`,
        `Use a documented test environment to simulate one transfer or deposit and its reversal. If only mainnet exists, inspect a sample transaction and keep a paper record. Preserve the $0 capital cap while product identity or independent participation rights remain ambiguous.`,
        `After 7 days, review the product's status and archive transaction identifiers. Keep this entry on observation unless an independently verified participation route and explicit eligibility terms appear. Existing asset usage alone establishes no new-token claim.`,
        close,
      ];
    case "Yield":
    case "Yield Aggregator":
    case "Onchain Capital Allocator":
    case "Indexes":
    case "Farm":
      return [
        identity,
        budget,
        `Inspect ${protocol.name}'s asset strategy, accepted collateral, manager permissions and withdrawal queue on ${chain}. Spend 20–30 minutes checking how returns and losses reach depositors. Confirm that a public deposit route actually exists.`,
        `If a public unlevered route is verified, preview one deposit no larger than $${cap}, save the receipt and share value, and preview a small redemption. Recheck manager permissions and the withdrawal queue on day 7. Stay on paper if strategy or exit liquidity cannot be verified.`,
        close,
      ];
    default:
      return [
        identity,
        budget,
        `Spend 30 minutes reviewing ${protocol.name}'s product documentation with $0 committed. The snapshot category does not establish a supported participation route, so verify the actual product and exit mechanism before considering any transaction.`,
        `If a public test environment is documented, simulate one core interaction there and save the receipt. Revisit after 7 days to review published access and eligibility terms. Keep capital deployment at $0 while the route remains unverified.`,
        close,
      ];
  }
}

export function buildRadar(snapshot: Snapshot) {
  const watchlist = new Set(snapshot.watchlist);
  const peers = snapshot.protocols.filter(
    (protocol) =>
      (protocol.gecko_id !== null || protocol.symbol !== null) &&
      protocol.mcap_usd !== null &&
      protocol.mcap_usd > 0 &&
      protocol.tvl_usd > 0 &&
      !excludedCategories.has(protocol.category ?? "") &&
      !productName.test(protocol.name),
  );
  if (peers.length < 3)
    throw new Error(
      "At least three token-bearing valuation peers are required.",
    );
  const ratios = peers.map((protocol) => protocol.mcap_usd! / protocol.tvl_usd);
  const lower = quantile(ratios, 0.1);
  const upper = quantile(ratios, 0.9);
  const globalRatio = quantile(
    ratios.map((value) => clamp(value, lower, upper)),
    0.5,
  );
  const clippedRatios = ratios.map((value) => clamp(value, lower, upper));
  const pooledLow = quantile(clippedRatios, 0.25);
  const pooledHigh = quantile(clippedRatios, 0.75);
  const candidates = snapshot.protocols.filter(
    (protocol) =>
      watchlist.has(protocol.slug) ||
      (protocol.gecko_id === null &&
        protocol.symbol === null &&
        protocol.mcap_usd === null &&
        !excludedCategories.has(protocol.category ?? "") &&
        !productName.test(protocol.name) &&
        !familyProduct.test(protocol.slug)),
  );
  const rows = candidates
    .map((protocol) => {
      if (protocol.gecko_id !== null || protocol.symbol !== null)
        throw new Error("Watchlist contains a token-bearing record.");
      const sameCategory = peers.filter(
        (peer) => peer.category === protocol.category,
      );
      const categoryRatio = sameCategory.length
        ? quantile(
            sameCategory.map((peer) =>
              clamp(peer.mcap_usd! / peer.tvl_usd, lower, upper),
            ),
            0.5,
          )
        : globalRatio;
      const weight = sameCategory.length / (sameCategory.length + 6);
      const multiple = categoryRatio * weight + globalRatio * (1 - weight);
      const days = ageDays(protocol, snapshot.as_of);
      const growth =
        protocol.change_7d === null
          ? 1
          : 1 + clamp(protocol.change_7d, -40, 40) / 200;
      const maturity =
        days === null ? 0.85 : 0.75 + 0.25 * Math.min(days / 730, 1);
      const ambiguity =
        excludedCategories.has(protocol.category ?? "") ||
        productName.test(protocol.name) ||
        familyProduct.test(protocol.slug);
      const access = ambiguity ? "Observe first" : route(protocol.category);
      const rights = ambiguity
        ? 0.35
        : access === "Eligibility check" || access === "Curated vault"
          ? 0.65
          : 0.85;
      const value = Math.max(
        1,
        Math.round(protocol.tvl_usd * multiple * growth * maturity * rights),
      );
      const categoryRatios = sameCategory.map((peer) => clamp(peer.mcap_usd! / peer.tvl_usd, lower, upper));
      const categoryLow = sameCategory.length ? quantile(categoryRatios, 0.25) : pooledLow;
      const categoryHigh = sameCategory.length ? quantile(categoryRatios, 0.75) : pooledHigh;
      const lowMultiple = Math.min(multiple, categoryLow * weight + pooledLow * (1 - weight));
      const highMultiple = Math.max(multiple, categoryHigh * weight + pooledHigh * (1 - weight));
      const lowValue = Math.max(1, Math.round(protocol.tvl_usd * lowMultiple * growth * maturity * rights));
      const highValue = Math.max(value, Math.round(protocol.tvl_usd * highMultiple * growth * maturity * rights));
      const rightsRationale = ambiguity
        ? "0.35 rights factor retains 35% of the footprint estimate because this record may represent an existing-asset product or token family. Independent governance rights require verification."
        : access === "Eligibility check" || access === "Curated vault"
          ? "0.65 rights factor retains 65% because access depends on eligibility or a host curator vault. Using the product does not establish ownership of protocol-level rights."
          : "0.85 rights factor retains 85% because token rights and value capture remain unspecified. Public onchain activity alone establishes no allocation entitlement.";
      const routeCap = ambiguity ? 0 : (farmRouteCaps[protocol.category ?? ""] ?? 0);
      const capitalCap = Math.min(routeCap, Math.round(clamp(lowValue / 1_000_000, 10, 100)));
      const farmBudget: FarmBudget = {
        band: "low",
        capital_cap_usd: capitalCap,
        fee_cap_usd: capitalCap === 0 ? 0 : access === "Trading route" || routeCap <= 25 ? 2 : 10,
        review_days: 7,
      };
      const comparisonPool = sameCategory.length ? sameCategory : peers;
      const comparisonPeers = [...comparisonPool].sort((left, right) =>
        Math.abs(clamp(left.mcap_usd! / left.tvl_usd, lower, upper) - multiple) -
        Math.abs(clamp(right.mcap_usd! / right.tvl_usd, lower, upper) - multiple) ||
        left.slug.localeCompare(right.slug, "en"),
      ).slice(0, 5);
      const warnings = [
        "Snapshot records no token. Current token status, launch intent and allocation are unverified.",
        "TVL can overlap across protocols. Revenue, supply, unlocks and token value capture are absent.",
      ];
      if (!watchlist.has(protocol.slug))
        warnings.push(
          "Extended candidate. The sealed file omits parentProtocol, so independent protocol status needs verification.",
        );
      if (ambiguity)
        warnings.push(
          "Watchlist product or existing-asset ambiguity. Verify separate governance rights before any live activity.",
        );
      if (sameCategory.length < 3)
        warnings.push(
          `Only ${sameCategory.length} same-category priced peers. The estimate relies heavily on the pooled benchmark.`,
        );
      if (protocol.change_7d === null)
        warnings.push(
          "Seven-day TVL change is missing. The momentum factor is neutral.",
        );
      if (days === null)
        warnings.push(
          "Tracking start is missing. The model uses a conservative 0.85 maturity factor.",
        );
      return {
        ...protocol,
        rank: 0,
        implied_value_usd: value,
        base_usd: value,
        low_usd: lowValue,
        high_usd: highValue,
        band_width_pct: Number(((highValue - lowValue) / value * 100).toFixed(1)),
        band_basis: sameCategory.length ? "Blended category / pool quartiles" : "Pooled peer quartiles",
        band: {
          low_multiple: lowMultiple,
          base_multiple: multiple,
          high_multiple: highMultiple,
          category_q25: categoryLow,
          category_q75: categoryHigh,
          pooled_q25: pooledLow,
          pooled_q75: pooledHigh,
        },
        rights_rationale: rightsRationale,
        farm_budget: farmBudget,
        watchlist: watchlist.has(protocol.slug),
        access,
        ambiguity,
        age_days: days,
        confidence:
          ambiguity || sameCategory.length < 3 || days === null
            ? "Low"
            : "Moderate",
        model: {
          multiple,
          category_ratio: categoryRatio,
          global_ratio: globalRatio,
          category_weight: weight,
          peer_count: sameCategory.length,
          growth,
          maturity,
          rights,
        },
        peers: sameCategory.map((peer) => ({
          slug: peer.slug,
          name: peer.name,
          tvl_usd: peer.tvl_usd,
          mcap_usd: peer.mcap_usd,
          ratio: peer.mcap_usd! / peer.tvl_usd,
          used_ratio: clamp(peer.mcap_usd! / peer.tvl_usd, lower, upper),
        })),
        comparison_source: sameCategory.length ? "same-category" : "pooled",
        comparison_count: comparisonPool.length,
        comparison_peers: comparisonPeers.map((peer) => ({
          slug: peer.slug,
          name: peer.name,
          category: peer.category,
          tvl_usd: peer.tvl_usd,
          mcap_usd: peer.mcap_usd,
          ratio: peer.mcap_usd! / peer.tvl_usd,
          used_ratio: clamp(peer.mcap_usd! / peer.tvl_usd, lower, upper),
        })),
        warnings,
        farm_steps: farmPlan(protocol, ambiguity, lowValue, farmBudget),
      };
    })
    .sort(
      (left, right) =>
        right.implied_value_usd - left.implied_value_usd ||
        left.slug.localeCompare(right.slug, "en"),
    );
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    source: snapshot.source,
    universe: snapshot.protocols.length,
    token_records: snapshot.protocols.filter(
      (protocol) => protocol.gecko_id !== null || protocol.symbol !== null,
    ).length,
    watchlist_count: snapshot.watchlist.length,
    peer_count: peers.length,
    global_ratio: globalRatio,
    ratio_bounds: [lower, upper],
    rows,
  };
}
