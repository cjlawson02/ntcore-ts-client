import { vi } from 'vitest';
import WSMock from 'vitest-websocket-mock';

import { Messenger } from './messenger';

import type {
  AnnounceMessage,
  AnnounceMessageParams,
  PublishMessageParams,
  SubscribeMessageParams,
} from '../types/types';

describe('Messenger', () => {
  let messenger: Messenger;
  let server: WSMock;
  const serverUrl = 'ws://localhost:5810/nt/1234';
  const onTopicUpdate = vi.fn();
  const onAnnounce = vi.fn();
  const onUnannounce = vi.fn();
  const onTopicProperties = vi.fn();

  beforeEach(async () => {
    server = new WSMock(serverUrl);
    messenger = Messenger.getInstance(serverUrl, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);
    await server.connected;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Give any pending operations time to complete and clean up
    await new Promise((resolve) => setTimeout(resolve, 100));
    WSMock.clean();
  });

  describe('optimistic resolution', () => {
    it('should optimistically resolve when publishing with prefix subscription (bug scenario)', async () => {
      // Set up a prefix subscription to trigger bug scenario
      const subscribeParams: SubscribeMessageParams = {
        options: {
          prefix: true,
        },
        topics: ['/test/'],
        subuid: messenger.getNextSubUID(),
      };
      messenger.subscribe(subscribeParams);

      // Wait a bit for subscription to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      const publishParams: PublishMessageParams = {
        name: '/test/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      // Start the publish operation
      const publishPromise = messenger.publish(publishParams);

      // Wait for optimistic resolution (200ms)
      const result = await Promise.race([
        publishPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 250)),
      ]);

      // Should resolve optimistically within 200ms
      expect(result).not.toBe('timeout');
      const announcement = await publishPromise;
      expect(announcement).toBeDefined();
      expect(announcement.method).toBe('announce');
      expect(announcement.params.name).toBe('/test/topic');
      expect(announcement.params.pubuid).toBe(publishParams.pubuid);

      // Verify onAnnounce was called with the mock announcement
      expect(onAnnounce).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '/test/topic',
          pubuid: publishParams.pubuid,
        })
      );
    });

    it('should optimistically resolve when republishing retained topic after reconnection (bug scenario)', async () => {
      const publishParams: PublishMessageParams = {
        name: '/retained/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: { retained: true },
      };

      // First publish (normal)
      setTimeout(() => {
        const announceMessage: AnnounceMessage = {
          method: 'announce',
          params: {
            name: '/retained/topic',
            id: 1,
            pubuid: publishParams.pubuid,
            type: 'string',
            properties: { retained: true },
          },
        };
        server.send(JSON.stringify([announceMessage]));
      }, 50);

      await messenger.publish(publishParams);

      // Clear mocks
      vi.clearAllMocks();

      // Republish with force=true (simulating reconnection)
      const republishParams: PublishMessageParams = {
        name: '/retained/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: { retained: true },
      };

      const republishPromise = messenger.publish(republishParams, true);

      // Wait for optimistic resolution (200ms)
      const result = await Promise.race([
        republishPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 250)),
      ]);

      // Should resolve optimistically within 200ms
      expect(result).not.toBe('timeout');
      const announcement = await republishPromise;
      expect(announcement).toBeDefined();
      expect(announcement.method).toBe('announce');
      expect(announcement.params.name).toBe('/retained/topic');
      expect(announcement.params.pubuid).toBe(republishParams.pubuid);
    });

    it('should optimistically resolve when publishing without subscription (bug scenario)', async () => {
      const publishParams: PublishMessageParams = {
        name: '/no/subscription/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      // No subscriptions exist, so this should trigger bug scenario

      const publishPromise = messenger.publish(publishParams);

      // Wait for optimistic resolution (200ms)
      const result = await Promise.race([
        publishPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 250)),
      ]);

      // Should resolve optimistically within 200ms
      expect(result).not.toBe('timeout');
      const announcement = await publishPromise;
      expect(announcement).toBeDefined();
      expect(announcement.method).toBe('announce');
      expect(announcement.params.name).toBe('/no/subscription/topic');
      expect(announcement.params.pubuid).toBe(publishParams.pubuid);
    });

    it('should handle late announcement after optimistic resolution', async () => {
      // Set up a prefix subscription to trigger bug scenario
      const subscribeParams: SubscribeMessageParams = {
        options: {
          prefix: true,
        },
        topics: ['/test/'],
        subuid: messenger.getNextSubUID(),
      };
      messenger.subscribe(subscribeParams);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const publishParams: PublishMessageParams = {
        name: '/test/late',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      const publishPromise = messenger.publish(publishParams);

      // Wait for optimistic resolution
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Now send the actual announcement (late)
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: '/test/late',
          id: 1,
          pubuid: publishParams.pubuid,
          type: 'string',
          properties: {},
        },
      };
      server.send(JSON.stringify([announceMessage]));

      // Should have already resolved optimistically
      const announcement = await publishPromise;
      expect(announcement).toBeDefined();
      expect(announcement.params.name).toBe('/test/late');

      // onAnnounce should have been called twice: once for optimistic, once for real
      // But the second call should update state without rejecting
      expect(onAnnounce).toHaveBeenCalled();
    });

    it('should not optimistically resolve when not in bug scenario', async () => {
      // Set up an exact subscription (not prefix) to avoid bug scenario
      const subscribeParams: SubscribeMessageParams = {
        options: {},
        topics: ['/normal/topic'],
        subuid: messenger.getNextSubUID(),
      };
      messenger.subscribe(subscribeParams);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const publishParams: PublishMessageParams = {
        name: '/normal/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      const publishPromise = messenger.publish(publishParams);

      // Wait a bit - should not resolve optimistically
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should still be pending (not resolved)
      let resolved = false;
      publishPromise.then(() => {
        resolved = true;
      });

      // Give it a moment to check
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(resolved).toBe(false);

      // Now send the actual announcement
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: '/normal/topic',
          id: 1,
          pubuid: publishParams.pubuid,
          type: 'string',
          properties: {},
        },
      };
      server.send(JSON.stringify([announceMessage]));

      // Should now resolve with the real announcement
      const announcement = await publishPromise;
      expect(announcement).toBeDefined();
      expect(announcement.params.name).toBe('/normal/topic');
      expect(announcement.params.pubuid).toBe(publishParams.pubuid);
    });

    it('should reject if no announcement received within 3 seconds (non-bug scenario)', async () => {
      // Set up an exact subscription
      const subscribeParams: SubscribeMessageParams = {
        options: {},
        topics: ['/timeout/topic'],
        subuid: messenger.getNextSubUID(),
      };
      messenger.subscribe(subscribeParams);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const publishParams: PublishMessageParams = {
        name: '/timeout/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      const publishPromise = messenger.publish(publishParams);

      // Should reject after 3 seconds - use a timeout slightly longer than 3 seconds
      // to ensure we catch the rejection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout exceeded')), 3500)
      );

      await expect(Promise.race([publishPromise, timeoutPromise])).rejects.toThrow(
        'was not announced within 3 seconds (3000ms)'
      );
    });

    it('should handle multiple concurrent optimistic resolutions', async () => {
      // Set up prefix subscription
      const subscribeParams: SubscribeMessageParams = {
        options: {
          prefix: true,
        },
        topics: ['/concurrent/'],
        subuid: messenger.getNextSubUID(),
      };
      messenger.subscribe(subscribeParams);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Publish multiple topics concurrently
      const publishParams1: PublishMessageParams = {
        name: '/concurrent/topic1',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };
      const publishParams2: PublishMessageParams = {
        name: '/concurrent/topic2',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };
      const publishParams3: PublishMessageParams = {
        name: '/concurrent/topic3',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      const promises = [
        messenger.publish(publishParams1),
        messenger.publish(publishParams2),
        messenger.publish(publishParams3),
      ];

      // All should resolve optimistically
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].params.name).toBe('/concurrent/topic1');
      expect(results[1].params.name).toBe('/concurrent/topic2');
      expect(results[2].params.name).toBe('/concurrent/topic3');
    });
  });
});
