import { encode } from '@msgpack/msgpack';
import WebSocket from 'isomorphic-ws';
import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';
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

  afterEach(() => {
    WSMock.clean();
    onSocketOpen.mockClear();
    onSocketClose.mockClear();
    onTopicUpdate.mockClear();
    onAnnounce.mockClear();
    onUnannounce.mockClear();
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
      server.close();

      expect(socket.isConnected()).toBe(false);
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
        ...socket.websocket,
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
  });

  describe('updateConnectionListeners', () => {
    it('should call all connection listeners with the current connection status', () => {
      const listeners = [vi.fn(), vi.fn()];
      listeners.forEach((listener) => socket['connectionListeners'].add(listener));

      socket['updateConnectionListeners']();

      expect(listeners[0]).toHaveBeenCalledWith(true);
      expect(listeners[1]).toHaveBeenCalledWith(true);

      // Close the WebSocket
      server.close();

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
    };

    const message: PropertiesMessage = {
      method: 'properties',
      params,
    };

    server.send(JSON.stringify([message]));

    expect(onProperties).toHaveBeenCalledWith(params);
  });
});
