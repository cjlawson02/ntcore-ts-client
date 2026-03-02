import WSMock from 'vitest-websocket-mock';

import { PubSubClient } from '../pubsub/pubsub';
import { StructSchemaManager } from './struct-schema-manager';

describe('StructSchemaManager', () => {
  let client: PubSubClient;
  let server: WSMock;
  const serverUrl = 'ws://localhost:5813/nt/5678';

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
    it('subscribes to /.schema/struct: prefix', () => {
      const manager = new StructSchemaManager(client);
      expect(manager).toBeDefined();
      expect(client.getPrefixTopicFromName('/.schema/struct:')).toBeDefined();
    });
  });

  describe('handleSchemaUpdate', () => {
    it('decode UTF-8, parse, cache', () => {
      const manager = new StructSchemaManager(client);
      const prefixTopic = client.getPrefixTopicFromName('/.schema/struct:');
      if (!prefixTopic) throw new Error('expected prefix topic');
      const schemaStr = 'double x;double y';
      prefixTopic.updateValue(
        { name: '/.schema/struct:Translation2d', id: 1, type: 'structschema', properties: {} },
        new TextEncoder().encode(schemaStr),
        0
      );
      const desc = manager.fetchDescriptor('Translation2d');
      expect(desc).not.toBeNull();
      expect(desc?.typeName).toBe('Translation2d');
      expect(desc?.size).toBe(16);
      expect(desc?.fields).toHaveLength(2);
    });

    it('ignores null value', () => {
      const manager = new StructSchemaManager(client);
      const prefixTopic = client.getPrefixTopicFromName('/.schema/struct:');
      if (!prefixTopic) throw new Error('expected prefix topic');
      prefixTopic.updateValue(
        { name: '/.schema/struct:SomeType', id: 1, type: 'structschema', properties: {} },
        null as unknown as Uint8Array,
        0
      );
      expect(manager.fetchDescriptor('SomeType')).toBeNull();
    });
  });

  describe('fetchDescriptor', () => {
    it('returns descriptor when cached', () => {
      const manager = new StructSchemaManager(client);
      const prefixTopic = client.getPrefixTopicFromName('/.schema/struct:');
      if (!prefixTopic) throw new Error('expected prefix topic');
      prefixTopic.updateValue(
        { name: '/.schema/struct:Rotation2d', id: 2, type: 'structschema', properties: {} },
        new TextEncoder().encode('double value'),
        0
      );
      const d1 = manager.fetchDescriptor('Rotation2d');
      const d2 = manager.fetchDescriptor('Rotation2d');
      expect(d1).toBe(d2);
      expect(d1?.typeName).toBe('Rotation2d');
    });

    it('returns null when not cached', () => {
      const manager = new StructSchemaManager(client);
      expect(manager.fetchDescriptor('NonExistentType')).toBeNull();
    });

    it('nested structs resolved in dependency order', () => {
      const manager = new StructSchemaManager(client);
      const prefixTopic = client.getPrefixTopicFromName('/.schema/struct:');
      if (!prefixTopic) throw new Error('expected prefix topic');
      prefixTopic.updateValue(
        { name: '/.schema/struct:Translation2d', id: 1, type: 'structschema', properties: {} },
        new TextEncoder().encode('double x;double y'),
        0
      );
      prefixTopic.updateValue(
        { name: '/.schema/struct:Rotation2d', id: 2, type: 'structschema', properties: {} },
        new TextEncoder().encode('double value'),
        0
      );
      prefixTopic.updateValue(
        { name: '/.schema/struct:Pose2d', id: 3, type: 'structschema', properties: {} },
        new TextEncoder().encode('Translation2d translation;Rotation2d rotation'),
        0
      );
      const poseDesc = manager.fetchDescriptor('Pose2d');
      expect(poseDesc).not.toBeNull();
      expect(poseDesc?.size).toBe(24);
      expect(poseDesc?.fields[0].nestedDescriptor?.typeName).toBe('Translation2d');
      expect(poseDesc?.fields[1].nestedDescriptor?.typeName).toBe('Rotation2d');
    });

    it('returns built-in descriptor when not in network cache', () => {
      const manager = new StructSchemaManager(client);
      const desc = manager.fetchDescriptor('Pose2d');
      expect(desc).not.toBeNull();
      expect(desc?.typeName).toBe('Pose2d');
      expect(desc?.size).toBe(24);
    });
  });

  describe('hasSchema', () => {
    it('returns true when descriptor available', () => {
      const manager = new StructSchemaManager(client);
      expect(manager.hasSchema('struct:Pose2d')).toBe(true);
      expect(manager.hasSchema('Pose2d')).toBe(true);
    });
    it('returns false when not available', () => {
      const manager = new StructSchemaManager(client);
      manager.clearCache();
      expect(manager.hasSchema('NonExistent')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('clears all cached descriptors', () => {
      const manager = new StructSchemaManager(client);
      const prefixTopic = client.getPrefixTopicFromName('/.schema/struct:');
      if (!prefixTopic) throw new Error('expected prefix topic');
      prefixTopic.updateValue(
        { name: '/.schema/struct:Custom', id: 1, type: 'structschema', properties: {} },
        new TextEncoder().encode('double a'),
        0
      );
      expect(manager.fetchDescriptor('Custom')).not.toBeNull();
      manager.clearCache();
      expect(manager.fetchDescriptor('Custom')).toBeNull();
      expect(manager.fetchDescriptor('Pose2d')).not.toBeNull(); // built-ins survive clearCache
    });
  });
});
