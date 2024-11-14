import WSMock from 'jest-websocket-mock';

import { NetworkTablesPrefixTopic } from './prefix-topic';
import { PubSubClient } from './pubsub';

import type { CallbackFn } from './base-topic';
import type { AnnounceMessageParams, NetworkTablesTypes, SubscribeMessageParams } from '../types/types';

describe('Prefix Topic', () => {
  let topic: NetworkTablesPrefixTopic;
  let server: WSMock;
  let client: PubSubClient;
  const serverUrl = 'ws://localhost:5810/nt/1234';

  beforeAll(async () => {
    server = new WSMock(serverUrl);
    client = PubSubClient.getInstance(serverUrl);

    await server.connected;
  });

  beforeEach(() => {
    topic = new NetworkTablesPrefixTopic(client, 'test');
  });

  afterEach(() => {
    topic['client']['prefixTopics'].clear();
    topic.subscribers.clear();
  });

  describe('constructor', () => {
    it('returns the existing topic if it already exists', () => {
      const newTopic = new NetworkTablesPrefixTopic(topic['client'], 'test');
      expect(newTopic).toBe(topic);
    });
  });

  describe('updateValue', () => {
    it('updates the value correctly', () => {
      const params: AnnounceMessageParams = { id: 1, name: 'test', type: 'string', properties: {} };
      topic.announce(params);
      topic.updateValue(params, 'new value', Date.now());
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
    let callback: jest.Mock;
    beforeEach(() => {
      callback = jest.fn();
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
      const send = jest.fn();
      topic['client']['_messenger']['_socket']['sendTextFrame'] = send;
      topic.subscribe(callback);
      expect(send).toHaveBeenCalledWith({
        method: 'subscribe',
        params: {
          topics: ['test'],
          subuid: expect.any(Number),
          options: {
            prefix: true,
          },
        } as SubscribeMessageParams,
      });
    });
  });

  describe('unsubscribe', () => {
    it('removes the subscriber from the topic', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const callback: CallbackFn<NetworkTablesTypes> = (_: NetworkTablesTypes | null) => jest.fn();
      topic.subscribe(callback);
      expect(topic.subscribers.size).toBe(1);
      topic.unsubscribe(topic.subscribers.keys().next().value!, true);
      expect(topic.subscribers.size).toBe(0);
    });
    it('does nothing if the callback is not a subscriber', () => {
      expect(topic.subscribers.size).toBe(0);
      topic.unsubscribe(topic.subscribers.keys().next().value!);
      expect(topic.subscribers.size).toBe(0);
    });
  });

  describe('unsubscribeAll', () => {
    it('removes all subscribers from the topic', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const callback: CallbackFn<NetworkTablesTypes> = (_: NetworkTablesTypes | null) => jest.fn();
      topic.subscribe(callback);
      topic.subscribe(callback);
      expect(topic.subscribers.size).toBe(2);
      topic.unsubscribeAll();
      expect(topic.subscribers.size).toBe(0);
    });
  });

  describe('resubscribeAll', () => {
    it('resubscribes all subscribers to the topic', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const callback: CallbackFn<NetworkTablesTypes> = (_: NetworkTablesTypes | null) => jest.fn();
      topic.subscribe(callback);
      topic.subscribe(callback);
      expect(topic.subscribers.size).toBe(2);
      topic.resubscribeAll(topic['client']);
      expect(topic.subscribers.size).toBe(2);
    });
  });

  describe('notifySubscribers', () => {
    it('calls the callback with the value', () => {
      const callback = jest.fn();
      topic.subscribe(callback);
      const params = { type: 'string', name: 'test', id: 1, properties: {} };
      topic['notifySubscribers']({ type: 'string', name: 'test', id: 1, properties: {} }, 'foo');
      expect(callback).toHaveBeenCalledWith('foo', params);
    });
  });

  describe('setProperties', () => {
    it('should set the properties', () => {
      topic['client']['messenger']['_socket']['sendTextFrame'] = jest.fn();
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
  });
});
