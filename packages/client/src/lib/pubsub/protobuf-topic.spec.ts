import * as path from 'path';
import { fileURLToPath } from 'url';

import * as protobuf from 'protobufjs';
import WSMock from 'vitest-websocket-mock';
import { z } from 'zod';

import type { AnnounceMessage } from '../types/types';
import { PubSubClient } from './pubsub';
import { NetworkTablesProtobufTopic } from './protobuf-topic';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIMPLE_PROTO_PATH = path.join(__dirname, '__fixtures__', 'simple.proto');

/** Minimal proto message for tests: message test.Simple { int32 value = 1; } */
function createTestMessageType(): protobuf.Type {
  const root = protobuf.Root.fromJSON({
    nested: {
      test: {
        nested: {
          Simple: {
            fields: {
              value: { type: 'int32', id: 1 },
            },
          },
        },
      },
    },
  });
  return root.lookupType('test.Simple');
}

interface SimpleMessage {
  value?: number;
}

describe('NetworkTablesProtobufTopic', () => {
  let client: PubSubClient;
  let server: WSMock;
  const serverUrl = 'ws://localhost:5811/nt/1234';
  const messageType = createTestMessageType();

  beforeAll(async () => {
    server = new WSMock(serverUrl);
    client = PubSubClient.getInstance(serverUrl);
    await server.connected;
  });

  beforeEach(() => {
    client['topics'].clear();
    client['prefixTopics'].clear();
    client['knownTopicParams'].clear();
    client['inFlightOperations'].clear();
    // Seed schema cache so fetchMessageType('test.Simple') returns the type
    const root = messageType.root;
    if (root) {
      client.protobufSchemaManager['schemaCache'].set('test.Simple', root);
      client.protobufSchemaManager['schemaCache'].set('/.schema/proto:test.Simple', root);
    }
  });

  afterEach(() => {
    client.protobufSchemaManager.clearCache();
  });

  describe('constructor', () => {
    it('creates a topic with no options', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/test');
      expect(topic).toBeDefined();
      expect(topic.getValue()).toBeNull();
    });

    it('creates a topic with defaultValue', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/test', {
        defaultValue: { value: 42 },
      });
      expect(topic.getValue()).toEqual({ value: 42 });
    });

    it('creates a topic with validator', () => {
      const schema = z.object({ value: z.number() });
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/validated', {
        validator: schema,
        defaultValue: { value: 1 },
      });
      expect(topic.getValue()).toEqual({ value: 1 });
    });
  });

  describe('applyOptions', () => {
    it('applies defaultValue, validator, and protoFilePath to an existing topic', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/apply');
      expect(topic.getValue()).toBeNull();

      const schema = z.object({ value: z.number() });
      topic.applyOptions({
        defaultValue: { value: 7 },
        validator: schema,
        protoFilePath: SIMPLE_PROTO_PATH,
      });
      expect(topic.getValue()).toEqual({ value: 7 });
    });

    it('parses protoSource immediately so setValue works on a reused topic', () => {
      const SIMPLE_PROTO_SOURCE = `syntax = "proto3";
package fixture;
message Simple {
  int32 value = 1;
}
`;
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/apply-src');
      topic.applyOptions({ protoSource: SIMPLE_PROTO_SOURCE });
      expect(topic['_protobufMessageType']).not.toBeNull();
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      topic.setValue({ value: 3 });
      expect(topic.getValue()).toEqual({ value: 3 });
    });

    it('throws when applyOptions protoSource would change the message type', () => {
      const SIMPLE_PROTO_SOURCE = `syntax = "proto3";
package fixture;
message Simple {
  int32 value = 1;
}
`;
      const OTHER_PROTO_SOURCE = `syntax = "proto3";
package fixture;
message Other {
  int32 x = 1;
}
`;
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/type-lock', {
        protoSource: SIMPLE_PROTO_SOURCE,
      });
      expect(() => topic.applyOptions({ protoSource: OTHER_PROTO_SOURCE })).toThrow(
        /Cannot change protobuf message type/
      );
    });

    it('does not poison a working message type when applyOptions protoFilePath fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const SIMPLE_PROTO_SOURCE = `syntax = "proto3";
package fixture;
message Simple {
  int32 value = 1;
}
`;
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/no-poison', {
        protoSource: SIMPLE_PROTO_SOURCE,
      });
      expect(topic['_protobufMessageType']).not.toBeNull();
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      topic.applyOptions({ protoFilePath: '/nonexistent/file.proto' });
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load proto schema from /nonexistent/file.proto:',
          expect.any(Error)
        );
      });
      expect(topic['_schemaLoadError']).toBeNull();
      expect(topic['_protobufMessageType']).not.toBeNull();
      topic.setValue({ value: 5 });
      expect(topic.getValue()).toEqual({ value: 5 });
      consoleSpy.mockRestore();
    });
  });

  describe('getValue', () => {
    it('returns decoded value after announce and updateValue', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/get');
      topic.announce({ id: 1, name: '/proto/get', type: 'proto:test.Simple', properties: {} });
      const encoded = messageType.encode({ value: 99 }).finish();
      topic.updateValue(encoded, Date.now());
      expect(topic.getValue()).toEqual({ value: 99 });
    });
  });

  describe('setValue', () => {
    it('encodes and sets value when schema is available', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/set');
      topic.announce({ id: 1, name: '/proto/set', type: 'proto:test.Simple', properties: {} });
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      const updateSpy = vi.spyOn(topic, 'updateValue').mockImplementation(() => {});
      topic.setValue({ value: 10 });
      expect(topic.getValue()).toEqual({ value: 10 });
      updateSpy.mockRestore();
    });

    it('validates with zod when validator is provided', () => {
      const schema = z.object({ value: z.number().min(0) });
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/validated', {
        validator: schema,
      });
      topic.announce({ id: 1, name: '/proto/validated', type: 'proto:test.Simple', properties: {} });
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      topic.setValue({ value: 5 });
      expect(topic.getValue()).toEqual({ value: 5 });
    });
  });

  describe('updateValue', () => {
    it('decodes protobuf bytes and stores decoded value', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/update');
      topic.announce({ id: 1, name: '/proto/update', type: 'proto:test.Simple', properties: {} });
      const encoded = messageType.encode({ value: 123 }).finish();
      topic.updateValue(encoded, 1000);
      expect(topic.getValue()).toEqual({ value: 123 });
    });

    it('includes scalar default values when decoding', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/defaults');
      topic.announce({ id: 1, name: '/proto/defaults', type: 'proto:test.Simple', properties: {} });
      const encoded = messageType.encode({}).finish();
      topic.updateValue(encoded, 1000);
      expect(topic.getValue()).toEqual({ value: 0 });
    });
  });

  describe('announce', () => {
    it('extracts message name from type "proto:MessageName"', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/announce');
      topic.announce({ id: 1, name: '/proto/announce', type: 'proto:test.Simple', properties: {} });
      const encoded = messageType.encode({ value: 1 }).finish();
      topic.updateValue(encoded, Date.now());
      expect(topic.getValue()).toEqual({ value: 1 });
    });

    it('skips schema topics (/.schema/)', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/.schema/proto:foo');
      topic.announce({ id: 1, name: '/.schema/proto:foo', type: 'proto:FileDescriptorProto', properties: {} });
      // Should not throw; schema topics are not decoded
      expect(topic.getValue()).toBeNull();
    });

    it('uses topic name segment when type is just "protobuf"', () => {
      const segmentRoot = protobuf.Root.fromJSON({
        nested: {
          SegmentName: {
            fields: { value: { type: 'int32', id: 1 } },
          },
        },
      });
      client.protobufSchemaManager['schemaCache'].set('SegmentName', segmentRoot);
      client.protobufSchemaManager['schemaCache'].set('/.schema/proto:SegmentName', segmentRoot);
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/path/SegmentName');
      topic.announce({ id: 1, name: '/path/SegmentName', type: 'protobuf', properties: {} });
      const segmentType = segmentRoot.lookupType('SegmentName');
      const encoded = segmentType.encode({ value: 7 }).finish();
      topic.updateValue(encoded, Date.now());
      expect(topic.getValue()).toEqual({ value: 7 });
    });

    it('does not throw when schema is not yet in cache (topic announced before schema topic)', () => {
      client.protobufSchemaManager.clearCache();
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/late-schema');
      expect(() =>
        topic.announce({ id: 1, name: '/proto/late-schema', type: 'proto:test.Simple', properties: {} })
      ).not.toThrow();
      expect(topic.announced).toBe(true);
    });

    it('does not set message name when type is neither proto: nor protobuf', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/some/topic');
      topic.announce({ id: 1, name: '/some/topic', type: 'string', properties: {} });
      expect(topic['_protobufMessageName']).toBeUndefined();
    });
  });

  describe('subscribe and notifySubscribers', () => {
    it('notifies subscribers with decoded value', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/sub');
      topic.announce({ id: 1, name: '/proto/sub', type: 'proto:test.Simple', properties: {} });
      const encoded = messageType.encode({ value: 88 }).finish();
      topic.updateValue(encoded, Date.now());

      const callback = vi.fn();
      topic.subscribe(callback);
      topic['notifySubscribers']();
      expect(callback).toHaveBeenCalledWith(
        { value: 88 },
        expect.objectContaining({ name: '/proto/sub', id: 1, type: 'proto:test.Simple' })
      );
    });

    it('invokes callback with decoded value when updateValue is called (override is used)', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/update-flow');
      topic.announce({ id: 1, name: '/proto/update-flow', type: 'proto:test.Simple', properties: {} });
      const callback = vi.fn();
      topic.subscribe(callback);

      const encoded = messageType.encode({ value: 99 }).finish();
      topic.updateValue(encoded, Date.now());

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { value: 99 },
        expect.objectContaining({ name: '/proto/update-flow', id: 1, type: 'proto:test.Simple' })
      );
    });

    it('invokes callback with decoded value when setValue is called (override is used)', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/set-flow');
      topic.announce({ id: 1, name: '/proto/set-flow', type: 'proto:test.Simple', properties: {} });
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      const callback = vi.fn();
      topic.subscribe(callback);

      topic.setValue({ value: 42 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { value: 42 },
        expect.objectContaining({ name: '/proto/set-flow', id: 1, type: 'proto:test.Simple' })
      );
    });
  });

  describe('publish', () => {
    it('publishes and resolves when schema is known', async () => {
      const topicName = '/proto/pub-unique-' + Math.random().toString(36).slice(2);
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, topicName);
      topic.announce({ id: 1, name: topicName, type: 'proto:test.Simple', properties: {} });

      const publishPromise = topic.publish({}, 5000);
      server.send(
        JSON.stringify([
          {
            method: 'announce',
            params: { name: topicName, id: 1, pubuid: 5000, type: 'proto:test.Simple', properties: {} },
          },
        ])
      );
      await publishPromise;

      expect(topic.publisher).toBe(true);
    });

    it('skips publish when already publisher', async () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/skip');
      topic.announce({ id: 1, name: '/proto/skip', type: 'proto:test.Simple', properties: {} });
      topic['_publisher'] = true;
      topic['_pubuid'] = 999;

      const publishSpy = vi.spyOn(client.messenger, 'publish').mockResolvedValue({
        method: 'announce',
        params: { name: '/proto/skip', id: 1, type: 'proto:test.Simple', properties: {}, pubuid: 999 },
      } as AnnounceMessage);

      await topic.publish({}, 999);
      expect(publishSpy).not.toHaveBeenCalled();
      publishSpy.mockRestore();
    });
  });

  describe('ensureMessageType / encode error', () => {
    it('setValue throws when message type is no longer in cache', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/no-schema');
      topic.announce({ id: 1, name: '/proto/no-schema', type: 'proto:test.Simple', properties: {} });
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      client.protobufSchemaManager.clearCache();
      topic['_protobufMessageType'] = null;
      expect(() => topic.setValue({ value: 1 })).toThrow(
        /Protobuf message type not found|Schema containing message type/
      );
    });

    it('updateValue throws when message type not in cache (decode path)', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/decode-fail');
      topic.announce({ id: 1, name: '/proto/decode-fail', type: 'proto:test.Simple', properties: {} });
      client.protobufSchemaManager.clearCache();
      topic['_protobufMessageType'] = null;
      const encoded = messageType.encode({ value: 1 }).finish();
      expect(() => topic.updateValue(encoded, Date.now())).toThrow(/Protobuf message type not found/);
    });
  });

  describe('constructor with protoFilePath', () => {
    it('catches and logs when loadProtoSchema fails (invalid path)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/from-file', {
        protoFilePath: '/nonexistent/file.proto',
      });
      expect(topic).toBeDefined();
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load proto schema from /nonexistent/file.proto:',
          expect.any(Error)
        );
      });
      consoleSpy.mockRestore();
    });

    it('setValue throws stored schema load error when protoFilePath failed to load', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/from-file', {
        protoFilePath: '/nonexistent/file.proto',
      });
      await vi.waitFor(() => {
        expect(topic['_schemaLoadError']).not.toBeNull();
      });
      expect(() => topic.setValue({ value: 1 })).toThrow(/Failed to load proto schema/);
    });
  });

  describe('decodeValue with validator', () => {
    it('validates decoded value in updateValue when validator is provided', () => {
      const schema = z.object({ value: z.number().int().min(0) });
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/validated-update', {
        validator: schema,
      });
      topic.announce({ id: 1, name: '/proto/validated-update', type: 'proto:test.Simple', properties: {} });
      const encoded = messageType.encode({ value: 3 }).finish();
      topic.updateValue(encoded, Date.now());
      expect(topic.getValue()).toEqual({ value: 3 });
    });
  });

  describe('notifySubscribers', () => {
    it('uses synthesized params when topic is not yet announced', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/unannounced');
      topic['_pubuid'] = 42;
      topic['_publishProperties'] = { retained: true };
      const callback = vi.fn();
      topic.subscribe(callback);
      topic['notifySubscribers']();
      expect(callback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          name: '/proto/unannounced',
          id: -1,
          type: 'protobuf',
          properties: { retained: true },
          pubuid: 42,
        })
      );
    });
  });

  describe('publish with protoFilePath', () => {
    it('registers schema then publishes when protoFilePath is set', async () => {
      const topicName = '/proto/from-proto-' + Math.random().toString(36).slice(2);
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, topicName, {
        protoFilePath: SIMPLE_PROTO_PATH,
      });
      const publishPromise = topic.publish({}, 6000);
      server.send(
        JSON.stringify([
          {
            method: 'announce',
            params: { name: topicName, id: 1, pubuid: 6000, type: 'proto:fixture.Simple', properties: {} },
          },
        ])
      );
      await publishPromise;
      expect(topic.publisher).toBe(true);
      expect(topic['_messageTypeString']).toBe('proto:fixture.Simple');
    });

    it('throws when loadProtoSchema fails during publish', async () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/bad-publish', {
        protoFilePath: '/nonexistent/schema.proto',
      });
      await expect(topic.publish({})).rejects.toThrow(/Failed to register protobuf schema before publishing/);
    });
  });

  describe('protoSource and messageType', () => {
    const SIMPLE_PROTO_SOURCE = `syntax = "proto3";
package fixture;
message Simple {
  int32 value = 1;
}
`;

    it('encodes and decodes using protoSource without a file path', async () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/source', {
        protoSource: SIMPLE_PROTO_SOURCE,
      });
      expect(topic['_protobufMessageType']).not.toBeNull();
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      topic.setValue({ value: 11 });
      expect(topic.getValue()).toEqual({ value: 11 });
    });

    it('encodes using a prebuilt messageType', () => {
      const topic = new NetworkTablesProtobufTopic<SimpleMessage>(client, '/proto/prebuilt', {
        messageType,
      });
      topic['_publisher'] = true;
      topic['_pubuid'] = 1;
      topic.setValue({ value: 22 });
      expect(topic.getValue()).toEqual({ value: 22 });
    });
  });
});
