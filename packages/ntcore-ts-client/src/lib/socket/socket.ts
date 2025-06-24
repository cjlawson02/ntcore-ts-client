import { encode, decodeMulti } from '@msgpack/msgpack';
import WebSocket from 'isomorphic-ws';

import { messageSchema, msgPackSchema } from '../types/schemas';
import { NetworkTablesTypeInfos } from '../types/types';
import { Util } from '../util/util';

import type {
  AnnounceMessageParams,
  BinaryMessage,
  Message,
  PropertiesMessageParams,
  UnannounceMessageParams,
  NetworkTablesTypes,
  NetworkTablesTypeInfo,
  BinaryMessageData,
} from '../types/types';
import type { CloseEvent as WS_CloseEvent, MessageEvent as WS_MessageEvent, ErrorEvent as WS_ErrorEvent } from 'ws';

/** Socket for NetworkTables 4.1 */
export class NetworkTablesSocket {
  private static instances = new Map<string, NetworkTablesSocket>();
  private static readonly PROTOCOL_V4_0 = 'networktables.first.wpi.edu';
  private static readonly PROTOCOL_V4_1 = 'v4.1.networktables.first.wpi.edu';
  private static readonly RECONNECT_TIMEOUT = 1000;
  private static readonly RTT_PERIOD_V4_0 = 1000;
  private static readonly TIMEOUT_V4_1 = 1000;

  private readonly connectionListeners = new Set<(_: boolean) => void>();
  private lastHeartbeatDate = 0;
  private offset = 0;
  private bestRtt = -1;

  private _websocket: WebSocket;
  get websocket() {
    return this._websocket;
  }

  set websocket(websocket: WebSocket) {
    this._websocket = websocket;
  }
  private serverUrl: string;

  private readonly onSocketOpen: () => void;
  private readonly onSocketClose: () => void;
  private readonly onTopicUpdate: (_: BinaryMessageData) => void;
  private readonly onAnnounce: (_: AnnounceMessageParams) => void;
  private readonly onUnannounce: (_: UnannounceMessageParams) => void;
  private readonly onProperties: (_: PropertiesMessageParams) => void;

  private autoConnect = true;
  private messageQueue: (string | ArrayBuffer)[] = [];

  /**
   * Creates a new NetworkTables socket.
   * @param serverUrl - The URL of the server to connect to.
   * @param onSocketOpen - Called when the socket is opened.
   * @param onSocketClose - Called when the socket is closed.
   * @param onTopicUpdate - Called when a topic is updated.
   * @param onAnnounce - Called when a topic is announced.
   * @param onUnannounce - Called when a topic is unannounced.
   * @param onProperties - Called when a topic's properties are updated.
   * @param autoConnect - Whether to automatically connect to the server.
   */
  private constructor(
    serverUrl: string,
    onSocketOpen: () => void,
    onSocketClose: () => void,
    onTopicUpdate: (_: BinaryMessageData) => void,
    onAnnounce: (_: AnnounceMessageParams) => void,
    onUnannounce: (_: UnannounceMessageParams) => void,
    onProperties: (_: PropertiesMessageParams) => void,
    autoConnect: boolean
  ) {
    // Connect to the server using the provided URL
    this._websocket = new WebSocket(serverUrl, [NetworkTablesSocket.PROTOCOL_V4_1, NetworkTablesSocket.PROTOCOL_V4_0]);
    this.serverUrl = serverUrl;
    this.onSocketOpen = onSocketOpen;
    this.onSocketClose = onSocketClose;
    this.onTopicUpdate = onTopicUpdate;
    this.onAnnounce = onAnnounce;
    this.onUnannounce = onUnannounce;
    this.onProperties = onProperties;

    this.autoConnect = autoConnect;

    this.init();
  }

  /**
   * Gets the instance of the NetworkTables socket.
   * @param serverUrl - The URL of the server to connect to.
   * @param onSocketOpen - Called when the socket is opened.
   * @param onSocketClose - Called when the socket is closed.
   * @param onTopicUpdate - Called when a topic is updated.
   * @param onAnnounce - Called when a topic is announced.
   * @param onUnannounce - Called when a topic is unannounced.
   * @param onProperties - Called when a topic's properties are updated.
   * @param autoConnect - Whether to automatically connect to the server.
   * @returns The instance of the NetworkTables socket.
   */
  static getInstance(
    serverUrl: string,
    onSocketOpen: () => void,
    onSocketClose: () => void,
    onTopicUpdate: (_: BinaryMessageData) => void,
    onAnnounce: (_: AnnounceMessageParams) => void,
    onUnannounce: (_: UnannounceMessageParams) => void,
    onProperties: (_: PropertiesMessageParams) => void,
    autoConnect = true
  ): NetworkTablesSocket {
    let instance = this.instances.get(serverUrl);
    if (!instance) {
      instance = new this(
        serverUrl,
        onSocketOpen,
        onSocketClose,
        onTopicUpdate,
        onAnnounce,
        onUnannounce,
        onProperties,
        autoConnect
      );
      this.instances.set(serverUrl, instance);
    }

    return instance;
  }

