import * as path from 'path';
import { fileURLToPath } from 'url';

import * as protobuf from 'protobufjs';
import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';

import { PubSubClient } from './pubsub';
import { ProtobufSchemaManager } from './protobuf-schema-manager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIMPLE_PROTO_PATH = path.join(__dirname, '__fixtures__', 'simple.proto');

describe('ProtobufSchemaManager', () => {
  let client: PubSubClient;
  let server: WSMock;
  const serverUrl = 'ws://localhost:5812/nt/1234';

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
    client['_isCleaningUp'] = false;
  });

  describe('constructor', () => {
    it('creates manager and subscribes to schema prefix', () => {
      const manager = new ProtobufSchemaManager(client);
      expect(manager).toBeDefined();
      expect(client.getPrefixTopicFromName('/.schema/proto:')).toBeDefined();
    });
  });

  describe('fetchMessageType', () => {
    it('returns type when message is in cache', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          foo: {
            nested: {
              Bar: {
                fields: { x: { type: 'int32', id: 1 } },
              },
            },
          },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      manager['schemaCache'].set('foo.Bar', root);
      manager['schemaCache'].set('key', root);

      const type = manager.fetchMessageType('foo.Bar');
      expect(type).toBeDefined();
      expect(type?.fullName).toMatch(/\.?foo\.Bar/);
    });

    it('returns null when message type not in cache', () => {
      const manager = new ProtobufSchemaManager(client);
      expect(manager.fetchMessageType('Unknown.Message')).toBeNull();
    });

    it('searches all cached schemas', () => {
      const root1 = protobuf.Root.fromJSON({
        nested: {
          a: { nested: { A: { fields: { f: { type: 'int32', id: 1 } } } } },
        },
      });
      const root2 = protobuf.Root.fromJSON({
        nested: {
          b: { nested: { B: { fields: { g: { type: 'int32', id: 1 } } } } },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      manager['schemaCache'].set('first', root1);
      manager['schemaCache'].set('second', root2);

      const typeB = manager.fetchMessageType('b.B');
      expect(typeB).toBeDefined();
      expect(typeB?.fullName).toMatch(/\.?b\.B/);
    });

    it('continues to next schema when lookupType throws (message not in first root)', () => {
      const rootA = protobuf.Root.fromJSON({
        nested: { a: { nested: { A: { fields: { f: { type: 'int32', id: 1 } } } } } },
      });
      const rootB = protobuf.Root.fromJSON({
        nested: { b: { nested: { B: { fields: { g: { type: 'int32', id: 1 } } } } } },
      });
      const manager = new ProtobufSchemaManager(client);
      manager['schemaCache'].set('onlyA', rootA);
      manager['schemaCache'].set('onlyB', rootB);
      const type = manager.fetchMessageType('b.B');
      expect(type).toBeDefined();
      expect(type?.fullName).toMatch(/\.?b\.B/);
    });
  });

  describe('clearCache', () => {
    it('clears schema cache', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          x: {
            nested: {
              X: { fields: { f: { type: 'int32', id: 1 } } },
            },
          },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      manager['schemaCache'].set('x.X', root);
      manager.clearCache();
      expect(manager.fetchMessageType('x.X')).toBeNull();
    });
  });

  describe('getMessageNameFromProto', () => {
    it('returns full name for root with top-level message', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          TopMessage: {
            fields: { value: { type: 'int32', id: 1 } },
          },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      expect(manager.getMessageNameFromProto(root)).toBe('TopMessage');
    });

    it('returns full name for root with nested package message', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          pkg: {
            nested: {
              NestedMessage: {
                fields: { value: { type: 'int32', id: 1 } },
              },
            },
          },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      expect(manager.getMessageNameFromProto(root)).toBe('pkg.NestedMessage');
    });

    it('returns message name without leading dot for NetworkTables type string', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          networktables: {
            nested: {
              TestData: {
                fields: {
                  timestamp: { type: 'uint64', id: 1 },
                  value: { type: 'double', id: 2 },
                },
              },
            },
          },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      const messageName = manager.getMessageNameFromProto(root);
      expect(messageName).toBe('networktables.TestData');
      expect(messageName).not.toMatch(/^\./);
    });

    it('throws when root has no nested', () => {
      const root = protobuf.Root.fromJSON({});
      const manager = new ProtobufSchemaManager(client);
      expect(() => manager.getMessageNameFromProto(root)).toThrow('Proto file has no messages');
    });

    it('throws when no message type in root', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          notAMessage: {},
        },
      });
      const manager = new ProtobufSchemaManager(client);
      expect(() => manager.getMessageNameFromProto(root)).toThrow('No message type found in proto file');
    });

    it('finds first message when first nested is namespace with no message (continues loop)', () => {
      const root = protobuf.Root.fromJSON({
        nested: {
          emptyNs: {
            nested: {},
          },
          pkg: {
            nested: {
              FirstMessage: {
                fields: { value: { type: 'int32', id: 1 } },
              },
            },
          },
        },
      });
      const manager = new ProtobufSchemaManager(client);
      expect(manager.getMessageNameFromProto(root)).toBe('pkg.FirstMessage');
    });
  });

  describe('registerSchema', () => {
    it('loads proto file and returns message name and root', async () => {
      const manager = new ProtobufSchemaManager(client);
      const result = await manager.registerSchema(SIMPLE_PROTO_PATH);
      expect(result.messageName).toBe('fixture.Simple');
      expect(result.root).toBeDefined();
      expect(manager['schemaCache'].has('/.schema/proto:simple.proto')).toBe(true);
      expect(manager['registeredSchemas'].has('/.schema/proto:simple.proto')).toBe(true);
    });

    it('returns cached result when schema already registered', async () => {
      const manager = new ProtobufSchemaManager(client);
      const first = await manager.registerSchema(SIMPLE_PROTO_PATH);
      const second = await manager.registerSchema(SIMPLE_PROTO_PATH);
      expect(first.messageName).toBe(second.messageName);
      expect(first.root).toBe(second.root);
    });

    it('uses provided messageName when given', async () => {
      const manager = new ProtobufSchemaManager(client);
      const result = await manager.registerSchema(SIMPLE_PROTO_PATH, 'custom.Name');
      expect(result.messageName).toBe('custom.Name');
    });

    it('throws when proto file does not exist or is invalid', async () => {
      const manager = new ProtobufSchemaManager(client);
      await expect(manager.registerSchema('/nonexistent/path.proto')).rejects.toThrow(
        /Failed to (load proto file|extract\/encode FileDescriptorProto)/
      );
    });

    it('re-loads when schema was registered but cache was cleared', async () => {
      const manager = new ProtobufSchemaManager(client);
      const first = await manager.registerSchema(SIMPLE_PROTO_PATH);
      manager['schemaCache'].delete('/.schema/proto:simple.proto');
      const second = await manager.registerSchema(SIMPLE_PROTO_PATH);
      expect(second.messageName).toBe(first.messageName);
      expect(second.root).toBeDefined();
      expect(manager['schemaCache'].has('/.schema/proto:simple.proto')).toBe(true);
    });
  });

  describe('handleSchemaUpdate (via prefix subscription)', () => {
    it('does not throw when subscription callback receives null', () => {
      const manager = new ProtobufSchemaManager(client);
      client['onTopicAnnounce']({
        id: 101,
        name: '/.schema/proto:other.proto',
        type: 'proto:FileDescriptorProto',
        properties: {},
      } as never);
      expect(() => {
        client['onTopicUpdate']({
          topicId: 101,
          value: null,
          typeNum: NetworkTablesTypeInfos.kUint8Array[0],
          serverTime: Date.now(),
        } as never);
      }).not.toThrow();
      expect(manager.fetchMessageType('any.Message')).toBeNull();
    });

    it('decodes and caches schema from topic update', async () => {
      // Build encoded FileDescriptorProto the same way the manager does (from a loaded proto)
      const root = await protobuf.load(SIMPLE_PROTO_PATH);
      const descriptor = root.toDescriptor('proto3');
      if (!descriptor?.file?.length) throw new Error('No descriptor');
      const fileDescriptorProto = descriptor.file[0];
      const descriptorJson = await import('protobufjs/google/protobuf/descriptor.json', {
        with: { type: 'json' },
      }).then((m) => m.default);
      const fileDescriptorType = protobuf.Root.fromJSON(descriptorJson as protobuf.INamespace).lookupType(
        'google.protobuf.FileDescriptorProto'
      );
      const encoded = fileDescriptorType.encode(fileDescriptorProto).finish();

      const manager = new ProtobufSchemaManager(client);
      const prefixTopic = client.getPrefixTopicFromName('/.schema/proto:');
      expect(prefixTopic).toBeDefined();

      client['onTopicAnnounce']({
        id: 100,
        name: '/.schema/proto:simple.proto',
        type: 'proto:FileDescriptorProto',
        properties: {},
      } as never);
      client['onTopicUpdate']({
        topicId: 100,
        value: encoded,
        typeNum: 5,
        serverTime: Date.now(),
      } as never);

      const type = manager.fetchMessageType('fixture.Simple');
      expect(type).toBeDefined();
      expect(type?.fullName).toMatch(/\.?fixture\.Simple/);
    });

    it('skips update when value is not ArrayBuffer view', () => {
      const manager = new ProtobufSchemaManager(client);
      client['onTopicAnnounce']({
        id: 102,
        name: '/.schema/proto:fake.proto',
        type: 'proto:FileDescriptorProto',
        properties: {},
      } as never);
      expect(() => {
        client['onTopicUpdate']({
          topicId: 102,
          value: [1, 2, 3] as unknown as Uint8Array,
          typeNum: NetworkTablesTypeInfos.kUint8Array[0],
          serverTime: Date.now(),
        } as never);
      }).not.toThrow();
      expect(manager.fetchMessageType('any.Message')).toBeNull();
    });

    it('skips update when topic name has no proto file name after prefix', () => {
      const manager = new ProtobufSchemaManager(client);
      client['onTopicAnnounce']({
        id: 103,
        name: '/.schema/proto:',
        type: 'proto:FileDescriptorProto',
        properties: {},
      } as never);
      expect(() => {
        client['onTopicUpdate']({
          topicId: 103,
          value: new Uint8Array(0),
          typeNum: NetworkTablesTypeInfos.kUint8Array[0],
          serverTime: Date.now(),
        } as never);
      }).not.toThrow();
      expect(manager.fetchMessageType('any.Message')).toBeNull();
    });
  });
});
