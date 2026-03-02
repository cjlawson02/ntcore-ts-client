import WSMock from 'vitest-websocket-mock';

import { PubSubClient } from './pubsub';
import { NetworkTablesStructTopic } from './struct-topic';

const serverUrl = 'ws://localhost:5814/nt/9999';

describe('NetworkTablesStructTopic', () => {
  let client: PubSubClient;

  beforeAll(async () => {
    const server = new WSMock(serverUrl);
    client = PubSubClient.getInstance(serverUrl);
    await server.connected;
  });

  beforeEach(() => {
    client['topics'].clear();
    // Do not clear prefixTopics: StructSchemaManager's prefix (/.schema/struct:) is needed for deferred-schema test
    client['knownTopicParams'].clear();
    client['pendingValueUpdates'].clear();
    client.structSchemaManager.clearCache();
  });

  it('constructor creates topic with typeName', () => {
    const topic = new NetworkTablesStructTopic<{ x: number; y: number }>(client, '/struct/t', {
      typeName: 'Translation2d',
    });
    expect(topic).toBeDefined();
    expect(topic.typeInfo[1]).toBe('struct:Translation2d');
  });

  it('getValue returns null initially', () => {
    const topic = new NetworkTablesStructTopic<{ x: number; y: number }>(client, '/struct/t', {
      typeName: 'Translation2d',
    });
    expect(topic.getValue()).toBeNull();
  });

  it('updateValue decodes bytes and getValue returns decoded value', () => {
    const topic = new NetworkTablesStructTopic<{ x: number; y: number }>(client, '/struct/t', {
      typeName: 'Translation2d',
    });
    const buf = new ArrayBuffer(16);
    const view = new DataView(buf);
    view.setFloat64(0, 1.5, true);
    view.setFloat64(8, -2.25, true);
    topic.updateValue(new Uint8Array(buf), 0);
    expect(topic.getValue()).toEqual({ x: 1.5, y: -2.25 });
  });

  it('setValue encodes and publishes when schema available', () => {
    const topic = new NetworkTablesStructTopic<{ x: number; y: number }>(client, '/struct/t', {
      typeName: 'Translation2d',
    });
    topic['_pubuid'] = 1;
    topic['_publisher'] = true;
    topic.setValue({ x: 3, y: 4 });
    expect(topic.getValue()).toEqual({ x: 3, y: 4 });
  });

  it('returns existing topic when createStructTopic called again with same name', () => {
    const topic1 = new NetworkTablesStructTopic<{ x: number }>(client, '/struct/same', {
      typeName: 'Rotation2d',
    });
    const existing = client.getTopicFromName('/struct/same');
    expect(existing).toBe(topic1);
  });

  it('struct:TypeName[] array topic decodes and encodes array of structs', () => {
    const topic = new NetworkTablesStructTopic<Array<{ x: number; y: number }>>(client, '/struct/arr', {
      typeName: 'Translation2d[]',
    });
    // Pack 2 Translation2d: 16 bytes each = 32 bytes total
    const buf = new ArrayBuffer(32);
    const view = new DataView(buf);
    view.setFloat64(0, 1.0, true);
    view.setFloat64(8, 2.0, true);
    view.setFloat64(16, 3.0, true);
    view.setFloat64(24, 4.0, true);
    topic.updateValue(new Uint8Array(buf), 0);
    expect(topic.getValue()).toEqual([
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
    ]);

    topic['_pubuid'] = 1;
    topic['_publisher'] = true;
    topic.setValue([
      { x: 5.0, y: 6.0 },
      { x: 7.0, y: 8.0 },
    ]);
    expect(topic.getValue()).toEqual([
      { x: 5.0, y: 6.0 },
      { x: 7.0, y: 8.0 },
    ]);
  });

  it('setValue on array struct topic throws clear error when given non-array', () => {
    const topic = new NetworkTablesStructTopic<Array<{ x: number; y: number }>>(client, '/struct/arr', {
      typeName: 'Translation2d[]',
    });
    topic['_pubuid'] = 1;
    topic['_publisher'] = true;
    expect(() => topic.setValue({ x: 1, y: 2 } as unknown as Array<{ x: number; y: number }>)).toThrow(
      /Expected an array for array struct topic \/struct\/arr, got object/
    );
    expect(() => topic.setValue(null as unknown as Array<{ x: number; y: number }>)).toThrow(
      /Expected an array for array struct topic \/struct\/arr, got object \(null\)/
    );
  });

  it('schema option builds descriptor and enables publish', () => {
    const topic = new NetworkTablesStructTopic<{ x: number; y: number }>(client, '/struct/custom', {
      typeName: 'Custom2d',
      schema: 'double x;double y',
    });
    topic['_pubuid'] = 1;
    topic['_publisher'] = true;
    topic.setValue({ x: 10, y: 20 });
    expect(topic.getValue()).toEqual({ x: 10, y: 20 });
    expect(topic.typeInfo[1]).toBe('struct:Custom2d');
  });

  describe('applyOptions', () => {
    it('applies typeName and schema when reusing topic', () => {
      const topic = new NetworkTablesStructTopic<{ x: number; y: number }>(client, '/struct/apply', {
        typeName: 'Translation2d',
      });
      expect(topic.getValue()).toBeNull();
      topic.applyOptions({
        typeName: 'CustomPoint',
        schema: 'double x;double y',
        defaultValue: { x: 1, y: 2 },
      });
      expect(topic.getValue()).toEqual({ x: 1, y: 2 });
      topic['_pubuid'] = 1;
      topic['_publisher'] = true;
      topic.setValue({ x: 5, y: 10 });
      expect(topic.getValue()).toEqual({ x: 5, y: 10 });
    });

    it('applies schema only (keeps typeName), builds descriptor', () => {
      const topic = new NetworkTablesStructTopic<{ a: number; b: number }>(client, '/struct/schemaOnly', {
        typeName: 'AB',
      });
      topic.applyOptions({ schema: 'double a;double b' });
      topic['_pubuid'] = 1;
      topic['_publisher'] = true;
      topic.setValue({ a: 3, b: 4 });
      expect(topic.getValue()).toEqual({ a: 3, b: 4 });
    });
  });

  describe('deferred schema (pending schema retry in ensureDescriptor)', () => {
    it('stores schema when build fails (nested not available), retries on setValue after schema arrives', () => {
      const topic = new NetworkTablesStructTopic<{ f: { x: number } }>(client, '/struct/deferred', {
        typeName: 'Outer',
        schema: 'NestedT f',
      });
      expect(topic['_descriptor']).toBeNull();
      expect(topic['_pendingSchema']).toBe('NestedT f');

      const prefixTopic = client.getPrefixTopicFromName('/.schema/struct:');
      if (!prefixTopic) throw new Error('expected prefix topic');
      prefixTopic.updateValue(
        { name: '/.schema/struct:NestedT', id: 1, type: 'structschema', properties: {} },
        new TextEncoder().encode('double x'),
        0
      );

      topic['_pubuid'] = 1;
      topic['_publisher'] = true;
      topic.setValue({ f: { x: 42 } });
      expect(topic['_descriptor']).not.toBeNull();
      expect(topic['_pendingSchema']).toBeNull();
      expect(topic.getValue()).toEqual({ f: { x: 42 } });
    });
  });
});
