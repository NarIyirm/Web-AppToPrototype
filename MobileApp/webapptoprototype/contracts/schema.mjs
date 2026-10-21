const string = (maxLength) => ({ type: 'string', maxLength });
const integer = (maximum, minimum = 0) => ({ type: 'integer', minimum, maximum });
const number = (maximum, minimum = 0) => ({ type: 'number', minimum, maximum });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const array = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
const id = { type: 'string', pattern: '^[a-z][a-z0-9_-]{7,80}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const date = { type: 'string', minLength: 20, maxLength: 32, pattern: '^\\d{4}-\\d{2}-\\d{2}T.*(Z|[+-]\\d{2}:\\d{2})$' };
const rect = object({ x: number(30000), y: number(30000), width: number(30000, 0.001), height: number(30000, 0.001) });
const observation = object({ text: string(10000), bounds: rect,
  confidence: { anyOf: [number(1), { type: 'null' }] }, provenance: { enum: ['ocr', 'dom', 'user'] } });
const node = object({ id: string(80), kind: { enum: ['text', 'shape', 'image'] }, bounds: rect,
  text: string(10000), color: string(100), background: string(100), fontSize: number(1000, 0.001), radius: number(30000),
  fontFamily: string(200), fontWeight: number(1000, 1), lineHeight: number(30000, 1), textAlign: { enum: ['left', 'center', 'right', 'justify'] } }, ['id', 'kind', 'bounds']);
export const snapshotSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'urn:w2p:snapshot:0.1.0-alpha.1',
  ...object({ id, projectId: id, title: string(80), createdAt: date,
    sourceKind: { enum: ['web', 'imported_image', 'android_native', 'ios_native'] }, platform: string(32), sourceUrl: string(2048),
    assetId: hash, width: integer(4096, 1), height: integer(4096, 1), logicalWidth: number(30000, 1), logicalHeight: number(30000, 1),
    coordinateSpace: { enum: ['image_pixels', 'css_pixels'] }, observations: array(observation, 5000), webNodes: array(node, 5000),
    warnings: array(string(500), 100), redacted: { type: 'boolean' } },
  ['id', 'projectId', 'title', 'createdAt', 'sourceKind', 'platform', 'assetId', 'width', 'height', 'logicalWidth',
    'logicalHeight', 'coordinateSpace', 'observations', 'webNodes', 'warnings', 'redacted']),
};
export const metaSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'urn:w2p:mobile:0.1.0-alpha.1',
  ...object({ artifactKind: { const: 'mobile_capture' }, formatVersion: { const: '0.1.0-alpha.1' },
    packageId: id, revision: integer(1_000_000_000, 1), createdAt: date,
    producer: object({ appVersion: string(80), adapterVersion: string(80) }), project: object({ id, name: { type: 'string', minLength: 1, maxLength: 80 } }),
    captures: array(object({ id, snapshotPath: { type: 'string', pattern: '^captures/[a-z][a-z0-9_-]{7,80}/snapshot\\.json$' } }), 5, 1),
    assets: array(object({ id: hash, bytes: integer(10 * 1024 * 1024, 1), width: integer(4096, 1), height: integer(4096, 1),
      mediaType: { const: 'image/png' }, path: { type: 'string', pattern: '^assets/[a-f0-9]{64}\\.png$' } }), 5, 1),
  }),
};
