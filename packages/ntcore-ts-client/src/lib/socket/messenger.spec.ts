import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';

import { Messenger } from './messenger';
import { NetworkTablesSocket } from './socket';

import type { NetworkTablesTopic } from '../pubsub/topic';
import type {
  AnnounceMessage,
  PublishMessageParams,
  SetPropertiesMessageParams,
  SubscribeMessageParams,
  PropertiesMessage,
} from '../types/types';

describe('Messenger', () => {
  let messenger: Messenger;
  let serverUrl: string;
  let server: WSMock;
  const onTopicUpdate = vi.fn();
  const onAnnounce = vi.fn();
  const onUnannounce = vi.fn();
  const onTopicProperties = vi.fn();
  let testCounter = 0;

  beforeEach(async () => {
    // Clean up any existing instances first
    Messenger['_instances'].forEach((instance: Messenger) => {
      instance.socket.stopAutoConnect();
      instance.socket.close();
    });
    Messenger['_instances'].clear();
    NetworkTablesSocket['instances'].forEach((socket: NetworkTablesSocket) => {
      socket.stopAutoConnect();
      socket.close();
    });
    NetworkTablesSocket['instances'].clear();

    // Wait a bit for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Use unique URL for each test to avoid conflicts
    testCounter++;
    serverUrl = `ws://localhost:5810/nt/${testCounter}`;
    server = new WSMock(serverUrl);

    messenger = Messenger.getInstance(serverUrl, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);

    await server.connected;
  }, 30000);

  afterEach(async () => {
    // Stop auto-connect and close socket before cleaning up
    if (messenger) {
      messenger.socket.stopAutoConnect();
      messenger.socket.close();
    }

    // Wait a bit for socket to close
    await new Promise((resolve) => setTimeout(resolve, 50));

    WSMock.clean();

    // Clear instances
    Messenger['_instances'].clear();
    NetworkTablesSocket['instances'].clear();

    onTopicUpdate.mockClear();
    onAnnounce.mockClear();
    onUnannounce.mockClear();
    onTopicProperties.mockClear();
  });

  describe('getInstance', () => {
    it('should create a new instance if one does not exist', () => {
      expect(messenger).toBeInstanceOf(Messenger);
      expect(messenger.socket).toBeDefined();
    });

    it('should return the same instance for the same server URL', () => {
      const instance1 = Messenger.getInstance(serverUrl, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);
      const instance2 = Messenger.getInstance(serverUrl, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);

      expect(instance1).toBe(instance2);
    });

    it('should create different instances for different server URLs', () => {
      const url1 = 'ws://localhost:5810/nt/1234';
      const url2 = 'ws://localhost:5810/nt/5678';

      const instance1 = Messenger.getInstance(url1, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);
      const instance2 = Messenger.getInstance(url2, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('socket', () => {
    it('should return the NetworkTablesSocket instance', () => {
      expect(messenger.socket).toBeDefined();
      expect(messenger.socket.websocket).toBeDefined();
    });
  });

  describe('reinstantiate', () => {
    it('should reinstantiate the socket with a new URL', () => {
      const newUrl = 'ws://localhost:5810/nt/5678';
      const stopAutoConnectSpy = vi.spyOn(messenger.socket, 'stopAutoConnect');
      const reinstantiateSpy = vi.spyOn(messenger.socket, 'reinstantiate');
      const startAutoConnectSpy = vi.spyOn(messenger.socket, 'startAutoConnect');

      messenger.reinstantiate(newUrl);

      expect(stopAutoConnectSpy).toHaveBeenCalled();
      expect(reinstantiateSpy).toHaveBeenCalledWith(newUrl);
      expect(startAutoConnectSpy).toHaveBeenCalled();
    });
  });

  describe('getPublications', () => {
    it('should return an empty iterator when no publications exist', () => {
      const publications = Array.from(messenger.getPublications());
      expect(publications).toHaveLength(0);
    });

    it('should return all publications', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      // Mock the announce response
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      // Set up promise to wait for publish
      const publishPromise = messenger.publish(params);

      // Send the announce message
      server.send(JSON.stringify([announceMessage]));

      await publishPromise;

      const publications = Array.from(messenger.getPublications());
      expect(publications).toHaveLength(1);
      expect(publications[0][0]).toBe(0);
      expect(publications[0][1]).toEqual(params);
    });
  });

  describe('getSubscriptions', () => {
    it('should return an empty iterator when no subscriptions exist', () => {
      const subscriptions = Array.from(messenger.getSubscriptions());
      expect(subscriptions).toHaveLength(0);
    });

    it('should return all subscriptions', () => {
      const params: SubscribeMessageParams = {
        topics: ['test'],
        subuid: 0,
        options: {},
      };

      messenger.subscribe(params);

      const subscriptions = Array.from(messenger.getSubscriptions());
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0][0]).toBe(0);
      expect(subscriptions[0][1]).toEqual(params);
    });
  });

  describe('onSocketOpen', () => {
    it('should resubscribe all topics when socket opens', () => {
      const params: SubscribeMessageParams = {
        topics: ['test1', 'test2'],
        subuid: 0,
        options: {},
      };

      messenger.subscribe(params);

      // Clear the mock to track new calls
      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      // Simulate socket opening
      messenger.onSocketOpen();

      // Should have sent subscribe message
      expect(sendTextFrameSpy).toHaveBeenCalled();
      const callArgs = sendTextFrameSpy.mock.calls[0][0];
      expect(callArgs.method).toBe('subscribe');
      expect(callArgs.params).toEqual(params);
    });

    it('should republish all topics when socket opens', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      // Mock the announce response
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      const publishPromise = messenger.publish(params);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;

      // Clear the mock to track new calls
      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      // Simulate socket opening
      messenger.onSocketOpen();

      // Should have sent publish message
      expect(sendTextFrameSpy).toHaveBeenCalled();
      const callArgs = sendTextFrameSpy.mock.calls.find((call) => call[0].method === 'publish');
      expect(callArgs).toBeDefined();
      expect(callArgs![0].params).toEqual(params);
    });
  });

  describe('onSocketClose', () => {
    it('should be callable without errors', () => {
      expect(() => messenger.onSocketClose()).not.toThrow();
    });
  });

  describe('publish', () => {
    it('should publish a topic and wait for announcement', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      const publishPromise = messenger.publish(params);

      // Send the announce message
      server.send(JSON.stringify([announceMessage]));

      const result = await publishPromise;

      expect(result).toEqual(announceMessage);
      expect(messenger.getPublications().next().value).toBeDefined();
    });

    it('should reject if topic is already published', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      // First publish
      const publishPromise1 = messenger.publish(params);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise1;

      // Second publish should reject
      await expect(messenger.publish(params)).rejects.toThrow('Topic is already published');
    });

    it('should allow force publish even if already published', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      // First publish
      const publishPromise1 = messenger.publish(params);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise1;

      // Force publish should succeed
      const publishPromise2 = messenger.publish(params, true);
      server.send(JSON.stringify([announceMessage]));
      await expect(publishPromise2).resolves.toEqual(announceMessage);
    });

    it('should reject if announcement is not received within timeout', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      vi.useFakeTimers();
      try {
        const publishPromise = messenger.publish(params);
        // Allow microtasks to run so the internal timeout is scheduled.
        await Promise.resolve();
        vi.advanceTimersByTime(3000);
        await expect(publishPromise).rejects.toThrow('was not announced within 3 seconds');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should send subscribe message as hotfix', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      const publishPromise = messenger.publish(params);

      // Check that subscribe was called
      const subscribeCalls = sendTextFrameSpy.mock.calls.filter((call) => call[0].method === 'subscribe');
      expect(subscribeCalls.length).toBeGreaterThan(0);

      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      server.send(JSON.stringify([announceMessage]));
      await publishPromise;
    });
  });

  describe('unpublish', () => {
    it('should unpublish a topic', async () => {
      const params: PublishMessageParams = {
        name: 'test',
        pubuid: 0,
        type: 'string',
        properties: {},
      };

      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          pubuid: 0,
          type: 'string',
          id: 1,
          properties: {},
        },
      };

      // Publish first
      const publishPromise = messenger.publish(params);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;

      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      // Unpublish
      messenger.unpublish(0);

      expect(sendTextFrameSpy).toHaveBeenCalledWith({
        method: 'unpublish',
        params: { pubuid: 0 },
      });

      const publications = Array.from(messenger.getPublications());
      expect(publications).toHaveLength(0);
    });

    it('should not send message if topic is not published', () => {
      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      messenger.unpublish(999);

      expect(sendTextFrameSpy).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to topics', () => {
      const params: SubscribeMessageParams = {
        topics: ['test1', 'test2'],
        subuid: 0,
        options: {},
      };

      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      messenger.subscribe(params);

      expect(sendTextFrameSpy).toHaveBeenCalledWith({
        method: 'subscribe',
        params,
      });

      const subscriptions = Array.from(messenger.getSubscriptions());
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0][1]).toEqual(params);
    });

    it('should not subscribe if already subscribed', () => {
      const params: SubscribeMessageParams = {
        topics: ['test'],
        subuid: 0,
        options: {},
      };

      messenger.subscribe(params);
      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');
      sendTextFrameSpy.mockClear();

      messenger.subscribe(params);

      expect(sendTextFrameSpy).not.toHaveBeenCalled();
    });

    it('should allow force subscribe even if already subscribed', () => {
      const params: SubscribeMessageParams = {
        topics: ['test'],
        subuid: 0,
        options: {},
      };

      messenger.subscribe(params);
      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');
      sendTextFrameSpy.mockClear();

      messenger.subscribe(params, true);

      expect(sendTextFrameSpy).toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from topics', () => {
      const params: SubscribeMessageParams = {
        topics: ['test'],
        subuid: 0,
        options: {},
      };

      messenger.subscribe(params);

      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      messenger.unsubscribe(0);

      expect(sendTextFrameSpy).toHaveBeenCalledWith({
        method: 'unsubscribe',
        params: { subuid: 0 },
      });

      const subscriptions = Array.from(messenger.getSubscriptions());
      expect(subscriptions).toHaveLength(0);
    });

    it('should not send message if not subscribed', () => {
      const sendTextFrameSpy = vi.spyOn(messenger.socket, 'sendTextFrame');

      messenger.unsubscribe(999);

      expect(sendTextFrameSpy).not.toHaveBeenCalled();
    });
  });

  describe('setProperties', () => {
    it('should set properties and wait for ack', async () => {
      const params: SetPropertiesMessageParams = {
        name: 'test',
        update: { persistent: true },
      };

      const propertiesMessage: PropertiesMessage = {
        method: 'properties',
        params: {
          name: 'test',
          ack: true,
        },
      };

      const setPropertiesPromise = messenger.setProperties(params);

      // Send the properties message
      server.send(JSON.stringify([propertiesMessage]));

      const result = await setPropertiesPromise;

      expect(result).toEqual(propertiesMessage);
    });

    it('should reject if properties ack is not received within timeout', async () => {
      const params: SetPropertiesMessageParams = {
        name: 'test',
        update: { persistent: true },
      };

      vi.useFakeTimers();
      try {
        const p = messenger.setProperties(params);
        await Promise.resolve();
        vi.advanceTimersByTime(3000);
        await expect(p).rejects.toThrow('were not acknowledged within 3 seconds');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should only resolve when ack is true', async () => {
      const params: SetPropertiesMessageParams = {
        name: 'test',
        update: { persistent: true },
      };

      const propertiesMessageNoAck: PropertiesMessage = {
        method: 'properties',
        params: {
          name: 'test',
          ack: false,
        },
      };

      const propertiesMessageAck: PropertiesMessage = {
        method: 'properties',
        params: {
          name: 'test',
          ack: true,
        },
      };

      const setPropertiesPromise = messenger.setProperties(params);
      let resolved = false;
      void setPropertiesPromise.then(() => {
        resolved = true;
      });

      // Send non-ack message first (should be ignored)
      server.send(JSON.stringify([propertiesMessageNoAck]));

      // Ensure it has not resolved just because we received a non-ack response
      await Promise.resolve();
      expect(resolved).toBe(false);

      // Send ack message
      server.send(JSON.stringify([propertiesMessageAck]));

      const result = await setPropertiesPromise;

      expect(result).toEqual(propertiesMessageAck);
    });
  });

  describe('sendToTopic', () => {
    it('should send value to topic', () => {
      const topic = {
        name: 'test',
        typeInfo: NetworkTablesTypeInfos.kString,
        publisher: true,
        pubuid: 123,
        id: 0,
        announced: true,
      } as NetworkTablesTopic<string>;

      const sendValueToTopicSpy = vi.spyOn(messenger.socket, 'sendValueToTopic');

      messenger.sendToTopic(topic, 'test-value');

      expect(sendValueToTopicSpy).toHaveBeenCalledWith(123, 'test-value', NetworkTablesTypeInfos.kString);
    });

    it('should throw error if topic is not a publisher', () => {
      const topic = {
        name: 'test',
        typeInfo: NetworkTablesTypeInfos.kString,
        publisher: false,
        pubuid: undefined,
        announced: false,
      } as NetworkTablesTopic<string>;

      expect(() => messenger.sendToTopic(topic, 'test-value')).toThrow('is not a publisher');
    });

    it('should throw error if topic has no pubuid', () => {
      const topic = {
        name: 'test',
        typeInfo: NetworkTablesTypeInfos.kString,
        publisher: true,
        pubuid: undefined,
        announced: false,
      } as NetworkTablesTopic<string>;

      expect(() => messenger.sendToTopic(topic, 'test-value')).toThrow('is not a publisher');
    });
  });

  describe('getNextPubUID', () => {
    it('should return incrementing publisher UIDs', () => {
      const uid1 = messenger.getNextPubUID();
      const uid2 = messenger.getNextPubUID();
      const uid3 = messenger.getNextPubUID();

      expect(uid1).toBe(0);
      expect(uid2).toBe(1);
      expect(uid3).toBe(2);
    });
  });

  describe('getNextSubUID', () => {
    it('should return incrementing subscriber UIDs', () => {
      const uid1 = messenger.getNextSubUID();
      const uid2 = messenger.getNextSubUID();
      const uid3 = messenger.getNextSubUID();

      expect(uid1).toBe(0);
      expect(uid2).toBe(1);
      expect(uid3).toBe(2);
    });
  });
});
