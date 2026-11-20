import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRadar, type Snapshot } from "./lib/radar.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

function argument(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const option = args.find((value) => value.startsWith(`--${name}=`));
  if (option !== undefined) return option.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1]!.startsWith("--"))
    throw new Error(`Missing value for --${name}`);
  return args[index + 1]!;
}

const root = dirname(fileURLToPath(import.meta.url));
const input = resolve(argument("input", "/input"));
const output = resolve(
  argument("output", process.env.MAKEFUN_OUTPUT_DIR ?? "/output"),
);
const file = statSync(input).isDirectory()
  ? join(input, "snapshot.json")
  : input;
const snapshot = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
if (
  !Array.isArray(snapshot.protocols) ||
  !Array.isArray(snapshot.watchlist) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of)
) {
  throw new Error("Input must be a sealed protocol snapshot.");
}
const radar = buildRadar(snapshot);
const slugs = new Set(radar.rows.map((row) => row.slug));
if (
  radar.rows.length < 100 ||
  radar.rows.length > 4000 ||
  snapshot.watchlist.some((slug) => !slugs.has(slug))
) {
  throw new Error("Board size or watchlist coverage failed.");
}
for (const row of radar.rows) {
  if (
    !Number.isSafeInteger(row.implied_value_usd) ||
    row.implied_value_usd < 1 ||
    row.farm_steps.length < 3 ||
    row.farm_steps.length > 12 ||
    row.farm_steps.some(
      (step) => step.trim().length < 20 || step.trim().length > 600,
    )
  ) {
    throw new Error(`Invalid valuation or farm plan for ${row.slug}`);
  }
}
mkdirSync(output, { recursive: true });
const stage = join(output, "radar-staging");
if (existsSync(stage)) rmSync(stage, { recursive: true });
mkdirSync(stage);
cpSync(join(root, "dashboard"), join(stage, "dashboard"), { recursive: true });
cpSync(join(root, "screenshots"), join(stage, "screenshots"), {
  recursive: true,
});
writeFileSync(
  join(stage, "board.json"),
  `${JSON.stringify({ model: "peer-mcap-tvl-v1", as_of: radar.as_of, rows: radar.rows })}\n`,
);
const data = JSON.stringify(radar)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");
writeFileSync(join(stage, "data.js"), `window.RADAR = ${data};\n`);
writeFileSync(
  join(stage, "dossier.json"),
  buildDossier(stage, {
    text_max_bytes: 65_536,
    screenshots: { max: 3, max_bytes: 524_288 },
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);
if (statSync(join(stage, "dossier.json")).size > 1_572_864)
  throw new Error("Dossier exceeds the competition cap.");
for (const name of [
  "dashboard",
  "screenshots",
  "board.json",
  "data.js",
  "dossier.json",
]) {
  const target = join(output, name);
  rmSync(target, { recursive: true, force: true });
  renameSync(join(stage, name), target);
}
rmSync(stage, { recursive: true });
console.log(
  `Built ${radar.rows.length} ranked rows, ${snapshot.watchlist.length} watchlist entries and ${radar.peer_count} valuation peers.`,
);
console.log(`Open ${join(output, "dashboard", "index.html")}`);
