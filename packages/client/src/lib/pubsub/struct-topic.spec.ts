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
    client['prefixTopics'].clear();
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
});
