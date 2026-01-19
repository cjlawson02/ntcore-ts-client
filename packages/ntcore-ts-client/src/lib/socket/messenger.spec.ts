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

  describe('parseAndFilterMessage', () => {
    it('should return an empty array for non-string websocket payloads', () => {
      const result = (
        messenger as unknown as {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parseAndFilterMessage: (event: any, method: string) => unknown[];
        }
      )['parseAndFilterMessage']({ data: new ArrayBuffer(0) }, 'announce');

      expect(result).toEqual([]);
    });

    it('should throw when JSON parses to a non-array message payload', () => {
      const singleMessage = {
        method: 'announce',
        params: {
          name: 'test',
          id: 1,
          pubuid: 0,
          type: 'string',
          properties: {},
        },
      };

      expect(() => {
        (
          messenger as unknown as {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parseAndFilterMessage: (event: any, method: string) => unknown[];
          }
        )['parseAndFilterMessage']({ data: JSON.stringify(singleMessage) }, 'announce');
      }).toThrow();
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

    it('should resolve even if announce arrives immediately (before timeout scheduling)', async () => {
      const params: PublishMessageParams = {
        name: '/immediate/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      // Ensure this is NOT a bug scenario; otherwise publish() may resolve optimistically.
      messenger.subscribe({
        topics: [params.name],
        subuid: messenger.getNextSubUID(),
        options: {},
      });

      const publishPromise = messenger.publish(params);

      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: params.name,
          pubuid: params.pubuid,
          type: params.type,
          id: 1,
          properties: {},
        },
      };

      // Send immediately after publish() call.
      server.send(JSON.stringify([announceMessage]));

      await expect(publishPromise).resolves.toEqual(announceMessage);
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

    it('should reject if no announcement is received within timeout (non-bug scenario)', async () => {
      const params: PublishMessageParams = {
        name: '/timeout/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      // Ensure this is NOT a "bug scenario" by creating an exact subscription match.
      // If there is no matching subscription, publish() may optimistically resolve after 200ms.
      messenger.subscribe({
        topics: [params.name],
        subuid: messenger.getNextSubUID(),
        options: {},
      });

      vi.useFakeTimers();
      try {
        const publishPromise = messenger.publish(params);
        // Allow microtasks to run so the internal timeouts are scheduled.
        await Promise.resolve();
        vi.advanceTimersByTime(3000);
        await expect(publishPromise).rejects.toThrow('was not announced within 3 seconds (3000ms)');
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

    it('should reject when waitForConnection rejects (connection failure)', async () => {
      const params: PublishMessageParams = {
        name: '/waitForConnection/reject',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      vi.spyOn(messenger.socket, 'waitForConnection').mockRejectedValueOnce(new Error('connection failed'));

      await expect(messenger.publish(params)).rejects.toThrow('connection failed');

      // Should not be added to publications on failure.
      expect(Array.from(messenger.getPublications())).toHaveLength(0);
    });

    it('should ignore announce messages that do not match name + pubuid', async () => {
      const params: PublishMessageParams = {
        name: '/match/topic',
        pubuid: messenger.getNextPubUID(),
        type: 'string',
        properties: {},
      };

      // Ensure this is NOT a bug scenario so the publish does not resolve optimistically.
      messenger.subscribe({
        topics: [params.name],
        subuid: messenger.getNextSubUID(),
        options: {},
      });

      const publishPromise = messenger.publish(params);

      let resolved = false;
      void publishPromise.then(() => {
        resolved = true;
      });

      // Wrong pubuid (same name)
      server.send(
        JSON.stringify([
          {
            method: 'announce',
            params: {
              name: params.name,
              id: 1,
              pubuid: 9999,
              type: 'string',
              properties: {},
            },
          },
        ])
      );
      await Promise.resolve();
      expect(resolved).toBe(false);

      // Wrong name (same pubuid)
      server.send(
        JSON.stringify([
          {
            method: 'announce',
            params: {
              name: '/other/topic',
              id: 1,
              pubuid: params.pubuid,
              type: 'string',
              properties: {},
            },
          },
        ])
      );
      await Promise.resolve();
      expect(resolved).toBe(false);

      // Correct match
      const announceMessage: AnnounceMessage = {
        method: 'announce',
        params: {
          name: params.name,
          id: 1,
          pubuid: params.pubuid,
          type: 'string',
          properties: {},
        },
      };
      server.send(JSON.stringify([announceMessage]));

      const result = await publishPromise;
      expect(result).toEqual(announceMessage);
    });

    describe('optimistic resolution (wpilibsuite/allwpilib#7680 workaround)', () => {
      it('should optimistically resolve when publishing with prefix subscription (bug scenario)', async () => {
        const subscribeParams: SubscribeMessageParams = {
          options: { prefix: true },
          topics: ['/test/'],
          subuid: messenger.getNextSubUID(),
        };
        messenger.subscribe(subscribeParams);

        const publishParams: PublishMessageParams = {
          name: '/test/topic',
          pubuid: messenger.getNextPubUID(),
          type: 'string',
          properties: {},
        };

        vi.useFakeTimers();
        try {
          const publishPromise = messenger.publish(publishParams);
          await Promise.resolve();
          vi.advanceTimersByTime(250);

          const announcement = await publishPromise;
          expect(announcement).toBeDefined();
          expect(announcement.method).toBe('announce');
          expect(announcement.params.name).toBe('/test/topic');
          expect(announcement.params.pubuid).toBe(publishParams.pubuid);

          // Optimistic resolution explicitly calls the onAnnounce callback.
          expect(onAnnounce).toHaveBeenCalledWith(
            expect.objectContaining({
              name: '/test/topic',
              pubuid: publishParams.pubuid,
            })
          );
        } finally {
          vi.useRealTimers();
        }
      });

      it('should optimistically resolve when republishing retained topic after reconnection (bug scenario)', async () => {
        vi.useFakeTimers();
        try {
          const publishParams: PublishMessageParams = {
            name: '/retained/topic',
            pubuid: messenger.getNextPubUID(),
            type: 'string',
            properties: { retained: true },
          };

          // First publish (normal) with real announcement.
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

          const firstPublish = messenger.publish(publishParams);
          vi.advanceTimersByTime(50);
          await firstPublish;

          // Clear mocks
          vi.clearAllMocks();

          // Republish with force=true (simulating reconnection). In this scenario, publish()
          // should resolve optimistically after ~200ms even without an announcement.
          const republishParams: PublishMessageParams = {
            name: '/retained/topic',
            pubuid: messenger.getNextPubUID(),
            type: 'string',
            properties: { retained: true },
          };

          const republishPromise = messenger.publish(republishParams, true);
          await Promise.resolve();
          vi.advanceTimersByTime(250);

          const announcement = await republishPromise;
          expect(announcement).toBeDefined();
          expect(announcement.method).toBe('announce');
          expect(announcement.params.name).toBe('/retained/topic');
          expect(announcement.params.pubuid).toBe(republishParams.pubuid);
        } finally {
          vi.useRealTimers();
        }
      });

      it('should optimistically resolve when publishing without subscription (bug scenario)', async () => {
        const publishParams: PublishMessageParams = {
          name: '/no/subscription/topic',
          pubuid: messenger.getNextPubUID(),
          type: 'string',
          properties: {},
        };

        vi.useFakeTimers();
        try {
          const publishPromise = messenger.publish(publishParams);
          await Promise.resolve();
          vi.advanceTimersByTime(250);

          const announcement = await publishPromise;
          expect(announcement).toBeDefined();
          expect(announcement.method).toBe('announce');
          expect(announcement.params.name).toBe('/no/subscription/topic');
          expect(announcement.params.pubuid).toBe(publishParams.pubuid);
        } finally {
          vi.useRealTimers();
        }
      });

      it('should handle late announcement after optimistic resolution', async () => {
        const subscribeParams: SubscribeMessageParams = {
          options: { prefix: true },
          topics: ['/test/'],
          subuid: messenger.getNextSubUID(),
        };
        messenger.subscribe(subscribeParams);

        const publishParams: PublishMessageParams = {
          name: '/test/late',
          pubuid: messenger.getNextPubUID(),
          type: 'string',
          properties: {},
        };

        vi.useFakeTimers();
        try {
          const publishPromise = messenger.publish(publishParams);

          // Allow optimistic resolution to happen.
          await Promise.resolve();
          vi.advanceTimersByTime(250);

          // Now send the actual announcement (late). This should not cause rejection.
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

          const announcement = await publishPromise;
          expect(announcement).toBeDefined();
          expect(announcement.params.name).toBe('/test/late');

          // At minimum, optimistic path should have invoked onAnnounce.
          expect(onAnnounce).toHaveBeenCalled();
        } finally {
          vi.useRealTimers();
        }
      });

      it('should not optimistically resolve when not in bug scenario', async () => {
        const publishParams: PublishMessageParams = {
          name: '/normal/topic',
          pubuid: messenger.getNextPubUID(),
          type: 'string',
          properties: {},
        };

        // Add a prefix subscription that does NOT match this topic name.
        // This exercises the non-match branch in bug-scenario detection.
        messenger.subscribe({
          options: { prefix: true },
          topics: ['/other/'],
          subuid: messenger.getNextSubUID(),
        });

        // Add an exact subscription that does NOT match (exercise includes() false path).
        messenger.subscribe({
          options: {},
          topics: ['/not/matching'],
          subuid: messenger.getNextSubUID(),
        });

        // Exact subscription match makes this a non-bug scenario.
        messenger.subscribe({
          options: {},
          topics: [publishParams.name],
          subuid: messenger.getNextSubUID(),
        });

        vi.useFakeTimers();
        try {
          const publishPromise = messenger.publish(publishParams);

          let resolved = false;
          void publishPromise.then(() => {
            resolved = true;
          });

          // Give the optimistic timer window time to pass.
          await Promise.resolve();
          vi.advanceTimersByTime(250);
          await Promise.resolve();

          expect(resolved).toBe(false);

          // Now send the actual announcement.
          const announceMessage: AnnounceMessage = {
            method: 'announce',
            params: {
              name: publishParams.name,
              id: 1,
              pubuid: publishParams.pubuid,
              type: publishParams.type,
              properties: publishParams.properties,
            },
          };
          server.send(JSON.stringify([announceMessage]));

          const announcement = await publishPromise;
          expect(announcement).toBeDefined();
          expect(announcement.params.name).toBe(publishParams.name);
          expect(announcement.params.pubuid).toBe(publishParams.pubuid);
        } finally {
          vi.useRealTimers();
        }
      });

      it('should clear the optimistic timer when an announce arrives quickly (bug scenario)', async () => {
        const subscribeParams: SubscribeMessageParams = {
          options: { prefix: true },
          topics: ['/fast/'],
          subuid: messenger.getNextSubUID(),
        };
        messenger.subscribe(subscribeParams);

        const publishParams: PublishMessageParams = {
          name: '/fast/topic',
          pubuid: messenger.getNextPubUID(),
          type: 'string',
          properties: {},
        };

        vi.useFakeTimers();
        try {
          const publishPromise = messenger.publish(publishParams);

          // Allow waitForConnection().then(...) to schedule the early 200ms timer.
          await Promise.resolve();

          const announceMessage: AnnounceMessage = {
            method: 'announce',
            params: {
              name: publishParams.name,
              id: 1,
              pubuid: publishParams.pubuid,
              type: publishParams.type,
              properties: publishParams.properties,
            },
          };
          server.send(JSON.stringify([announceMessage]));

          const result = await publishPromise;
          expect(result).toEqual(announceMessage);

          // Advance past the optimistic window; should not change result or throw.
          vi.advanceTimersByTime(250);
        } finally {
          vi.useRealTimers();
        }
      });

      it('should default missing properties to {} in optimistic announce', async () => {
        vi.useFakeTimers();
        try {
          // Force the optimistic path and omit properties to exercise `params.properties || {}`.
          const publishParams = {
            name: '/no-props/topic',
            pubuid: messenger.getNextPubUID(),
            type: 'string',
            // properties intentionally omitted
          } as unknown as PublishMessageParams;

          const publishPromise = messenger.publish(publishParams);
          await Promise.resolve();
          vi.advanceTimersByTime(250);

          const announcement = await publishPromise;
          expect(announcement.method).toBe('announce');
          expect(announcement.params.name).toBe('/no-props/topic');
          expect(announcement.params.properties).toEqual({});
        } finally {
          vi.useRealTimers();
        }
      });

      it('should handle multiple concurrent optimistic resolutions', async () => {
        const subscribeParams: SubscribeMessageParams = {
          options: { prefix: true },
          topics: ['/concurrent/'],
          subuid: messenger.getNextSubUID(),
        };
        messenger.subscribe(subscribeParams);

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

        vi.useFakeTimers();
        try {
          const promises = [
            messenger.publish(publishParams1),
            messenger.publish(publishParams2),
            messenger.publish(publishParams3),
          ];

          await Promise.resolve();
          vi.advanceTimersByTime(250);

          const results = await Promise.all(promises);
          expect(results).toHaveLength(3);
          expect(results[0].params.name).toBe('/concurrent/topic1');
          expect(results[1].params.name).toBe('/concurrent/topic2');
          expect(results[2].params.name).toBe('/concurrent/topic3');
        } finally {
          vi.useRealTimers();
        }
      });
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

    it('should reject when waitForConnection rejects (connection failure)', async () => {
      const params: SetPropertiesMessageParams = {
        name: '/waitForConnection/reject',
        update: { persistent: true },
      };

      vi.spyOn(messenger.socket, 'waitForConnection').mockRejectedValueOnce(new Error('connection failed'));

      await expect(messenger.setProperties(params)).rejects.toThrow('connection failed');
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
        pubuid: 0,
        id: 123,
        announced: true,
      } as NetworkTablesTopic<string>;

      const sendValueToTopicSpy = vi.spyOn(messenger.socket, 'sendValueToTopic');

      messenger.sendToTopic(topic, 'test-value');

      expect(sendValueToTopicSpy).toHaveBeenCalledWith(123, 'test-value', NetworkTablesTypeInfos.kString);
    });

    it('should return -1 if topic has no server id yet', () => {
      const topic = {
        name: 'test',
        typeInfo: NetworkTablesTypeInfos.kString,
        publisher: true,
        pubuid: 0,
        id: undefined,
        announced: false,
      } as unknown as NetworkTablesTopic<string>;

      const sendValueToTopicSpy = vi.spyOn(messenger.socket, 'sendValueToTopic');
      const result = messenger.sendToTopic(topic, 'test-value');

      expect(result).toBe(-1);
      expect(sendValueToTopicSpy).not.toHaveBeenCalled();
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
