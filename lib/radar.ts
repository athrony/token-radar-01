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
  'Bridge', 'Canonical Bridge', 'Cross Chain Bridge',
  'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX',
  'Staking Pool', 'Stablecoin Wrapper', 'Anchor BTC', 'Decentralized BTC',
]);
const productName = /\b(wrapped|staked|staking)\b|^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)|\s(v\d+(\.\d+)?|\d+\.\d+)$/i;
const familyProduct = /^(gmx-|ipor-|kava-|manta-|solv-|hyperbeat-|flying-tulip-|valantis-|bitlayer-|bouncebit-|cian-|stellar-|xrpl-|bittensor-)|-(aveth|avusd|aflp|thbill|thusd|ftusd)$/;

export function quantile(values: number[], fraction: number): number {
  const sortedValues = [...values].sort((left, right) => left - right);
  const percentilePosition = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(percentilePosition);
  return sortedValues[lowerIndex]! +
    (sortedValues[Math.ceil(percentilePosition)]! - sortedValues[lowerIndex]!) *
    (percentilePosition - lowerIndex);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function ageDays(record: Protocol, asOf: string): number | null {
  if (record.listed_at === null) return null;
  return Math.max(0, Math.floor(
    (Date.parse(asOf) - Date.parse(record.listed_at)) / 86_400_000,
  ));
}

function route(category: string | null): string {
  if (category === 'Risk Curators') return 'Curated vault';
  if (category === 'RWA' || category === 'CeDeFi' ||
      category === 'OTC Marketplace' || category === 'Crypto Card Issuer')
    return 'Eligibility check';
  if (category === 'Chain' || category === 'Payments' ||
      category === 'Staking Pool' || category === 'Stablecoin Wrapper')
    return 'Observe first';
  if (category === 'Derivatives' || category === 'Prediction Market' ||
      category === 'Interest Rate Derivatives')
    return 'Trading route';
  return 'Onchain route';
}

function farmPlan(record: Protocol, ambiguity: boolean): string[] {
  const network = record.chains[0] ?? 'the recorded network';
  const verifyStep = `Verify ${record.name}'s official app, deployment on ${network}, and any existing governance token before signing. The sealed record supplies no contract addresses, incentives or eligibility rules. Budget 15–30 minutes for this check.`;
  const learningBudget = `Choose one recorded chain (${network}) and a $25–$100 learning budget. Reserve up to $10 separately for gas and fees, stop if costs exceed that cap, and avoid bridging solely for speculative rewards. These are planning caps, with no quoted fee or APY.`;
  const exitStep = `After 7–14 days, inspect receipts, realized fees and withdrawal availability. Test a full exit, revoke unused approvals, and log the result. Continue only for product utility within your budget. Any token allocation requires separately published terms.`;
  switch (ambiguity ? 'Observation' : record.category) {
    case 'Lending':
    case 'Uncollateralized Lending':
      return [verifyStep, learningBudget,
        `On ${record.name}, check the supplied asset's liquidity, utilization, oracle and collateral rules. If access is open, supply $25–$100 to one market and save its receipt. Keep borrowing disabled during this 20-minute first session.`,
        `Return once after 7 days to review utilization and supply interest. Withdraw $5 to test liquidity before adding capital. A supply position can lose principal through asset depegs, bad debt or contract failures.`,
        exitStep];
    case 'Dexs':
    case 'Liquidity Manager':
      return [verifyStep, learningBudget,
        `If ${record.name} offers a public pool on ${network}, quote one $10–$25 spot swap in a liquid pair and inspect the minimum received. Set a 0.5% slippage ceiling, reject a worse quote, execute once and record total fees.`,
        `After reviewing both assets, you may put at most $25 into one liquid pool for 7 days. Record the deposit ratio and compare the exit value against holding the assets. Budget for two gas transactions and impermanent loss.`,
        exitStep];
    case 'Risk Curators':
      return [verifyStep, learningBudget,
        `Find a vault explicitly managed by ${record.name} on ${network} and confirm the curator in the host app's onchain configuration. Read collateral caps, curator powers and exit liquidity. Allow 30 minutes and stop if that attribution cannot be verified.`,
        `If the host vault is open, supply $25–$100 to a single liquid market. Save the host address and receipt, hold for 7 days, then test a $5 withdrawal. Depositing in a curator's vault provides no evidence of rewards from the curator itself.`,
        exitStep];
    case 'RWA':
    case 'CeDeFi':
      return [verifyStep,
        `Read ${record.name}'s investor eligibility, jurisdiction, KYC, minimum subscription and redemption documents. Spend 30 minutes on review with $0 deployed. Treat access as gated until the issuer confirms all of these terms.`,
        `If eligible, obtain the exact subscription, custody and redemption fee schedule. Compare the required minimum with a $100 personal cap. If it exceeds the cap, keep a paper record and stop before transferring funds.`,
        `Only after approval, test the smallest permitted subscription on ${network} and record settlement time. Review custody and counterparty exposure after 7 days, then request a permitted redemption. Reserve the disclosed exit fee in advance.`,
        exitStep];
    case 'OTC Marketplace':
    case 'Crypto Card Issuer':
      return [verifyStep,
        `Review ${record.name}'s account eligibility, KYC, custody, regional access and fee schedule for 30 minutes with $0 funded. Confirm withdrawal or account-closure rules before completing any onboarding.`,
        `If eligible, test only an ordinary service you need, capped at $10–$25 plus at most $2 in disclosed service fees. Verify settlement and retain the receipt. Stop if the minimum balance or order is larger than your cap.`,
        `After 7 days, reconcile the settlement, withdraw unused balances and remove unused spending permissions. Check for recurring account fees. Product activity carries no documented future-token entitlement in this snapshot.`,
        exitStep];
    case 'Collateral Markets':
    case 'Restaking':
      return [verifyStep,
        `Read ${record.name}'s vault collateral, slashing conditions, operator permissions and withdrawal delay for 30 minutes with $0 deployed. Identify whether the position is a receipt for an existing asset before discussing any independent protocol token.`,
        `If a public route and acceptable exit exist, cap one deposit at $25–$50 on ${network}, plus up to $10 in fees. Avoid recursive borrowing. Record the slashing exposure and exact earliest withdrawal date before depositing.`,
        `Review the position after 7 days and submit a small withdrawal request if permitted. Wait through the documented exit delay before closing the test. Stop if the minimum deposit exceeds your cap or slashing conditions remain unclear.`,
        exitStep];
    case 'Insurance':
      return [verifyStep,
        `Inspect ${record.name}'s coverage or underwriting terms for 30 minutes at $0 cost. Identify covered events, exclusions, claims discretion and whether a public participation route exists. Verify any collateral receipt and its underlying asset.`,
        `For coverage you actually need, request a quote capped at $10 in premium. If considering underwriting instead, paper-test the loss and lockup with $0 first. Do not fund until the claim process and maximum principal loss are understood.`,
        `After 7 days, review policy validity or underwriting status and save the terms. Test withdrawal only when the documented lockup permits it. Include premiums, gas and possible denied claims in the cost log.`,
        exitStep];
    case 'Governance Incentives':
      return [verifyStep,
        `Read ${record.name}'s incentive source, voting asset, lock period and withdrawal rules for 20–30 minutes. Start with $0 committed. Identify whether rewards require an existing token and whether reward terms are actually published.`,
        `If an open route exists, model one $25 position and its exit penalty on paper. Only use a live lock if its full duration fits your budget and time horizon. Stop if participation depends on an unverified new-token promise.`,
        `Review the position after 7 days, record any published reward calculation and schedule the earliest permitted exit. Reserve gas within a $10 cap. The review period does not shorten a protocol lockup.`,
        exitStep];
    case 'Leveraged Farming':
    case 'Basis Trading':
      return [verifyStep, learningBudget,
        `Paper-test ${record.name}'s strategy for 30 minutes with $0 committed. Map borrowing, funding rates, hedge venues, custody and liquidation exposure. Use an unlevered public route only if the app explicitly supports one.`,
        `If the unlevered route is verified, cap a test at $25–$50 for 7 days and save its receipt. Otherwise remain on paper. Track funding or hedge costs, collateral health and exit liquidity. A strategy can carry internal leverage even without user borrowing.`,
        exitStep];
    case 'Derivatives':
    case 'Interest Rate Derivatives':
    case 'Prediction Market':
      return [verifyStep,
        `Check ${record.name}'s market access, jurisdiction and settlement rules for 20 minutes. Use a demo or paper position first with $0 at risk. If local access or the loss calculation is unclear, stop at observation.`,
        `If permitted and understood, cap one fully collateralized position at $10–$25, with total trading costs below $2. Read funding, settlement and liquidation terms before placing an order. Skip leverage and volume-for-rewards loops.`,
        `Close or settle the position after the planned session, withdraw unused collateral and log every fee. Do one meaningful test over a 7-day review window. Account activity carries no recorded entitlement to a token.`,
        exitStep];
    case 'CDP':
    case 'Dual-Token Stablecoin':
    case 'CDP Manager':
      return [verifyStep, learningBudget,
        `Review ${record.name}'s collateral, oracle, liquidation threshold, stability fee and peg mechanism. Use its simulator for 20 minutes. If minting requires debt, keep the first session as a $0 paper position until the repayment path is clear.`,
        `If you choose a live test, cap collateral at $100 and debt at $20, subject to stricter protocol minimums and collateral rules. Record a stressed collateral price, accrued fee and repayment amount. Stop if the minimum position exceeds your cap.`,
        `Within 7 days, repay debt plus fees and withdraw collateral before closing the test. Keep the repayment asset and gas available throughout. A CDP position has liquidation, oracle and stablecoin depeg exposure.`,
        exitStep];
    case 'Observation':
    case 'Chain':
    case 'Payments':
    case 'Staking Pool':
    case 'Stablecoin Wrapper':
      return [verifyStep,
        `Observe ${record.name}'s network or product documentation for 30 minutes with $0 committed. Confirm whether activity concerns an existing network asset, receipt token or separate protocol, and whether any governance rights are documented.`,
        `If a public test environment exists, try one transfer or deposit-and-withdraw simulation there. If only mainnet exists, inspect a sample transaction first. Keep any optional live transfer below $10 plus a $2 fee cap.`,
        `After 7 days, review the product's status and archive transaction identifiers. Keep this entry on observation unless an independently verified participation route and explicit eligibility terms appear. Existing asset usage alone establishes no new-token claim.`,
        exitStep];
    case 'Yield':
    case 'Yield Aggregator':
    case 'Onchain Capital Allocator':
    case 'Indexes':
    case 'Farm':
      return [verifyStep, learningBudget,
        `Inspect ${record.name}'s asset strategy, accepted collateral, manager permissions and withdrawal queue on ${network}. Spend 20–30 minutes checking how returns and losses reach depositors. Confirm that a public deposit route actually exists.`,
        `If open, deposit $25–$100 into one unlevered strategy and retain the receipt. Hold for 7 days while checking share value and queue conditions. Test a $5 redemption before committing more, and allow for strategy, depeg and manager risk.`,
        exitStep];
    default:
      return [verifyStep,
        `Spend 30 minutes reviewing ${record.name}'s product documentation with $0 committed. The snapshot category does not establish a supported participation route, so verify the actual product and exit mechanism before considering any transaction.`,
        `If a public test environment is documented, simulate one core interaction there and save the receipt. Revisit after 7 days to review published access and eligibility terms. Keep capital deployment at $0 while the route remains unverified.`,
        exitStep];
  }
}

export function buildRadar(inputSnapshot: Snapshot) {
  const watchlistSlugs = new Set(inputSnapshot.watchlist);
  const pricedPeers = inputSnapshot.protocols.filter((record) =>
    (record.gecko_id !== null || record.symbol !== null) &&
    record.mcap_usd !== null && record.mcap_usd > 0 && record.tvl_usd > 0 &&
    !excludedCategories.has(record.category ?? '') && !productName.test(record.name),
  );
  if (pricedPeers.length < 3)
    throw new Error('At least three token-bearing valuation peers are required.');
  const peerRatios = pricedPeers.map((record) => record.mcap_usd! / record.tvl_usd);
  const lowerBound = quantile(peerRatios, 0.1);
  const upperBound = quantile(peerRatios, 0.9);
  const pooledRatio = quantile(peerRatios.map((value) => clamp(value, lowerBound, upperBound)), 0.5);
  const candidates = inputSnapshot.protocols.filter((record) =>
    watchlistSlugs.has(record.slug) ||
    (record.gecko_id === null && record.symbol === null && record.mcap_usd === null &&
      !excludedCategories.has(record.category ?? '') && !productName.test(record.name) &&
      !familyProduct.test(record.slug)),
  );
  const rankedRows = candidates.map((record) => {
    if (record.gecko_id !== null || record.symbol !== null)
      throw new Error('Watchlist contains a token-bearing record.');
    const categoryPeers = pricedPeers.filter((peer) => peer.category === record.category);
    const categoryRatio = categoryPeers.length
      ? quantile(categoryPeers.map((peer) => clamp(peer.mcap_usd! / peer.tvl_usd, lowerBound, upperBound)), 0.5)
      : pooledRatio;
    const categoryWeight = categoryPeers.length / (categoryPeers.length + 6);
    const blendedMultiple = categoryRatio * categoryWeight + pooledRatio * (1 - categoryWeight);
    const trackingDays = ageDays(record, inputSnapshot.as_of);
    const growthFactor = record.change_7d === null ? 1 : 1 + clamp(record.change_7d, -40, 40) / 200;
    const maturityFactor = trackingDays === null ? 0.85 : 0.75 + 0.25 * Math.min(trackingDays / 730, 1);
    const hasAmbiguity = excludedCategories.has(record.category ?? '') ||
      productName.test(record.name) || familyProduct.test(record.slug);
    const accessRoute = hasAmbiguity ? 'Observe first' : route(record.category);
    const rightsFactor = hasAmbiguity ? 0.35
      : accessRoute === 'Eligibility check' || accessRoute === 'Curated vault' ? 0.65 : 0.85;
    const impliedValue = Math.max(1, Math.round(
      record.tvl_usd * blendedMultiple * growthFactor * maturityFactor * rightsFactor,
    ));
    const scenarioBand = categoryPeers.length < 3 || trackingDays === null || hasAmbiguity ? 0.65 : 0.45;
    const recordWarnings = [
      'Snapshot records no token. Current token status, launch intent and allocation are unverified.',
      'TVL can overlap across protocols. Revenue, supply, unlocks and token value capture are absent.',
    ];
    if (!watchlistSlugs.has(record.slug)) recordWarnings.push(
      'Extended candidate. The sealed file omits parentProtocol, so independent protocol status needs verification.',
    );
    if (hasAmbiguity) recordWarnings.push(
      'Watchlist product or existing-asset ambiguity. Verify separate governance rights before any live activity.',
    );
    if (categoryPeers.length < 3) recordWarnings.push(
      `Only ${categoryPeers.length} same-category priced peers. The estimate relies heavily on the pooled benchmark.`,
    );
    if (record.change_7d === null) recordWarnings.push(
      'Seven-day TVL change is missing. The momentum factor is neutral.',
    );
    if (trackingDays === null) recordWarnings.push(
      'Tracking start is missing. The model uses a conservative 0.85 maturity factor.',
    );
    return {
      ...record,
      rank: 0,
      implied_value_usd: impliedValue,
      low_usd: Math.max(1, Math.round(impliedValue * (1 - scenarioBand))),
      high_usd: Math.round(impliedValue * (1 + scenarioBand)),
      watchlist: watchlistSlugs.has(record.slug),
      access: accessRoute,
      ambiguity: hasAmbiguity,
      age_days: trackingDays,
      confidence: hasAmbiguity || categoryPeers.length < 3 || trackingDays === null ? 'Low' : 'Moderate',
      model: {
        multiple: blendedMultiple,
        category_ratio: categoryRatio,
        global_ratio: pooledRatio,
        category_weight: categoryWeight,
        peer_count: categoryPeers.length,
        growth: growthFactor,
        maturity: maturityFactor,
        rights: rightsFactor,
      },
      peers: categoryPeers.map((peer) => ({
        slug: peer.slug,
        name: peer.name,
        tvl_usd: peer.tvl_usd,
        mcap_usd: peer.mcap_usd,
        ratio: peer.mcap_usd! / peer.tvl_usd,
      })),
      warnings: recordWarnings,
      farm_steps: farmPlan(record, hasAmbiguity),
    };
  }).sort((left, right) => right.implied_value_usd - left.implied_value_usd ||
    left.slug.localeCompare(right.slug, 'en'));
  rankedRows.forEach((record, index) => { record.rank = index + 1; });
  return {
    as_of: inputSnapshot.as_of,
    floor_usd: inputSnapshot.floor_usd,
    source: inputSnapshot.source,
    universe: inputSnapshot.protocols.length,
    token_records: inputSnapshot.protocols.filter((record) => record.gecko_id !== null || record.symbol !== null).length,
    watchlist_count: inputSnapshot.watchlist.length,
    peer_count: pricedPeers.length,
    global_ratio: pooledRatio,
    ratio_bounds: [lowerBound, upperBound],
    rows: rankedRows,
  };
}
