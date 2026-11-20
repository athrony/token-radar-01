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

function farmPlan(protocol: Protocol, ambiguity: boolean): string[] {
  const chain = protocol.chains[0] ?? "the recorded network";
  const identity = `Verify ${protocol.name}'s official app, deployment on ${chain}, and any existing governance token before signing. The sealed record supplies no contract addresses, incentives or eligibility rules. Budget 15–30 minutes for this check.`;
  const budget = `Choose one recorded chain (${chain}) and a $25–$100 learning budget. Reserve up to $10 separately for gas and fees, stop if costs exceed that cap, and avoid bridging solely for speculative rewards. These are planning caps, with no quoted fee or APY.`;
  const close = `After 7–14 days, inspect receipts, realized fees and withdrawal availability. Test a full exit, revoke unused approvals, and log the result. Continue only for product utility within your budget. Any token allocation requires separately published terms.`;
  switch (ambiguity ? "Observation" : protocol.category) {
    case "Lending":
    case "Uncollateralized Lending":
      return [
        identity,
        budget,
        `On ${protocol.name}, check the supplied asset's liquidity, utilization, oracle and collateral rules. If access is open, supply $25–$100 to one market and save its receipt. Keep borrowing disabled during this 20-minute first session.`,
        `Return once after 7 days to review utilization and supply interest. Withdraw $5 to test liquidity before adding capital. A supply position can lose principal through asset depegs, bad debt or contract failures.`,
        close,
      ];
    case "Dexs":
    case "Liquidity Manager":
      return [
        identity,
        budget,
        `If ${protocol.name} offers a public pool on ${chain}, quote one $10–$25 spot swap in a liquid pair and inspect the minimum received. Set a 0.5% slippage ceiling, reject a worse quote, execute once and record total fees.`,
        `After reviewing both assets, you may put at most $25 into one liquid pool for 7 days. Record the deposit ratio and compare the exit value against holding the assets. Budget for two gas transactions and impermanent loss.`,
        close,
      ];
    case "Risk Curators":
      return [
        identity,
        budget,
        `Find a vault explicitly managed by ${protocol.name} on ${chain} and confirm the curator in the host app's onchain configuration. Read collateral caps, curator powers and exit liquidity. Allow 30 minutes and stop if that attribution cannot be verified.`,
        `If the host vault is open, supply $25–$100 to a single liquid market. Save the host address and receipt, hold for 7 days, then test a $5 withdrawal. Depositing in a curator's vault provides no evidence of rewards from the curator itself.`,
        close,
      ];
    case "RWA":
    case "CeDeFi":
      return [
        identity,
        `Read ${protocol.name}'s investor eligibility, jurisdiction, KYC, minimum subscription and redemption documents. Spend 30 minutes on review with $0 deployed. Treat access as gated until the issuer confirms all of these terms.`,
        `If eligible, obtain the exact subscription, custody and redemption fee schedule. Compare the required minimum with a $100 personal cap. If it exceeds the cap, keep a paper record and stop before transferring funds.`,
        `Only after approval, test the smallest permitted subscription on ${chain} and record settlement time. Review custody and counterparty exposure after 7 days, then request a permitted redemption. Reserve the disclosed exit fee in advance.`,
        close,
      ];
    case "OTC Marketplace":
    case "Crypto Card Issuer":
      return [
        identity,
        `Review ${protocol.name}'s account eligibility, KYC, custody, regional access and fee schedule for 30 minutes with $0 funded. Confirm withdrawal or account-closure rules before completing any onboarding.`,
        `If eligible, test only an ordinary service you need, capped at $10–$25 plus at most $2 in disclosed service fees. Verify settlement and retain the receipt. Stop if the minimum balance or order is larger than your cap.`,
        `After 7 days, reconcile the settlement, withdraw unused balances and remove unused spending permissions. Check for recurring account fees. Product activity carries no documented future-token entitlement in this snapshot.`,
        close,
      ];
    case "Collateral Markets":
    case "Restaking":
      return [
        identity,
        `Read ${protocol.name}'s vault collateral, slashing conditions, operator permissions and withdrawal delay for 30 minutes with $0 deployed. Identify whether the position is a receipt for an existing asset before discussing any independent protocol token.`,
        `If a public route and acceptable exit exist, cap one deposit at $25–$50 on ${chain}, plus up to $10 in fees. Avoid recursive borrowing. Record the slashing exposure and exact earliest withdrawal date before depositing.`,
        `Review the position after 7 days and submit a small withdrawal request if permitted. Wait through the documented exit delay before closing the test. Stop if the minimum deposit exceeds your cap or slashing conditions remain unclear.`,
        close,
      ];
    case "Insurance":
      return [
        identity,
        `Inspect ${protocol.name}'s coverage or underwriting terms for 30 minutes at $0 cost. Identify covered events, exclusions, claims discretion and whether a public participation route exists. Verify any collateral receipt and its underlying asset.`,
        `For coverage you actually need, request a quote capped at $10 in premium. If considering underwriting instead, paper-test the loss and lockup with $0 first. Do not fund until the claim process and maximum principal loss are understood.`,
        `After 7 days, review policy validity or underwriting status and save the terms. Test withdrawal only when the documented lockup permits it. Include premiums, gas and possible denied claims in the cost log.`,
        close,
      ];
    case "Governance Incentives":
      return [
        identity,
        `Read ${protocol.name}'s incentive source, voting asset, lock period and withdrawal rules for 20–30 minutes. Start with $0 committed. Identify whether rewards require an existing token and whether reward terms are actually published.`,
        `If an open route exists, model one $25 position and its exit penalty on paper. Only use a live lock if its full duration fits your budget and time horizon. Stop if participation depends on an unverified new-token promise.`,
        `Review the position after 7 days, record any published reward calculation and schedule the earliest permitted exit. Reserve gas within a $10 cap. The review period does not shorten a protocol lockup.`,
        close,
      ];
    case "Leveraged Farming":
    case "Basis Trading":
      return [
        identity,
        budget,
        `Paper-test ${protocol.name}'s strategy for 30 minutes with $0 committed. Map borrowing, funding rates, hedge venues, custody and liquidation exposure. Use an unlevered public route only if the app explicitly supports one.`,
        `If the unlevered route is verified, cap a test at $25–$50 for 7 days and save its receipt. Otherwise remain on paper. Track funding or hedge costs, collateral health and exit liquidity. A strategy can carry internal leverage even without user borrowing.`,
        close,
      ];
    case "Derivatives":
    case "Interest Rate Derivatives":
    case "Prediction Market":
      return [
        identity,
        `Check ${protocol.name}'s market access, jurisdiction and settlement rules for 20 minutes. Use a demo or paper position first with $0 at risk. If local access or the loss calculation is unclear, stop at observation.`,
        `If permitted and understood, cap one fully collateralized position at $10–$25, with total trading costs below $2. Read funding, settlement and liquidation terms before placing an order. Skip leverage and volume-for-rewards loops.`,
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
        `If you choose a live test, cap collateral at $100 and debt at $20, subject to stricter protocol minimums and collateral rules. Record a stressed collateral price, accrued fee and repayment amount. Stop if the minimum position exceeds your cap.`,
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
        `Observe ${protocol.name}'s network or product documentation for 30 minutes with $0 committed. Confirm whether activity concerns an existing network asset, receipt token or separate protocol, and whether any governance rights are documented.`,
        `If a public test environment exists, try one transfer or deposit-and-withdraw simulation there. If only mainnet exists, inspect a sample transaction first. Keep any optional live transfer below $10 plus a $2 fee cap.`,
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
        `If open, deposit $25–$100 into one unlevered strategy and retain the receipt. Hold for 7 days while checking share value and queue conditions. Test a $5 redemption before committing more, and allow for strategy, depeg and manager risk.`,
        close,
      ];
    default:
      return [
        identity,
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
      const uncertainty =
        sameCategory.length < 3 || days === null || ambiguity ? 0.65 : 0.45;
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
        low_usd: Math.max(1, Math.round(value * (1 - uncertainty))),
        high_usd: Math.round(value * (1 + uncertainty)),
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
        })),
        warnings,
        farm_steps: farmPlan(protocol, ambiguity),
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
