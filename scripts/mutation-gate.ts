// Pre-push mutation step: mutates only the src lines changed since <base>,
// then fails if any mutant survived or had no coverage.
// Usage: tsx scripts/mutation-gate.ts <base-ref> [--dry-run]
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';

const REPORT = 'reports/mutation/mutation.json';
const FAILING_STATUSES = new Set(['Survived', 'NoCoverage']);

const isMutable = (file: string) =>
  /^src\/.*\.tsx?$/.test(file) &&
  !/\.test\.tsx?$/.test(file) &&
  !file.startsWith('src/test/') &&
  !file.endsWith('.d.ts') &&
  file !== 'src/main.tsx';

// Builds Stryker `file:start-end` entries from the added/changed hunks of `git diff -U0`
export function changedRanges(diff: string): string[] {
  const ranges: string[] = [];
  let file: string | null = null;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4);
      file = target.startsWith('b/') && isMutable(target.slice(2)) ? target.slice(2) : null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (file && hunk) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      if (count > 0) ranges.push(`${file}:${start}-${start + count - 1}`);
    }
  }
  return ranges;
}

interface MutationReport {
  files: Record<string, {
    mutants: Array<{ mutatorName: string; status: string; location: { start: { line: number } } }>
  }>
}

function main() {
  const [base, ...flags] = process.argv.slice(2);
  if (!base) {
    console.error('usage: tsx scripts/mutation-gate.ts <base-ref> [--dry-run]');
    process.exit(2);
  }

  const diff = execFileSync('git', ['diff', '-U0', '--diff-filter=AM', `${base}...HEAD`, '--', 'src'], { encoding: 'utf8' });
  const ranges = changedRanges(diff);

  if (ranges.length === 0) {
    console.log('[mutation] no changed source lines since', base, '- skipping Stryker');
    return;
  }
  console.log(`[mutation] scope (${ranges.length} ranges):\n  ${ranges.join('\n  ')}`);
  if (flags.includes('--dry-run')) return;

  const run = spawnSync('npx', ['stryker', 'run', '--mutate', ranges.join(',')], { stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status ?? 1);

  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8')) as MutationReport;
  const unexplained = Object.entries(report.files).flatMap(([file, { mutants }]) =>
    mutants
      .filter((m) => FAILING_STATUSES.has(m.status))
      .map((m) => `${file}:${m.location.start.line} ${m.mutatorName} (${m.status})`)
  );

  if (unexplained.length > 0) {
    console.error(`[mutation] ${unexplained.length} unexplained mutant(s) in changed code:\n  ${unexplained.join('\n  ')}`);
    console.error('[mutation] kill each with a test, or mark a proven equivalent with `// Stryker disable next-line <Mutator>: <reason>`');
    process.exit(1);
  }
  console.log('[mutation] no unexplained mutants in changed code');
}

if (process.argv[1]?.endsWith('mutation-gate.ts')) main();
