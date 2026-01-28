import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';

import { PubSubClient } from './pubsub';
import { NetworkTablesTopic } from './topic';

import type { AnnounceMessage, PropertiesMessage, SubscribeMessageParams } from '../types/types';
import type { Mock } from 'vitest';

describe('Topic', () => {
  let topic: NetworkTablesTopic<string>;
  let server: WSMock;
  let client: PubSubClient;
  const serverUrl = 'ws://localhost:5810/nt/1234';

  beforeAll(async () => {
    server = new WSMock(serverUrl);
    client = PubSubClient.getInstance(serverUrl);

    await server.connected;
  });

  beforeEach(() => {
    topic = new NetworkTablesTopic<string>(client, 'test', NetworkTablesTypeInfos.kString, 'default');
  });

  afterEach(() => {
    topic['client']['topics'].clear();
    topic.subscribers.clear();
    topic['_publisher'] = false;
    topic['_pubuid'] = undefined;
  });

  describe('constructor', () => {
    it('returns the existing topic if it already exists', () => {
      const newTopic = new NetworkTablesTopic<string>(
        topic['client'],
        'test',
        NetworkTablesTypeInfos.kString,
        'default'
      );
      expect(newTopic).toBe(topic);
    });

    it('should error if the existing topic has a different type', () => {
      expect(
        () => new NetworkTablesTopic<boolean>(topic['client'], 'test', NetworkTablesTypeInfos.kBoolean, true)
      ).toThrow('Topic test already exists, but with a different type.');
    });

    it('should return null if there is no default value', () => {
      const newTopic = new NetworkTablesTopic<string>(
        topic['client'],
        'test-no-default',
        NetworkTablesTypeInfos.kString
      );
      expect(newTopic.getValue()).toBeNull();
    });
  });

  describe('setValue', () => {
    it('throws an error if the client is not the publisher', () => {
      expect(() => topic.setValue('new value')).toThrow('Cannot set value on topic without being the publisher');
    });

    it('allows the value to be set if the client is the publisher', async () => {
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 1234,
          type: 'string',
          properties: {},
        },
      };

      const publishPromise = topic.publish({}, 1234);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;
      topic.setValue('new value');
      expect(topic.getValue()).toEqual('new value');
    });

    it('resends the latest value after reconnect (publisher)', () => {
      // Arrange: make the topic a publisher with a pubuid and a retained local value
      topic['_publisher'] = true;
      topic['_pubuid'] = 9000;

      const sendToTopicSpy = vi.spyOn(topic['client'].messenger, 'sendToTopic').mockReturnValue(123);
      const isConnectedSpy = vi.spyOn(topic['client'].messenger.socket, 'isConnected').mockReturnValue(true);

      topic.setValue('v2');
      sendToTopicSpy.mockClear();

      // Act: simulate a reconnect flush
      topic.resendLatestValue();

      expect(sendToTopicSpy).toHaveBeenCalledTimes(1);
      expect(sendToTopicSpy).toHaveBeenCalledWith(topic, 'v2');

      sendToTopicSpy.mockRestore();
      isConnectedSpy.mockRestore();
    });
  });

  describe('getValue', () => {
    it('gets the correct default value', () => {
      expect(topic.getValue()).toEqual('default');
    });
  });

  describe('updateValue', () => {
    it('updates the value correctly', () => {
      topic.announce({ id: 1, name: 'test', type: 'string', properties: {} });
      topic.updateValue('new value', Date.now());
      expect(topic.getValue()).toEqual('new value');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(topic.lastChangedTime! - Date.now()).toBeLessThan(10);
    });
  });

  describe('announce', () => {
    it('marks the topic as announced when announce is called', () => {
      expect(topic.announced).toBe(false);
      topic.announce({ id: 1, name: 'test', type: 'string', properties: {} });
      expect(topic.announced).toBe(true);
      expect(topic.id).toEqual(1);
    });
  });

  describe('unannounce', () => {
    it('marks the topic as unannounced when unannounce is called', () => {
      topic.announce({ id: 1, name: 'test', type: 'string', properties: {} });
      expect(topic.announced).toBe(true);
      topic.unannounce();
      expect(topic.announced).toBe(false);
    });
  });

  describe('subscribe', () => {
    let callback: Mock;
    beforeEach(() => {
      callback = vi.fn();
    });

    it('should add the callback to the list of subscribers', () => {
      topic.subscribe(callback);
      expect(topic.subscribers.size).toEqual(1);
      expect(topic.subscribers.values().next().value).toEqual({
        callback,
        options: {},
      });
    });

    it('should send a subscribe message to the server', () => {
      const send = vi.fn();
      topic['client']['_messenger']['_socket']['sendTextFrame'] = send;
      topic.subscribe(callback);
      expect(send).toHaveBeenCalledWith({
        method: 'subscribe',
        params: {
          topics: ['test'],
          subuid: expect.any(Number),
          options: {},
        } as SubscribeMessageParams,
      });
    });
  });

  describe('unsubscribe', () => {
    it('removes the subscriber from the topic', () => {
      const callback = (_: string | null) => vi.fn();
      const options = {};
      topic.subscribe(callback, options);
      expect(topic.subscribers.size).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      topic.unsubscribe(topic.subscribers.keys().next().value!, true);
      expect(topic.subscribers.size).toBe(0);
    });
    it('does nothing if the callback is not a subscriber', () => {
      expect(topic.subscribers.size).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      topic.unsubscribe(topic.subscribers.keys().next().value!);
      expect(topic.subscribers.size).toBe(0);
    });
  });

  describe('unsubscribeAll', () => {
    it('removes all subscribers from the topic', () => {
      const callback = (_: string | null) => vi.fn();
      const options = {};
      topic.subscribe(callback, options);
      topic.subscribe(callback, options);
      expect(topic.subscribers.size).toBe(2);
      topic.unsubscribeAll();
      expect(topic.subscribers.size).toBe(0);
    });
  });

  describe('resubscribeAll', () => {
    it('resubscribes all subscribers to the topic', () => {
      const callback = (_: string | null) => vi.fn();
      const options = {};
      topic.subscribe(callback, options);
      topic.subscribe(callback, options);
      expect(topic.subscribers.size).toBe(2);
      topic.resubscribeAll(topic['client']);
      expect(topic.subscribers.size).toBe(2);
    });
  });

  describe('notifySubscribers', () => {
    it('calls the callback with the value', () => {
      const callback = vi.fn();
      topic.subscribe(callback);
      topic['value'] = 'foo';
      topic['notifySubscribers']();
      expect(callback).toHaveBeenCalledWith(
        'foo',
        expect.objectContaining({
          name: 'test',
          id: -1,
          type: 'string',
          properties: {},
        })
      );
    });
  });

  describe('publish', () => {
    it('sets the publisher to the client', async () => {
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 1000,
          type: 'string',
          properties: {},
        },
      };
      const publishPromise = topic.publish({}, 1000);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;
      expect(topic.publisher).toBe(true);
      expect(topic.pubuid).toBeDefined();
    });

    it('does not set the publisher if the client is already the publisher', async () => {
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 1111,
          type: 'string',
          properties: {},
        },
      };
      const publishPromise = topic.publish({}, 1111);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;
      const id = topic.pubuid;

      await topic.publish();
      expect(id).toEqual(topic.pubuid);
    });

    it('should throw an error if the topic is not announced', async () => {
      topic = new NetworkTablesTopic<string>(client, 'test2', NetworkTablesTypeInfos.kString, 'default');

      // Ensure publish() does NOT use the optimistic resolution workaround by creating an
      // exact subscription match for this topic name.
      topic.subscribe(() => {}, {}, undefined, false);

      vi.useFakeTimers();
      try {
        const publishPromise = topic.publish({}, 1);
        await Promise.resolve();
        vi.advanceTimersByTime(3000);
        await expect(publishPromise).rejects.toThrow('was not announced within 3 seconds');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should clear timeout when announcement arrives quickly', async () => {
      // This test verifies the timeout cleanup fix - if announcement comes back
      // quickly, the timeout should be cleared to prevent it from firing later
      const publishPromise = topic.publish({}, 2000);

      // Send announcement quickly (100ms)
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 2000,
          type: 'string',
          properties: {},
        },
      };
      server.send(JSON.stringify([announceMessage]));

      // Wait for publish to complete
      await publishPromise;

      // Wait longer than the 3 second timeout to ensure it was cleared
      await new Promise((resolve) => setTimeout(resolve, 3200));

      // If we get here without an error, the timeout was properly cleared
      expect(topic.publisher).toBe(true);
      expect(topic.pubuid).toBe(2000);
    });

    it('should prevent race conditions when publish is called concurrently', async () => {
      // This test verifies that concurrent calls to publish() share the same operation
      let publishCallCount = 0;
      const originalMessengerPublish = client.messenger.publish.bind(client.messenger);

      // Track how many times messenger.publish is called
      client.messenger.publish = vi.fn().mockImplementation(async (params) => {
        publishCallCount++;
        return originalMessengerPublish(params);
      });

      // Send announcement
      setTimeout(() => {
        const announceMessage: AnnounceMessage = {
          method: 'announce',
          params: {
            name: 'test',
            id: 1,
            pubuid: 3000,
            type: 'string',
            properties: {},
          },
        };
        server.send(JSON.stringify([announceMessage]));
      }, 100);

      // Call publish concurrently multiple times
      const publishPromises = [topic.publish({}, 3000), topic.publish({}, 3000), topic.publish({}, 3000)];

      // All promises should resolve
      await Promise.all(publishPromises);

      // messenger.publish should only be called once (not three times)
      expect(publishCallCount).toBe(1);
      expect(topic.publisher).toBe(true);
      expect(topic.pubuid).toBe(3000);

      // Restore original method
      client.messenger.publish = originalMessengerPublish;
    });

    it('should allow separate publish operations for different topics', async () => {
      const topic2 = new NetworkTablesTopic<string>(client, 'test2', NetworkTablesTypeInfos.kString, 'default');

      let publishCallCount = 0;
      const originalMessengerPublish = client.messenger.publish.bind(client.messenger);

      client.messenger.publish = vi.fn().mockImplementation(async (params) => {
        publishCallCount++;
        return originalMessengerPublish(params);
      });

      // Send announcements for both topics
      setTimeout(() => {
        const announceMessages: AnnounceMessage[] = [
          {
            method: 'announce',
            params: {
              name: 'test',
              id: 1,
              pubuid: 4000,
              type: 'string',
              properties: {},
            },
          },
          {
            method: 'announce',
            params: {
              name: 'test2',
              id: 2,
              pubuid: 4001,
              type: 'string',
              properties: {},
            },
          },
        ];
        server.send(JSON.stringify(announceMessages));
      }, 100);

      // Publish both topics concurrently
      await Promise.all([topic.publish({}, 4000), topic2.publish({}, 4001)]);

      // messenger.publish should be called twice (once per topic)
      expect(publishCallCount).toBe(2);
      expect(topic.publisher).toBe(true);
      expect(topic2.publisher).toBe(true);

      // Restore original method
      client.messenger.publish = originalMessengerPublish;
    });
  });

  describe('unpublish', () => {
    it('sets the publisher to false', async () => {
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 1001,
          type: 'string',
          properties: {},
        },
      };
      const publishPromise = topic.publish({}, 1001);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;
      expect(topic.publisher).toBe(true);
      topic.unpublish();
      expect(topic.publisher).toBe(false);
      expect(topic.pubuid).toBeUndefined();
    });

    it('should throw an error if the client is not the publisher', () => {
      expect(() => topic.unpublish()).toThrow('Cannot unpublish topic without being the publisher');
    });
  });

  describe('setProperties', () => {
    it('should set the properties', () => {
      topic['client']['messenger']['_socket']['sendTextFrame'] = vi.fn();
      topic.setProperties(true, true);
      expect(topic['client']['messenger']['_socket']['sendTextFrame']).toHaveBeenCalledWith({
        method: 'setproperties',
        params: {
          name: 'test',
          update: {
            persistent: true,
            retained: true,
          },
        },
      });
    });

    it('should clear timeout when properties response arrives quickly', async () => {
      // First, publish the topic so it exists
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 5000,
          type: 'string',
          properties: {},
        },
      };
      const publishPromise = topic.publish({}, 5000);
      server.send(JSON.stringify([announceMessage]));
      await publishPromise;

      // Test setProperties timeout cleanup
      const setPropertiesPromise = topic.setProperties(true, true);

      // Send properties response quickly (100ms) with ack: true
      const propertiesResponse: PropertiesMessage = {
        method: 'properties',
        params: {
          name: 'test',
          ack: true,
          update: { persistent: true, retained: true },
        },
      };
      server.send(JSON.stringify([propertiesResponse]));

      // Wait for setProperties to complete
      const result = await setPropertiesPromise;
      expect(result).toEqual(propertiesResponse);

      // Wait longer than the 3 second timeout to ensure it was cleared
      // If the timeout wasn't cleared, this would throw an error
      await new Promise((resolve) => setTimeout(resolve, 3200));
    });
  });
});
