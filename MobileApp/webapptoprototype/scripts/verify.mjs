import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'docs/verification/latest-check.json');
const tests = readdirSync(resolve(root, 'tests')).filter((name) => name.endsWith('.test.ts'));
const checks = [
  ['contract', ['scripts/check-contract.mjs']],
  ['lint', ['node_modules/expo/bin/cli', 'lint']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['test', ['--test', ...tests.map((name) => `tests/${name}`)]],
];
const results = checks.map(([name, args]) => {
  const result = spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', timeout: 120_000, env: { ...process.env, CI: '1' },
  });
  const record = { name, command: ['node', ...args], exitCode: result.status,
    error: result.error?.message ?? null, stdout: result.stdout, stderr: result.stderr };
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
  if (result.status !== 0) console.log(result.stdout, result.stderr, result.error?.message ?? '');
  return record;
});
// The initialization snapshot predates the first commit and is only a historical audit.
// Normal verification must also work in a fresh checkout of the combined repository.
let preservation = null;
if (process.argv.includes('--check-initialization')) {
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const original = JSON.parse(readFileSync(resolve(root, 'docs/verification/2026-10-20-baseline-before.json'), 'utf8'));
  const index = spawnSync('git', ['ls-files', '--stage'], { cwd: root, encoding: 'utf8' });
  const expectedChanged = new Set([
    'package.json', 'package-lock.json', 'tsconfig.json', 'src/components/app-tabs.web.tsx',
    'src/hooks/use-color-scheme.web.ts', 'src/app/explore.tsx', 'src/app/index.tsx', 'src/app/_layout.tsx',
    'src/components/app-tabs.tsx', // SDK 57 uses unstable-native-tabs.
    'README.md', // Business documentation and the SDK 57 migration update.
  ]);
  const unexpectedChanges = Object.entries(original.trackedFiles).filter(([path, hash]) =>
    !expectedChanged.has(path) && digest(readFileSync(resolve(root, path))) !== hash,
  ).map(([path]) => path);
  preservation = {
    appJsonUnchanged: digest(readFileSync(resolve(root, 'app.json'))) === original.appConfig.sha256,
    indexUnchanged: index.status === 0 && digest(index.stdout.trim()) === original.git.indexEntriesSha256,
    unexpectedChanges,
  };
}
const passed = results.every((result) => result.exitCode === 0)
  && (preservation === null || (preservation.appJsonUnchanged
    && preservation.indexUnchanged && preservation.unexpectedChanges.length === 0));
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, `${JSON.stringify({ recordedAt: new Date().toISOString(), node: process.version,
  passed, preservation, results }, null, 2)}\n`);
if (preservation !== null) console.log(`Preservation: ${JSON.stringify(preservation)}`);
console.log(`Report: ${output}`);
process.exitCode = passed ? 0 : 1;
