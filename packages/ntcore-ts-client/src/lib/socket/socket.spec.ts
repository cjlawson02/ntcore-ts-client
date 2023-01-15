import WebSocket from 'isomorphic-ws';
import WSMock from 'jest-websocket-mock';

import { NetworkTablesSocket } from './socket';

jest.mock('ws');

describe('NetworkTablesSocket', () => {
  let socket: NetworkTablesSocket;
  const serverUrl = 'ws://localhost:5810/nt/1234';
  let server: WSMock;
  let onSocketOpen: jest.Mock;
  let onSocketClose: jest.Mock;
  let onTopicUpdate: jest.Mock;
  let onAnnounce: jest.Mock;
  let onUnannounce: jest.Mock;

  beforeEach(async () => {
    // Create mock event handlers
    onSocketOpen = jest.fn();
    onSocketClose = jest.fn();
    onTopicUpdate = jest.fn();
    onAnnounce = jest.fn();
    onUnannounce = jest.fn();

    server = new WSMock(serverUrl);

    // Create an instance of the NetworkTablesSocket class
    socket = NetworkTablesSocket.getInstance(
      serverUrl,
      onSocketOpen,
      onSocketClose,
      onTopicUpdate,
      onAnnounce,
      onUnannounce
    );

    await server.connected;
  });

  afterEach(() => {
    WSMock.clean();
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

  describe('isClosing', () => {
    it('should return true if the WebSocket is closing', () => {
      // Mock the WebSocket's `readyState` property to be `WebSocket.CLOSING`
      socket.websocket = {
        ...socket.websocket,
        readyState: WebSocket.CLOSING,
      } as WebSocket;

      expect(socket.isClosing()).toBe(true);
    });

    it('should return false if the WebSocket is not closing', () => {
      expect(socket.isClosing()).toBe(false);
    });
  });

  describe('isClosed', () => {
    it('should return true if the WebSocket is closed', () => {
      // Mock the WebSocket's `readyState` property to be `WebSocket.CLOSED`
      socket.websocket = {
        ...socket.websocket,
        readyState: WebSocket.CLOSED,
      } as WebSocket;

      expect(socket.isClosed()).toBe(true);
    });

    it('should return false if the WebSocket is not closed', () => {
      expect(socket.isClosed()).toBe(false);
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
      const send = jest.fn();
      socket.websocket = {
        ...socket.websocket,
        send,
      } as any;

      // Queue some messages
      const messages = ['Hello, world!', 'Foo', 'Bar'];
      socket['messageQueue'].push(...messages);

      // Set the WebSocket's `readyState` property to be `WebSocket.CONNECTING`
      socket.websocket = {
        ...socket.websocket,
        readyState: WebSocket.CONNECTING,
      } as WebSocket;

      // Send the queued messages
      socket['sendQueuedMessages']();

      expect(send).not.toHaveBeenCalled();
      expect(socket['messageQueue']).toHaveLength(messages.length);
    });
  });

  describe('heartbeat', () => {
    it('should send a heartbeat message through the WebSocket', () => {
      // Mock the WebSocket's `send` method
      const send = jest.fn();
      socket.websocket = {
        ...socket.websocket,
        send,
      } as any;
      // Send a heartbeat message
      socket['heartbeat']();

      expect(send).toHaveBeenCalled();
    });
  });

  describe('updateConnectionListeners', () => {
    it('should call all connection listeners with the current connection status', () => {
      const listeners = [jest.fn(), jest.fn()];
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

  // describe('onmessage', () => {
  //   it('should call the binary frame handler for a binary message', () => {
  //     const message: BinaryMessage = [0, 0, 1, 1.0];

  //     // Trigger the onmessage event
  //     socket['onMessage']({
  //       data: encode(message) as ArrayBuffer,
  //     } as MessageEvent);

  //     expect(onTopicUpdate).toHaveBeenCalledWith({
  //       topicId: message[0],
  //       serverTime: message[1],
  //       typeInfo: Util.getNetworkTableTypeFromTypeNum(message[2]),
  //       value: message[3],
  //     });
  //   });

  //   it('should call the onAnnounce handler for an announce message', () => {
  //     const params: AnnounceMessageParams = {
  //       type: 'boolean',
  //       name: 'foo',
  //       id: 0,
  //       properties: {},
  //     };
  //     const message: AnnounceMessage = {
  //       method: 'announce',
  //       params,
  //     };

  //     // Trigger the onmessage event
  //     socket['onMessage']({
  //       data: JSON.stringify([message]),
  //     } as MessageEvent);

  //     expect(onAnnounce).toHaveBeenCalledWith(params);
  //   });

  //   it('should call the onUnannounce handler for an unannounce message', () => {
  //     const params: UnannounceMessageParams = {
  //       name: 'foo',
  //       id: 0,
  //     };

  //     const message: UnannounceMessage = {
  //       method: 'unannounce',
  //       params,
  //     };

  //     // Trigger the onmessage event
  //     socket['onMessage']({
  //       data: JSON.stringify([message]),
  //     } as MessageEvent);

  //     expect(onUnannounce).toHaveBeenCalledWith(params);
  //   });
  // });
});
