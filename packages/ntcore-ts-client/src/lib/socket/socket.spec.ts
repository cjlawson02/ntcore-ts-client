import { encode } from '@msgpack/msgpack';
import WebSocket from 'isomorphic-ws';
import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';
import { LogLevel, setLogLevel } from '../util/logger';
import { Util } from '../util/util';

import { NetworkTablesSocket } from './socket';

import type {
  AnnounceMessage,
  AnnounceMessageParams,
  BinaryMessage,
  PropertiesMessage,
  PropertiesMessageParams,
  UnannounceMessage,
  UnannounceMessageParams,
  UnsubscribeMessage,
} from '../types/types';

describe('NetworkTablesSocket', () => {
  let socket: NetworkTablesSocket;
  const serverUrl = 'ws://localhost:5810/nt/1234';
  let server: WSMock;
  const onSocketOpen = vi.fn();
  const onSocketClose = vi.fn();
  const onTopicUpdate = vi.fn();
  const onAnnounce = vi.fn();
  const onUnannounce = vi.fn();
  const onProperties = vi.fn();

  beforeEach(async () => {
    // Clean up any existing instances first (this is a singleton keyed by URL).
    NetworkTablesSocket['instances'].forEach((instance: NetworkTablesSocket) => {
      instance.stopAutoConnect();
      try {
        instance.close();
      } catch {
        // Some tests override `websocket` with a plain object; best-effort cleanup.
      }
    });
    NetworkTablesSocket['instances'].clear();

    server = new WSMock(serverUrl);

    // Create an instance of the NetworkTablesSocket class
    socket = NetworkTablesSocket.getInstance(
      serverUrl,
      onSocketOpen,
      onSocketClose,
      onTopicUpdate,
      onAnnounce,
      onUnannounce,
      onProperties
    );

    await server.connected;
  });

  afterEach(async () => {
    socket.stopAutoConnect();
    try {
      socket.close();
    } catch {
      // Some tests override `websocket` with a plain object; best-effort cleanup.
    }
    WSMock.clean();
    onSocketOpen.mockClear();
    onSocketClose.mockClear();
    onTopicUpdate.mockClear();
    onAnnounce.mockClear();
    onUnannounce.mockClear();
    onProperties.mockClear();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new WebSocket instance with the provided server URL', () => {
      expect(socket.websocket).toBeInstanceOf(WebSocket);
      expect(socket.websocket.url).toBe(serverUrl);
    });
  });

  describe('isConnected', () => {
    it('should return true if the WebSocket is open', () => {
      expect(socket.isConnected()).toBe(true);
    });

    it('should return false if the WebSocket is closed', () => {
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CLOSED,
      } as WebSocket;

      expect(socket.isConnected()).toBe(false);
    });
  });

  describe('sendTextFrame', () => {
    it('should queue messages when not connected', () => {
      const send = vi.fn();
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CONNECTING,
        send,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const msg: UnsubscribeMessage = { method: 'unsubscribe', params: { subuid: 1 } };
      socket.sendTextFrame(msg);

      expect(send).not.toHaveBeenCalled();
      const queued = socket['messageQueue'][socket['messageQueue'].length - 1];
      expect(typeof queued).toBe('string');
      expect(queued).toBe(JSON.stringify([msg]));
    });
  });

  describe('waitForConnection', () => {
    it('should resolve via listener once the socket becomes connected', async () => {
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CONNECTING,
      } as WebSocket;

      const p = socket.waitForConnection();

      // Not connected yet, so it should have registered a listener.
      expect(socket['connectionListeners'].size).toBeGreaterThan(0);

      // Flip to OPEN and notify listeners.
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.OPEN,
      } as WebSocket;
      socket['updateConnectionListeners']();

      await expect(p).resolves.toBeUndefined();
      // The listener created by waitForConnection should have removed itself.
      expect(socket['connectionListeners'].size).toBe(0);
    });
  });

  describe('addConnectionListener', () => {
    it('should immediately notify when immediateNotify is true and remove via disposer', () => {
      const listener = vi.fn();
      const dispose = socket.addConnectionListener(listener, true);

      expect(listener).toHaveBeenCalledWith(true);

      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CLOSED,
      } as WebSocket;
      socket['updateConnectionListeners']();
      expect(listener).toHaveBeenLastCalledWith(false);

      dispose();
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.OPEN,
      } as WebSocket;
      socket['updateConnectionListeners']();

      // No new calls after dispose.
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendQueuedMessages', () => {
    it('should send all queued messages through the WebSocket', async () => {
      // Queue some messages
      const messages = ['Hello, world!', 'Foo', 'Bar'];
      socket['messageQueue'].push(...messages);

      // Send the queued messages
      socket['sendQueuedMessages']();

      await expect(server).toReceiveMessage('Hello, world!');
      await expect(server).toReceiveMessage('Foo');
      await expect(server).toReceiveMessage('Bar');
      expect(socket['messageQueue']).toHaveLength(0);
    });

    it('should not send any messages if the WebSocket is not open', async () => {
      // Mock the WebSocket's `send` method
      const send = vi.fn();
      socket['_websocket'] = {
        ...socket['_websocket'],
        send,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      // Queue some messages
      const messages = ['Hello, world!', 'Foo', 'Bar'];
      socket['messageQueue'].push(...messages);

      // Set the WebSocket's `readyState` property to be `WebSocket.CONNECTING`
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CONNECTING,
      } as WebSocket;

      // Send the queued messages
      socket['sendQueuedMessages']();

      expect(send).not.toHaveBeenCalled();
      expect(socket['messageQueue']).toHaveLength(messages.length);
    });
  });

  describe('sendValueToTopic', () => {
    it('should return -1 and not send when not connected', () => {
      const send = vi.fn();
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CONNECTING,
        send,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = socket.sendValueToTopic(123, 456, NetworkTablesTypeInfos.kInteger);
      expect(result).toBe(-1);
      expect(send).not.toHaveBeenCalled();
      expect(socket['messageQueue']).toHaveLength(0);
    });

    it('should send and return a timestamp when connected', () => {
      const send = vi.fn();
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.OPEN,
        send,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const getMicrosSpy = vi.spyOn(Util, 'getMicros').mockReturnValueOnce(1000);

      const result = socket.sendValueToTopic(123, 456, NetworkTablesTypeInfos.kInteger);
      expect(result).not.toBe(-1);
      expect(send).toHaveBeenCalled();
      getMicrosSpy.mockRestore();
    });
  });

  describe('connection open ordering', () => {
    it('should run onSocketOpen before notifying connection listeners', async () => {
      const order: string[] = [];
      const orderingServerUrl = 'ws://localhost:5810/nt/ordering-test';
      const orderingServer = new WSMock(orderingServerUrl);

      const orderingSocket = NetworkTablesSocket.getInstance(
        orderingServerUrl,
        () => order.push('onSocketOpen'),
        () => {},
        () => {},
        () => {},
        () => {},
        () => {},
        false
      );

      await orderingServer.connected;

      // The mock server connection will have already triggered one open cycle.
      // Clear any prior calls so this test only asserts ordering for the manual (re)open below.
      order.length = 0;

      orderingSocket.addConnectionListener(() => order.push('listener'));

      // Simulate a (re)connect open event. We call the handler directly so the test is deterministic.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orderingSocket['_websocket'].onopen?.(new Event('open') as any);

      expect(order).toEqual(['onSocketOpen', 'listener']);
    });
  });

  describe('heartbeat', () => {
    it('should send a heartbeat message through the WebSocket', () => {
      // Mock the WebSocket's `send` method
      const send = vi.fn();
      socket['_websocket'] = {
        ...socket.websocket,
        send,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      // Send a heartbeat message
      socket['heartbeat']();

      expect(send).toHaveBeenCalled();
    });

    it('should start a periodic heartbeat when connected on NT 4.0', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue({} as ReturnType<typeof setInterval>);
      // Force protocol to NT 4.0 so `init()`'s open handler enables heartbeat.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket.websocket as any).protocol = 'networktables.first.wpi.edu';
      } catch {
        Object.defineProperty(socket.websocket, 'protocol', {
          value: 'networktables.first.wpi.edu',
          configurable: true,
        });
      }

      // Trigger open handler again under our controlled protocol.
      socket.websocket.onopen?.(undefined as never);

      expect(setIntervalSpy).toHaveBeenCalled();
      expect(socket['heartbeatInterval']).toBeDefined();
    });
  });

  describe('RTT handling', () => {
    it('should process heartbeat messages (topicId=-1) without calling onTopicUpdate', () => {
      socket['lastHeartbeatDate'] = 100;
      socket['bestRtt'] = -1;
      socket['offset'] = 0;

      const microsSpy = vi.spyOn(Util, 'getMicros');
      microsSpy.mockReturnValueOnce(150).mockReturnValueOnce(200);

      const heartbeatMessage: BinaryMessage = [-1, 123, 2, 456];
      const encoded = encode(heartbeatMessage);
      socket['onMessage']({ data: encoded } as unknown as MessageEvent);

      expect(onTopicUpdate).not.toHaveBeenCalled();
      expect(socket['bestRtt']).toBe(50);
      expect(socket['offset']).toBe(77);
    });

    it('should not update offset/bestRtt when RTT is worse than bestRtt', () => {
      socket['lastHeartbeatDate'] = 100;
      socket['bestRtt'] = 10;
      socket['offset'] = 999;

      vi.spyOn(Util, 'getMicros').mockReturnValueOnce(150);

      const heartbeatMessage: BinaryMessage = [-1, 123, 2, 456];
      const encoded = encode(heartbeatMessage);
      socket['onMessage']({ data: encoded } as unknown as MessageEvent);

      expect(socket['bestRtt']).toBe(10);
      expect(socket['offset']).toBe(999);
    });
  });

  describe('init', () => {
    it('should clear any existing heartbeat interval before re-initializing', () => {
      // Use a dummy interval handle to avoid real timers.
      socket['heartbeatInterval'] = 1 as unknown as ReturnType<typeof setInterval>;
      expect(socket['heartbeatInterval']).toBeDefined();

      socket['init']();

      expect(socket['heartbeatInterval']).toBeUndefined();
    });
  });

  describe('auto reconnect', () => {
    it('should schedule a reconnect when auto-connect is enabled', () => {
      socket.startAutoConnect();
      const setTimeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        // Don't actually schedule anything; we only want to observe that it would.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(((_fn: any, _ms?: any) => 1 as any) as any);

      socket.websocket.onclose?.({
        code: 1000,
        reason: 'test',
        target: socket.websocket,
        wasClean: true,
        type: 'close',
      });

      expect(setTimeoutSpy).toHaveBeenCalled();
      const reconnectCall = setTimeoutSpy.mock.calls.find((c) => c[1] === 1000);
      expect(reconnectCall).toBeDefined();
    });

    it('should not schedule a reconnect when auto-connect is disabled', () => {
      socket.stopAutoConnect();
      const setTimeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(((_fn: any, _ms?: any) => 1 as any) as any);

      socket.websocket.onclose?.({
        code: 1000,
        reason: 'test',
        target: socket.websocket,
        wasClean: true,
        type: 'close',
      });

      const reconnectCall = setTimeoutSpy.mock.calls.find((c) => c[1] === 1000);
      expect(reconnectCall).toBeUndefined();
    });
  });

  describe('updateConnectionListeners', () => {
    it('should call all connection listeners with the current connection status', () => {
      const listeners = [vi.fn(), vi.fn()];
      listeners.forEach((listener) => socket['connectionListeners'].add(listener));

      socket['updateConnectionListeners']();

      expect(listeners[0]).toHaveBeenCalledWith(true);
      expect(listeners[1]).toHaveBeenCalledWith(true);

      // Simulate disconnect.
      socket['_websocket'] = {
        ...socket.websocket,
        readyState: WebSocket.CLOSED,
      } as WebSocket;
      socket['updateConnectionListeners']();

      expect(listeners[0]).toHaveBeenCalledWith(false);
      expect(listeners[1]).toHaveBeenCalledWith(false);
    });
  });

  describe('onmessage', () => {
    it('should call the binary frame handler for a binary message', () => {
      const message: BinaryMessage = [0, 0, 2, 1.0];
      const encoded = encode(message);

      // Manually trigger the onmessage event with binary data
      // Pass Uint8Array directly (handleBinaryFrame accepts both ArrayBuffer and Uint8Array)
      const event = {
        data: encoded,
      } as unknown as MessageEvent;
      // Call the private onMessage method directly
      socket['onMessage'](event);

      expect(onTopicUpdate).toHaveBeenCalledWith({
        topicId: message[0],
        serverTime: message[1],
        typeNum: message[2],
        value: message[3],
      });
    });

    it('should not throw on unhandled (but schema-valid) message methods', () => {
      // Silence logs; this path warns intentionally.
      setLogLevel(LogLevel.SILENT);

      expect(() => {
        server.send(
          JSON.stringify([
            {
              method: 'subscribe',
              params: { topics: ['foo'], subuid: 1, options: {} },
            },
          ])
        );
      }).not.toThrow();
    });

    it('should call the onAnnounce handler for an announce message', () => {
      const params: AnnounceMessageParams = {
        type: 'boolean',
        name: 'foo',
        id: 0,
        properties: {},
      };
      const message: AnnounceMessage = {
        method: 'announce',
        params,
      };

      server.send(JSON.stringify([message]));

      expect(onAnnounce).toHaveBeenCalledWith(params);
    });

    it('should call the onUnannounce handler for an unannounce message', () => {
      const params: UnannounceMessageParams = {
        name: 'foo',
        id: 0,
      };

      const message: UnannounceMessage = {
        method: 'unannounce',
        params,
      };

      server.send(JSON.stringify([message]));

      expect(onUnannounce).toHaveBeenCalledWith(params);
    });
  });

  it('should call the onProperties handler for an properties message', () => {
    const params: PropertiesMessageParams = {
      name: 'foo',
      ack: true,
      update: {},
    };

    const message: PropertiesMessage = {
      method: 'properties',
      params,
    };

    server.send(JSON.stringify([message]));

    expect(onProperties).toHaveBeenCalledWith(params);
  });
});
