import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

import { readMobileBundle } from '../src/core/mobile-bundle.ts';

const path = process.argv[2];
if (!path) throw new Error('Usage: npm run inspect:bundle -- <file.w2pm.zip>');
if (statSync(path).size > 64 * 1024 * 1024) throw new Error('M_LIMIT_EXCEEDED: ZIP exceeds 64 MiB');
const result = await readMobileBundle(new Uint8Array(readFileSync(path)), async (bytes) => createHash('sha256').update(bytes).digest('hex'));
console.log(JSON.stringify({ packageId: result.meta.packageId, version: result.meta.formatVersion,
  project: result.meta.project.name, captures: result.state.captures.map((capture) => ({ id: capture.id,
    sourceKind: capture.sourceKind, nodes: capture.webNodes.length, text: capture.observations.length, redacted: capture.redacted })),
  assets: result.state.assets.length, status: 'validated_raw_materials', figmaReady: false }, null, 2));
