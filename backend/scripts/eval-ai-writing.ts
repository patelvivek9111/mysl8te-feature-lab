/**
 * Runs the experimental AI-writing heuristic against a labelled JSONL dataset.
 *
 * Usage:
 *   npx tsx scripts/eval-ai-writing.ts <dataset.jsonl> [--min-words N] [--threshold T]
 *       [--sign-off reviewer.json] [--out-dir DIR] [--fail-on-gates]
 *
 * Each JSONL line: {"id": string, "text": string, "label": "human"|"ai"|"ai_paraphrased"|"hybrid", "group"?: string}
 * The report is printed and written to eval-data/ai-writing/reports/<timestamp>.json.
 * This script never writes validated-evaluation.json; that record requires human sign-off.
 */
import * as fs from 'fs';
import * as path from 'path';
import { evaluate, type LabeledSample, type ReviewerSignOff } from '../src/ai-writing';

const LABELS = new Set(['human', 'ai', 'ai_paraphrased', 'hybrid']);

function usage(msg?: string): never {
  if (msg) console.error(`Error: ${msg}`);
  console.error(
    'Usage: npx tsx scripts/eval-ai-writing.ts <dataset.jsonl> [--min-words N] [--threshold T] [--sign-off file.json] [--out-dir DIR] [--fail-on-gates]',
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const opts: { dataset?: string; minWords?: number; threshold?: number; signOff?: string; outDir?: string; failOnGates: boolean } = {
    failOnGates: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) usage(`${a} requires a value`);
      return v;
    };
    if (a === '--min-words') opts.minWords = Number(next());
    else if (a === '--threshold') opts.threshold = Number(next());
    else if (a === '--sign-off') opts.signOff = next();
    else if (a === '--out-dir') opts.outDir = next();
    else if (a === '--fail-on-gates') opts.failOnGates = true;
    else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else if (!opts.dataset) opts.dataset = a;
    else usage(`unexpected argument ${a}`);
  }
  if (!opts.dataset) usage('dataset path is required');
  if (opts.minWords !== undefined && !(Number.isInteger(opts.minWords) && opts.minWords > 0)) usage('--min-words must be a positive integer');
  if (opts.threshold !== undefined && !(opts.threshold >= 0 && opts.threshold <= 1)) usage('--threshold must be in [0, 1]');
  return opts as typeof opts & { dataset: string };
}

function readDataset(file: string): LabeledSample[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out: LabeledSample[] = [];
  const ids = new Set<string>();
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line);
    } catch {
      throw new Error(`${file}:${i + 1}: invalid JSON`);
    }
    if (typeof row.id !== 'string' || typeof row.text !== 'string' || typeof row.label !== 'string' || !LABELS.has(row.label)) {
      throw new Error(`${file}:${i + 1}: requires string id, string text and label in ${[...LABELS].join('|')}`);
    }
    if (row.group !== undefined && typeof row.group !== 'string') throw new Error(`${file}:${i + 1}: group must be a string`);
    if (ids.has(row.id)) throw new Error(`${file}:${i + 1}: duplicate id ${row.id}`);
    ids.add(row.id);
    out.push({ id: row.id, text: row.text, label: row.label as LabeledSample['label'], group: row.group as string | undefined });
  });
  return out;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const datasetPath = path.resolve(opts.dataset);
  const dataset = readDataset(datasetPath);
  const signOff = opts.signOff ? (JSON.parse(fs.readFileSync(opts.signOff, 'utf8')) as ReviewerSignOff) : undefined;

  const report = evaluate(dataset, {
    minWords: opts.minWords,
    operatingThreshold: opts.threshold,
    independentReviewerSignOff: signOff,
  });
  const generatedAt = new Date().toISOString();
  const output = { generatedAt, dataset: path.relative(process.cwd(), datasetPath), ...report };

  const outDir = path.resolve(opts.outDir ?? path.join(__dirname, '../eval-data/ai-writing/reports'));
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${generatedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);

  console.log(JSON.stringify(output, null, 2));
  console.error(`\nReport written to ${outFile}`);
  console.error(`Gates passed: ${report.gatesPassed ? 'YES' : 'NO'} (${report.gates.filter((g) => g.passed).length}/${report.gates.length})`);
  if (opts.failOnGates && !report.gatesPassed) process.exit(2);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