  /**
   * Initialization. This is done outside of the constructor to allow for
   * the socket to refresh itself.
   */
  private init() {
    let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

    if (this._websocket) {
      // Open handler
      this._websocket.onopen = () => {
        // Setup heartbeat or RTT

        if (this._websocket.protocol === 'v4.1.networktables.first.wpi.edu') {
          // eslint-disable-next-line no-console
          console.info('Connected on NT 4.1');
        } else {
          // eslint-disable-next-line no-console
          console.info('Connected on NT 4.0');

          // Start heartbeat
          // Only send heartbeat at this rate if we are on NT 4.0
          heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
              this.heartbeat();
            }
          }, NetworkTablesSocket.RTT_PERIOD_V4_0);
        }

        // eslint-disable-next-line no-console
        console.info('Robot Connected!');
        this.updateConnectionListeners();
        this.onSocketOpen();
        this.sendQueuedMessages();
      };

      // Close handler
      this._websocket.onclose = (e: CloseEvent | WS_CloseEvent) => {
        // Notify client and cancel heartbeat
        this.updateConnectionListeners();
        this.onSocketClose();

        if (heartbeatInterval != null) {
          clearInterval(heartbeatInterval);
        }

        // Lost connection message
        console.warn('Unable to connect to Robot', e.reason);

        // Attempt to reconnect
        if (this.autoConnect) {
          console.warn(`Reconnect will be attempted in ${NetworkTablesSocket.RECONNECT_TIMEOUT} milliseconds.`);
          setTimeout(() => {
            this._websocket = new WebSocket(this.serverUrl, [
              NetworkTablesSocket.PROTOCOL_V4_1,
              NetworkTablesSocket.PROTOCOL_V4_0,
            ]);
            this.init();
          }, NetworkTablesSocket.RECONNECT_TIMEOUT);
        }
      };

      this._websocket.binaryType = 'arraybuffer';

      // Set up event listeners for messages and errors
      this._websocket.onmessage = (event: MessageEvent | WS_MessageEvent) => this.onMessage(event);
      this._websocket.onerror = (event: Event | WS_ErrorEvent) => this.onError(event);
    }
  }

  /**
   * Reset the socket and reconnect to the server.
   * @param serverUrl - The URL of the server to connect to.
   */
  reinstantiate(serverUrl: string) {
    this.close();
    this.serverUrl = serverUrl;
    this._websocket = new WebSocket(this.serverUrl, [
      NetworkTablesSocket.PROTOCOL_V4_1,
      NetworkTablesSocket.PROTOCOL_V4_0,
    ]);
    this.init();
  }

  /**
   * Returns whether the socket is connected.
   * @returns Whether the socket is connected.
   */
  isConnected() {
    return this._websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Returns whether the socket is connecting.
   * @returns Whether the socket is connecting.
   */
  isConnecting() {
    return this._websocket.readyState === WebSocket.CONNECTING;
  }

  /**
   * Returns whether the socket is closing.
   * @returns Whether the socket is closing.
   */
  isClosing() {
    return this._websocket.readyState === WebSocket.CLOSING;
  }

  /**
   * Returns whether the socket is closed.
   * @returns Whether the socket is closed.
   */
  isClosed() {
    return this._websocket.readyState === WebSocket.CLOSED;
  }

  /**
   * Wait for the socket to connect.
   * @returns A promise that resolves when the socket is connected.
   */
  waitForConnection() {
    return new Promise<void>((resolve) => {
      if (this.isConnected()) {
        resolve();
      } else {
        const listener = () => {
          if (this.isConnected()) {
            this.removeConnectionListener(listener);
            resolve();
          }
        };
        this.addConnectionListener(listener);
      }
    });
  }

  /**
   * Create a connection listener.
   * @param callback - Called when the connection state changes.
   * @param immediateNotify - Whether to immediately notify the callback of the current connection state.
   * @returns A function that removes the listener.
   */
  addConnectionListener(callback: (_: boolean) => void, immediateNotify?: boolean) {
    this.connectionListeners.add(callback);

    if (immediateNotify) {
      callback(this.isConnected());
    }

    return () => this.removeConnectionListener(callback);
  }

  /**
   * Remove a connection listener.
   * @param callback - The callback to remove.
   */
  removeConnectionListener(callback: (_: boolean) => void) {
    this.connectionListeners.delete(callback);
  }

  /**
   * Updates all connection listeners with the current connection state.
   */
  private updateConnectionListeners() {
    this.connectionListeners.forEach((callback) => callback(this.isConnected()));
  }

  /**
   * Stops auto-reconnecting to the server.
   */
  stopAutoConnect() {
    this.autoConnect = false;
  }

  /**
   * Starts auto-reconnecting to the server.
   */
  startAutoConnect() {
    this.autoConnect = true;
  }

  /**
   * Handle a message from the websocket.
   * @param event - The message event.
   */
  private onMessage(event: MessageEvent | WS_MessageEvent) {
    this.connectionListeners?.forEach((f) => f(this.isConnected()));

    if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
      this.handleBinaryFrame(event.data);
    } else {
      this.handleTextFrame(event.data);
    }
  }

  /**
   * Handle an error from the websocket.
   * @param event - The error event.
   */
  private onError(event: Event | WS_ErrorEvent) {
    // Log the error to the console
    console.error('WebSocket error:', event);
  }

  /**
   * Handle a binary frame from the websocket.
   * @param frame - The frame.
   */
  private handleBinaryFrame(frame: ArrayBuffer | Uint8Array) {
    // TODO: Use streams
    for (const f of decodeMulti(frame)) {
      const message = msgPackSchema.parse(f);
      const messageData: BinaryMessageData = {
        topicId: message[0],
        serverTime: message[1],
        typeNum: message[2],
        value: message[3],
      };

      // Heartbeat message
      if (messageData.topicId === -1) {
        this.handleRTT(messageData.serverTime);
      } else {
        this.onTopicUpdate(messageData);
      }
    }
  }

  /**
   * Handle a text frame from the websocket.
   * @param frame - The frame.
   */
  private handleTextFrame(frame: string) {
    // Parse the message from the server
    const messageData = JSON.parse(frame);
    const messages = messageSchema.parse(messageData);

    messages.forEach((message) => {
      // Check the type of the message and handle it accordingly
      switch (message.method) {
        case 'announce':
          this.handleAnnounceParams(message.params);
          break;
        case 'unannounce':
          this.handleUnannounceParams(message.params);
          break;
        case 'properties':
          this.handlePropertiesParams(message.params);
          break;
        default:
          console.warn('Client does not handle message method:', message.method);
      }
    });
  }

  /**
   * Handle an announce message from the server.
   * @param params - The message params.
   */
  private handleAnnounceParams(params: AnnounceMessageParams) {
    this.onAnnounce(params);
  }

  /**
   * Handle an unannounce message from the server.
   * @param params - The message params.
   */
  private handleUnannounceParams(params: UnannounceMessageParams) {
    this.onUnannounce(params);
  }

  /**
   * Handle a properties message from the server.
   * @param params - The message params.
   */
  private handlePropertiesParams(params: PropertiesMessageParams) {
    this.onProperties(params);
  }

  /**
   * Send a text frame to the server.
   * @param message - The message to send.
   */
  sendTextFrame(message: Message) {
    // Send the message to the server
    if (this.isConnected()) {
      this._websocket.send(JSON.stringify([message]));
    } else {
      this.messageQueue.push(JSON.stringify([message]));
    }
  }

  /**
   * Send a binary frame to the server.
   * @param message - The message to send.
   */
  private sendBinaryFrame(message: BinaryMessage) {
    const cleanMsg = msgPackSchema.parse(message);

    // Send the message to the server
    if (this.isConnected()) {
      this._websocket.send(encode(cleanMsg));
    } else {
      this.messageQueue.push(encode(cleanMsg));
    }
  }

  /**
   * Function to send queued messages whenever the WebSocket connection is opened
   */
  private sendQueuedMessages() {
    if (this.isConnected()) {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this._websocket.send(message);
        }
      }
    }
  }

  /**
   * Send a message to a topic.
   * @param id - The topic ID.
   * @param value - The value to send.
   * @param typeInfo - The type info for the value.
   * @returns The time the message was sent.
   */
  sendValueToTopic(id: number, value: NetworkTablesTypes, typeInfo: NetworkTablesTypeInfo) {
    const time = Math.ceil(this.getServerTime());
    const message = Util.createBinaryMessage(id, time, value, typeInfo);
    this.sendBinaryFrame(message);
    return time;
  }

  /**
   * Send a heartbeat message to the server.
   */
  private heartbeat() {
    const time = Util.getMicros();
    this.sendValueToTopic(-1, time, NetworkTablesTypeInfos.kDouble);
    this.lastHeartbeatDate = time;
  }

  /**
   * Handle a round trip time message from the server.
   *
   * This is used to calculate the offset between the client and server time
   * in order to estimate the current server time for binary messages.
   * @param serverTime - The server time.
   */
  private handleRTT(serverTime: number) {
    const rtt = this.calcTimeDelta(this.lastHeartbeatDate);
    if (rtt < this.bestRtt || this.bestRtt === -1) {
      this.bestRtt = rtt;
      this.offset = Util.getMicros() - serverTime;
    }
  }

  /**
   * Get the current server time.
   * @returns The current server time.
   */
  private getServerTime() {
    return Util.getMicros() - this.offset + this.bestRtt / 2;
  }

  /**
   * Calculate the time delta between the current time and a given time.
   * @param sentDate - The time to calculate the delta from.
   * @returns The time delta.
   */
  private calcTimeDelta(sentDate: number) {
    return Util.getMicros() - sentDate;
  }

  /**
   * Close the websocket connection.
   */
  close() {
    this._websocket.close();
  }
}

export default NetworkTablesSocket;
