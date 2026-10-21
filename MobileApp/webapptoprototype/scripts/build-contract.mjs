import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import standalone from 'ajv/dist/standalone/index.js';

import { metaSchema, snapshotSchema } from '../contracts/schema.mjs';

const root = resolve(import.meta.dirname, '..');
const generated = resolve(root, 'contracts/generated');
mkdirSync(generated, { recursive: true });
const ajv = new Ajv({ strict: true, allErrors: true, code: { source: true } });
ajv.addSchema(metaSchema); ajv.addSchema(snapshotSchema);
const validator = standalone(ajv, { validateMeta: metaSchema.$id, validateSnapshot: snapshotSchema.$id });
writeFileSync(resolve(generated, 'validate.cjs'), validator);
writeFileSync(resolve(generated, 'validate.d.cts'), 'export declare function validateMeta(data: unknown): boolean;\nexport declare function validateSnapshot(data: unknown): boolean;\n');
writeFileSync(resolve(root, 'contracts/mobile-capture.schema.json'), `${JSON.stringify(metaSchema, null, 2)}\n`);
writeFileSync(resolve(root, 'contracts/snapshot.schema.json'), `${JSON.stringify(snapshotSchema, null, 2)}\n`);
const paths = ['src/core/project.ts', 'src/core/archive.ts', 'src/core/mobile-bundle.ts',
  'contracts/mobile-capture.schema.json', 'contracts/snapshot.schema.json', 'contracts/generated/validate.cjs', 'contracts/generated/validate.d.cts'];
const artifact = resolve(root, 'contracts/artifacts/0.1.0-alpha.1');
let commit = null;
try { commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { /* Unborn repository: record no commit. */ }
const files = paths.map((path) => {
  const bytes = readFileSync(resolve(root, path)), target = resolve(artifact, path);
  mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, bytes);
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const runtimeDependencies = { ajv: JSON.parse(readFileSync(resolve(root, 'node_modules/ajv/package.json'), 'utf8')).version };
writeFileSync(resolve(artifact, 'manifest.json'), `${JSON.stringify({ formatVersion: '0.1.0-alpha.1', sourceRepository: 'https://github.com/NarIyirm/Web-AppToPrototype.git', commit, runtimeDependencies, files }, null, 2)}\n`);
console.log(`Generated two schemas, standalone validators and ${files.length} traced contract files.`);
