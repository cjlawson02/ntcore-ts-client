import { PubSubClient } from './pubsub';

describe('PubSubClient', () => {
  let client: PubSubClient;

  beforeEach(() => {
    client = PubSubClient.getInstance('ws://localhost:5810');
  });

  afterEach(() => {
    client['topics'].clear();
  });

  it('returns the same instance when calling getInstance multiple times', () => {
    const instance1 = PubSubClient.getInstance('ws://localhost:5810');
    const instance2 = PubSubClient.getInstance('ws://localhost:5810');
    expect(instance1).toBe(instance2);
  });

  it('registers a topic', () => {
    const topic = { name: 'test' };
    client.registerTopic(topic as never);
    expect(client.getTopicFromName('test')).toBe(topic);
  });

  it('throws an error when trying to register a topic with the same name', () => {
    const topic1 = { name: 'test' };
    const topic2 = { name: 'test' };
    client.registerTopic(topic1 as never);
    expect(() => {
      client.registerTopic(topic2 as never);
    }).toThrowError('Topic test already exists. Cannot register a topic with the same name.');
  });

  it('handles updates to a topic', () => {
    const topic = { name: 'test', id: 123, updateValue: jest.fn() };
    client.registerTopic(topic as never);
    client['onTopicUpdate']({
      topicId: 123,
      value: 'test value',
      serverTime: Date.now(),
    } as never);
    expect(topic.updateValue).toHaveBeenCalledWith('test value', expect.any(Number));
  });

  it('handles announcements for a topic', () => {
    const topic = { name: 'test', announce: jest.fn() };
    client.registerTopic(topic as never);
    client['onTopicAnnounce']({ id: 123, name: 'test' } as never);
    expect(topic.announce).toHaveBeenCalledWith(123, undefined);
  });

  it('handles unannouncements for a topic', () => {
    const topic = { name: 'test', announce: jest.fn(), unannounce: jest.fn() };
    client.registerTopic(topic as never);
    client['onTopicAnnounce']({ id: 123, name: 'test' } as never);
    client['onTopicUnannounce']({ name: 'test' } as never);
    expect(topic.unannounce).toHaveBeenCalled();
  });

  it('reinstantates topics', () => {
    const topic = {
      name: 'test',
      publisher: true,
      announce: jest.fn(),
      resubscribeAll: jest.fn(),
      republish: jest.fn(),
    };
    const topic2 = {
      name: 'test2',
      publisher: true,
      announce: jest.fn(),
      resubscribeAll: jest.fn(),
      republish: jest.fn(),
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
