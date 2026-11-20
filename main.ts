import {
  cpSync, existsSync, mkdirSync, readFileSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, type Snapshot } from './lib/radar.ts';
import { buildDossier } from './vendor/makefun-board.ts';

function readArgument(name: string, fallback: string): string {
  const argumentsList = process.argv.slice(2);
  const inlineValue = argumentsList.find((value) => value.startsWith(`--${name}=`));
  if (inlineValue !== undefined) return inlineValue.slice(name.length + 3);
  const optionIndex = argumentsList.indexOf(`--${name}`);
  if (optionIndex < 0) return fallback;
  if (!argumentsList[optionIndex + 1] || argumentsList[optionIndex + 1]!.startsWith('--'))
    throw new Error(`Missing value for --${name}`);
  return argumentsList[optionIndex + 1]!;
}

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const inputPath = resolve(readArgument('input', '/input'));
const outputPath = resolve(readArgument('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
const snapshotFile = statSync(inputPath).isDirectory()
  ? join(inputPath, 'snapshot.json') : inputPath;
const inputSnapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')) as Snapshot;
if (!Array.isArray(inputSnapshot.protocols) || !Array.isArray(inputSnapshot.watchlist) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(inputSnapshot.as_of)) {
  throw new Error('Input must be a sealed protocol snapshot.');
}
const rankedBoard = buildRadar(inputSnapshot);
const boardSlugs = new Set(rankedBoard.rows.map((protocol) => protocol.slug));
if (rankedBoard.rows.length < 100 || rankedBoard.rows.length > 4000 ||
    inputSnapshot.watchlist.some((slug) => !boardSlugs.has(slug))) {
  throw new Error('Board size or watchlist coverage failed.');
}
for (const protocol of rankedBoard.rows) {
  if (!Number.isSafeInteger(protocol.implied_value_usd) || protocol.implied_value_usd < 1 ||
      protocol.farm_steps.length < 3 || protocol.farm_steps.length > 12 ||
      protocol.farm_steps.some((step) => step.trim().length < 20 || step.trim().length > 600)) {
    throw new Error(`Invalid valuation or farm plan for ${protocol.slug}`);
  }
}
mkdirSync(outputPath, { recursive: true });
const stagingDir = join(outputPath, 'radar-staging');
if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true });
mkdirSync(stagingDir);
cpSync(join(sourceRoot, 'dashboard'), join(stagingDir, 'dashboard'), { recursive: true });
cpSync(join(sourceRoot, 'screenshots'), join(stagingDir, 'screenshots'), { recursive: true });
writeFileSync(join(stagingDir, 'board.json'),
  `${JSON.stringify({ model: 'peer-mcap-tvl-v1', as_of: rankedBoard.as_of, rows: rankedBoard.rows })}\n`);
const dashboardData = JSON.stringify(rankedBoard)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
writeFileSync(join(stagingDir, 'data.js'), `window.RADAR = ${dashboardData};\n`);
writeFileSync(join(stagingDir, 'dossier.json'), buildDossier(stagingDir, {
  text_max_bytes: 65_536,
  screenshots: { max: 3, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
}));
if (statSync(join(stagingDir, 'dossier.json')).size > 1_572_864)
  throw new Error('Dossier exceeds the competition cap.');
for (const artifactName of ['dashboard', 'screenshots', 'board.json', 'data.js', 'dossier.json']) {
  const destination = join(outputPath, artifactName);
  rmSync(destination, { recursive: true, force: true });
  renameSync(join(stagingDir, artifactName), destination);
}
rmSync(stagingDir, { recursive: true });
console.log(`Built ${rankedBoard.rows.length} ranked rows, ${inputSnapshot.watchlist.length} watchlist entries and ${rankedBoard.peer_count} valuation peers.`);
console.log(`Open ${join(outputPath, 'dashboard', 'index.html')}`);
