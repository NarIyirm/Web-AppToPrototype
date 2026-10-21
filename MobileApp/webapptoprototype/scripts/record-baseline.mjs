import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const config = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8'));
const files = git('ls-files', '-z').split('\0').filter(Boolean);
const report = {
  recordedAt: new Date().toISOString(),
  platform: process.platform,
  node: process.version,
  package: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')),
  installed: Object.fromEntries(['expo', 'react', 'react-native', 'typescript'].map((name) => [
    name, JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8')).version,
  ])),
  git: {
    branch: git('branch', '--show-current'),
    origin: git('remote', 'get-url', 'origin'),
    status: git('status', '--porcelain=v1'),
    indexEntries: git('ls-files', '--stage'),
    indexEntriesSha256: sha256(git('ls-files', '--stage')),
  },
  appConfig: { sha256: sha256(readFileSync(resolve(root, 'app.json'))), expo: config.expo },
  trackedFiles: Object.fromEntries(files.map((path) => [path,
    existsSync(resolve(root, path)) ? sha256(readFileSync(resolve(root, path))) : null,
  ])),
  environment: {
    androidHomeConfigured: Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT),
    javaHomeConfigured: Boolean(process.env.JAVA_HOME),
    nativeDirectories: ['android', 'ios'].filter((path) => existsSync(resolve(root, path))),
  },
};
const output = resolve(root, process.argv[2] ?? 'docs/verification/baseline.json');
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Baseline recorded: ${output}`);
