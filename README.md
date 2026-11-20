# Token Radar

A static, offline token-launch research dashboard built from the sealed DefiLlama snapshot dated November 14, 2026. The board ranks 171 candidates and covers all 40 house-watchlist entries. Every candidate has a detail page, a valuation breakdown and a conditional participation plan.

## Run

Requires Node 22 with TypeScript stripping. Uses the standard library and bundled assets.

```sh
mkdir -p /tmp/token-radar-out
node --experimental-strip-types main.ts \
  --input /workspace/makefun/token-radar-01-kit/input \
  --output /tmp/token-radar-out
```

Open `/tmp/token-radar-out/dashboard/index.html` directly in a browser. The page loads its sibling `../data.js` and local fonts from disk. It supports search, network/category/TVL filters, watchlist scopes, sortable columns, pagination and deep links to all protocol details. Filter state is preserved in the URL fragment.

The container defaults are `/input/snapshot.json` and `/output`. Input also accepts a JSON filename. `MAKEFUN_OUTPUT_DIR` provides an output-directory default.

## Valuation

`lib/radar.ts` builds the candidate universe, peer set, ranking and farm plans. The estimate is a hypothetical circulating token market cap, calculated from recorded TVL, a blended same-category and pooled market-cap/TVL multiple, bounded seven-day momentum, tracking age and an explicit rights haircut. The dashboard's Methodology view gives every factor and the sensitivity-band assumptions.

All watchlist entries are retained. Extended candidates exclude token-bearing records and category/name patterns associated with wrapped, staked, bridged or token-family products. The sealed input omits parent-protocol relationships. Extended candidates carry that qualification, and ambiguous watchlist products receive observation-first plans and a larger haircut. Current token status and participation terms require independent verification.

Farm plans include verification, category-specific actions, illustrative cost caps, a review period and an exit. They are generated from the sealed fields. The input provides no contract addresses, fee quotes or allocation terms.

## Outputs

- `board.json` contains the ranked rows and their farm steps.
- `data.js` contains the complete dashboard dataset.
- `dashboard/` contains the static application and bundled font licenses.
- `screenshots/` contains the board, protocol detail and filtered views captured directly from the generated dashboard with browser networking disabled.
- `dossier.json` is generated with the kit's unchanged `vendor/makefun-board.ts`.

The generator stages its artifacts before replacing the output files. Identical input and repository contents produce identical artifact bytes.

## Review status

The repository is prepared for parent review. Competition submission requires the parent's explicit approval, 「审过，可以提交」.

Code uses MIT. Bundled DM Sans and Instrument Serif use the SIL Open Font License, with notices in `dashboard/`.
