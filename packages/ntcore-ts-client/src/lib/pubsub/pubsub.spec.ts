import { NetworkTablesTypeInfos } from '../types/types';

import { PubSubClient } from './pubsub';

describe('PubSubClient', () => {
  let client: PubSubClient;

  beforeEach(() => {
    client = PubSubClient.getInstance('ws://localhost:5810');
  });

  afterEach(() => {
    client['topics'].clear();
    client['prefixTopics'].clear();
    client['knownTopicParams'].clear();
  });

  it('returns the same instance when calling getInstance multiple times', () => {
    const instance1 = PubSubClient.getInstance('ws://localhost:5810');
    const instance2 = PubSubClient.getInstance('ws://localhost:5810');
    expect(instance1).toBe(instance2);
  });

  it('registers a topic', () => {
    const topic = { name: 'test', isRegular: () => true };
    client.registerTopic(topic as never);
    expect(client.getTopicFromName('test')).toBe(topic);
  });

  it('throws an error when trying to register a topic with the same name', () => {
    const topic1 = { name: 'test', isRegular: () => true };
    const topic2 = { name: 'test', isRegular: () => true };
    client.registerTopic(topic1 as never);
    expect(() => {
      client.registerTopic(topic2 as never);
    }).toThrow('Topic test already exists. Cannot register a topic with the same name.');
  });

  it('handles updates to a topic', () => {
    const topic = {
      name: 'test',
      id: 123,
      typeInfo: NetworkTablesTypeInfos.kString,
      updateValue: jest.fn(),
      isRegular: () => true,
    };
    client.registerTopic(topic as never);
    client['onTopicUpdate']({
      topicId: 123,
      value: 'test value',
      typeNum: NetworkTablesTypeInfos.kString[0],
      serverTime: Date.now(),
    });
    expect(topic.updateValue).toHaveBeenCalledWith('test value', expect.any(Number));
  });

  it('handles bad updates to a topic', () => {
    const topic = {
      name: 'test',
      id: 123,
      typeInfo: NetworkTablesTypeInfos.kBoolean,
      updateValue: jest.fn(),
      isRegular: () => true,
    };
    client.registerTopic(topic as never);
    expect(() =>
      client['onTopicUpdate']({
        topicId: 123,
        value: 'test value',
        typeNum: NetworkTablesTypeInfos.kString[0],
        serverTime: Date.now(),
      })
    ).toThrow(/Invalid data for topic test/);
    expect(topic.updateValue).not.toHaveBeenCalled();
  });

  it('handles updates to a prefix topic', () => {
    const topic = {
      name: '/testprefix/',
      id: 123,
      updateValue: vi.fn(),
      isRegular: () => false,
      isPrefix: () => true,
    };
    const params = { id: 1234, name: '/testprefix/test' };
    client['knownTopicParams'].set(1234, params as never);
    client.registerTopic(topic as never);
    client['onTopicUpdate']({
      topicId: 1234,
      value: 'test value',
      serverTime: Date.now(),
    } as never);
    expect(topic.updateValue).toHaveBeenCalledWith(params, 'test value', expect.any(Number));
  });

  it('handles announcements for a topic', () => {
    const topic = { name: 'test', announce: vi.fn(), isRegular: () => true, isPrefix: () => false };
    client.registerTopic(topic as never);
    client['onTopicAnnounce']({ id: 123, name: 'test' } as never);
    expect(client.getKnownTopicParams(123)).toEqual({ id: 123, name: 'test' });
    expect(topic.announce).toHaveBeenCalledWith({ id: 123, name: 'test' });
  });

  it('handles announcements for a prefix topic', () => {
    const topic = { name: '/testprefix/', announce: vi.fn(), isRegular: () => false, isPrefix: () => true };
    client.registerTopic(topic as never);
    client['onTopicAnnounce']({ id: 1234, name: '/testprefix/test' } as never);
    expect(client.getKnownTopicParams(1234)).toEqual({ id: 1234, name: '/testprefix/test' });
    expect(topic.announce).toHaveBeenCalledWith({ id: 1234, name: '/testprefix/test' });
  });

  it('handles unannouncements for a topic', () => {
    const topic = {
      name: 'test',
      announce: vi.fn(),
      unannounce: vi.fn(),
      isRegular: () => true,
      isPrefix: () => false,
    };
    client.registerTopic(topic as never);
    client['onTopicAnnounce']({ id: 123, name: 'test' } as never);
    client['onTopicUnannounce']({ name: 'test' } as never);
    expect(topic.unannounce).toHaveBeenCalled();
  });

  it('reinstantates topics', () => {
    const topic = {
      name: 'test',
      publisher: true,
      isRegular: () => true,
      isPrefix: () => false,
      announce: vi.fn(),
      resubscribeAll: vi.fn(),
      republish: vi.fn(),
    };
    const topic2 = {
      name: 'test2',
      publisher: true,
      isRegular: () => true,
      isPrefix: () => false,
      announce: vi.fn(),
      resubscribeAll: vi.fn(),
      republish: vi.fn(),
    };
    client.registerTopic(topic as never);
    client.registerTopic(topic2 as never);
    client.reinstantiate('ws://localhost:5810');
    expect(topic.resubscribeAll).toHaveBeenCalled();
    expect(topic2.resubscribeAll).toHaveBeenCalled();
    expect(topic.republish).toHaveBeenCalled();
    expect(topic2.republish).toHaveBeenCalled();
  });
});
