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
    client['inFlightOperations'].clear();
    client['_isCleaningUp'] = false;
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
      updateValue: vi.fn(),
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
      updateValue: vi.fn(),
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
      unannounce: vi.fn(),
      resubscribeAll: vi.fn(),
      republish: vi.fn(),
    };
    const topic2 = {
      name: 'test2',
      publisher: true,
      isRegular: () => true,
      isPrefix: () => false,
      announce: vi.fn(),
      unannounce: vi.fn(),
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

  describe('getOrCreateInFlightOperation', () => {
    it('returns the same promise for concurrent calls with the same key', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `result-${callCount}`;
      };

      const promise1 = client.getOrCreateInFlightOperation('test-key', operation);
      const promise2 = client.getOrCreateInFlightOperation('test-key', operation);
      const promise3 = client.getOrCreateInFlightOperation('test-key', operation);

      // All promises should be the same instance
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);

      const results = await Promise.all([promise1, promise2, promise3]);

      // All should resolve to the same value
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
      expect(results[0]).toBe('result-1');

      // Operation should only be called once
      expect(callCount).toBe(1);
    });

    it('creates separate promises for different keys', async () => {
      let callCount = 0;
      const operation1 = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `result-1-${callCount}`;
      };
      const operation2 = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `result-2-${callCount}`;
      };

      const promise1 = client.getOrCreateInFlightOperation('key-1', operation1);
      const promise2 = client.getOrCreateInFlightOperation('key-2', operation2);

      // Promises should be different instances
      expect(promise1).not.toBe(promise2);

      const results = await Promise.all([promise1, promise2]);

      // Results should be different (different operations with different return values)
      expect(results[0]).not.toBe(results[1]);
      expect(results[0]).toContain('result-1');
      expect(results[1]).toContain('result-2');

      // Operation should be called twice (once per key)
      expect(callCount).toBe(2);
    });

    it('cleans up the operation from the map after completion', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      const promise = client.getOrCreateInFlightOperation('cleanup-test', operation);
      expect(client['inFlightOperations'].has('cleanup-test')).toBe(true);

      await promise;

      // After completion, the operation should be removed from the map
      expect(client['inFlightOperations'].has('cleanup-test')).toBe(false);
    });

    it('cleans up the operation from the map after failure', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error('Operation failed');
      };

      const promise = client.getOrCreateInFlightOperation('cleanup-test-fail', operation);
      expect(client['inFlightOperations'].has('cleanup-test-fail')).toBe(true);

      await expect(promise).rejects.toThrow('Operation failed');

      // After failure, the operation should still be removed from the map
      expect(client['inFlightOperations'].has('cleanup-test-fail')).toBe(false);
    });

    it('allows retry after failure', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (attemptCount === 1) {
          throw new Error('First attempt failed');
        }
        return 'success';
      };

      // First attempt should fail
      const promise1 = client.getOrCreateInFlightOperation('retry-test', operation);
      await expect(promise1).rejects.toThrow('First attempt failed');

      // After failure, map should be cleaned up
      expect(client['inFlightOperations'].has('retry-test')).toBe(false);

      // Second attempt should succeed
      const promise2 = client.getOrCreateInFlightOperation('retry-test', operation);
      const result = await promise2;
      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });

    it('prevents new operations from starting during cleanup', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'result';
      };

      // Start cleanup
      client.cleanup();

      // New operations should be rejected
      await expect(client.getOrCreateInFlightOperation('new-operation', operation)).rejects.toThrow(
        'Cannot start new operation: client is cleaning up'
      );
    });

    it('allows existing operations to complete during cleanup', async () => {
      let operationCompleted = false;
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        operationCompleted = true;
        return 'result';
      };

      // Start an operation before cleanup
      const promise = client.getOrCreateInFlightOperation('existing-operation', operation);

      // Start cleanup (this should not prevent the existing operation from completing)
      client.cleanup();

      // The existing operation should still complete
      const result = await promise;
      expect(result).toBe('result');
      expect(operationCompleted).toBe(true);
    });
  });
});
