import { encode, decodeMulti } from '@msgpack/msgpack';
import WebSocket from 'isomorphic-ws';

import { messageSchema, msgPackSchema } from '../types/schemas';
import { NetworkTablesTypeInfos } from '../types/types';
import { socketLogger } from '../util/logger';
import { Util } from '../util/util';

import type {
  AnnounceMessageParams,
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

  private readonly connectionListeners = new Set<(_: boolean) => void>();
  private lastHeartbeatDate = 0;
  private offset = 0;
  private bestRtt = -1;
  private heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  private connectionAttemptCount = 0;
  private lastConnectionLogTime = 0;
  private static readonly CONNECTION_LOG_INTERVAL = 10000; // Log full details every 10 seconds

  private _websocket: WebSocket;
  get websocket() {
    return this._websocket;
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
    socketLogger.info('Connection attempt started', {
      serverUrl,
      protocols: [NetworkTablesSocket.PROTOCOL_V4_1, NetworkTablesSocket.PROTOCOL_V4_0],
      autoConnect,
    });
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
    // Clear any existing heartbeat interval before creating new socket
    if (this.heartbeatInterval != null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this._websocket) {
      // Open handler
      this._websocket.onopen = () => {
        // Reset connection attempt counter on successful connection
        if (this.connectionAttemptCount > 0) {
          socketLogger.info('Connection restored', {
            attempts: this.connectionAttemptCount,
            protocol: this._websocket.protocol === 'v4.1.networktables.first.wpi.edu' ? 'NT 4.1' : 'NT 4.0',
          });
          this.connectionAttemptCount = 0;
        } else {
          if (this._websocket.protocol === 'v4.1.networktables.first.wpi.edu') {
            socketLogger.info('Connected on NT 4.1');
          } else {
            socketLogger.info('Connected on NT 4.0');
          }
        }

        // Setup heartbeat or RTT
        if (this._websocket.protocol !== 'v4.1.networktables.first.wpi.edu') {
          // Start heartbeat
          // Only send heartbeat at this rate if we are on NT 4.0
          this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
              this.heartbeat();
            }
          }, NetworkTablesSocket.RTT_PERIOD_V4_0);
        }

        socketLogger.info('Robot Connected!');
        this.updateConnectionListeners();
        this.onSocketOpen();
        this.sendQueuedMessages();
      };

      // Close handler
      this._websocket.onclose = (e: CloseEvent | WS_CloseEvent) => {
        // Notify client and cancel heartbeat
        this.updateConnectionListeners();
        this.onSocketClose();

        if (this.heartbeatInterval != null) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = undefined;
        }

        // Increment connection attempt counter
        this.connectionAttemptCount++;
        const now = Date.now();
        const timeSinceLastLog = now - this.lastConnectionLogTime;
        const shouldLogFullDetails =
          this.connectionAttemptCount === 1 || timeSinceLastLog >= NetworkTablesSocket.CONNECTION_LOG_INTERVAL;

        if (shouldLogFullDetails) {
          // Log full details on first attempt or every 10 seconds
          socketLogger.warn('Connection lost', {
            code: e.code,
            reason: e.reason || 'No reason provided',
            queuedMessages: this.messageQueue.length,
            attempt: this.connectionAttemptCount,
          });
          this.lastConnectionLogTime = now;
        } else {
          // Log concise message for repeated attempts
          socketLogger.debug('Reconnection attempt', {
            attempt: this.connectionAttemptCount,
            nextFullLogIn: Math.ceil((NetworkTablesSocket.CONNECTION_LOG_INTERVAL - timeSinceLastLog) / 1000) + 's',
          });
        }

        // Attempt to reconnect
        if (this.autoConnect) {
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
    socketLogger.info('Socket reinstantiation', { oldUrl: this.serverUrl, newUrl: serverUrl });
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
    socketLogger.debug('Connection listener added', {
      totalListeners: this.connectionListeners.size,
      immediateNotify,
      currentState: this.isConnected(),
    });

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
    socketLogger.debug('Connection listener removed', { totalListeners: this.connectionListeners.size });
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
    socketLogger.info('Auto-connect disabled');
    this.autoConnect = false;
  }

  /**
   * Starts auto-reconnecting to the server.
   */
  startAutoConnect() {
    socketLogger.info('Auto-connect enabled');
    this.autoConnect = true;
  }

  /**
   * Handle a message from the websocket.
   * @param event - The message event.
   */
  private onMessage(event: MessageEvent | WS_MessageEvent) {
    this.connectionListeners.forEach((f) => f(this.isConnected()));

    if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
      socketLogger.debug('Binary frame received', { size: event.data.byteLength });
      this.handleBinaryFrame(event.data);
    } else {
      socketLogger.debug('Text frame received', {
        size: typeof event.data === 'string' ? event.data.length : 'unknown',
      });
      this.handleTextFrame(event.data);
    }
  }

  /**
   * Handle an error from the websocket.
   * @param event - The error event.
   */
  private onError(event: Event | WS_ErrorEvent) {
    // WebSocket errors typically precede close events, so we check if we should log
    // The close handler will log the main connection failure message
    // We only log error details if we haven't logged recently to avoid duplicate messages
    const now = Date.now();
    const timeSinceLastLog = now - this.lastConnectionLogTime;

    // Only log if it's been a while since the last connection log (close handler handles most logging)
    if (timeSinceLastLog >= NetworkTablesSocket.CONNECTION_LOG_INTERVAL) {
      socketLogger.debug('WebSocket error occurred', {
        error: event instanceof ErrorEvent ? event.message : 'Connection error',
        note: 'Connection close details will follow',
      });
    }
    // Otherwise, the close handler will log the full details, so we suppress this
  }

  /**
   * Handle a binary frame from the websocket.
   * @param frame - The frame.
   */
  private handleBinaryFrame(frame: ArrayBuffer | Uint8Array) {
    // TODO: Use streams
    const messages: BinaryMessageData[] = [];
    for (const f of decodeMulti(frame)) {
      const frameData = f as Uint8Array;
      socketLogger.trace('Parsing message from multi-message frame', { frameSize: frameData.byteLength });
      const message = msgPackSchema.parse(frameData);
      socketLogger.trace('Message schema validated', { topicId: message[0], typeNum: message[2] });
      const messageData: BinaryMessageData = {
        topicId: message[0],
        serverTime: message[1],
        typeNum: message[2],
        value: message[3],
      };
      messages.push(messageData);

      // Heartbeat message
      if (messageData.topicId === -1) {
        this.handleRTT(messageData.serverTime);
      } else {
        this.onTopicUpdate(messageData);
      }
    }
    socketLogger.debug('Binary frame processed', {
      messageCount: messages.length,
      heartbeatCount: messages.filter((m) => m.topicId === -1).length,
      topicUpdateCount: messages.filter((m) => m.topicId !== -1).length,
    });
  }

  /**
   * Handle a text frame from the websocket.
   * @param frame - The frame.
   */
  private handleTextFrame(frame: string) {
    // Parse the message from the server
    const messageData = JSON.parse(frame);
    const messages = messageSchema.parse(messageData);

    const methodCounts: Record<string, number> = {};
    messages.forEach((message) => {
      methodCounts[message.method] = (methodCounts[message.method] || 0) + 1;
      // Check the type of the message and handle it accordingly
      switch (message.method) {
        case 'announce':
          this.onAnnounce(message.params);
          break;
        case 'unannounce':
          this.onUnannounce(message.params);
          break;
        case 'properties':
          this.onProperties(message.params);
          break;
        default:
          socketLogger.warn('Client does not handle message method', { method: message.method });
      }
    });
    socketLogger.debug('Text frame processed', { messageCount: messages.length, methodCounts });
  }

  /**
   * Send a text frame to the server.
   * @param message - The message to send.
   */
  sendTextFrame(message: Message) {
    // Send the message to the server
    if (this.isConnected()) {
      socketLogger.debug('Text frame sent', { method: message.method });
      this._websocket.send(JSON.stringify([message]));
    } else {
      socketLogger.debug('Message queued', {
        method: message.method,
        reason: 'not connected',
        queueSize: this.messageQueue.length,
      });
      this.messageQueue.push(JSON.stringify([message]));
    }
  }

  /**
   * Function to send queued messages whenever the WebSocket connection is opened
   */
  private sendQueuedMessages() {
    if (this.isConnected()) {
      const queuedCount = this.messageQueue.length;
      if (queuedCount > 0) {
        socketLogger.info('Sending queued messages', { count: queuedCount });
      }
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
   * @param pubuid - The topic's publisher UID.
   * @param value - The value to send.
   * @param typeInfo - The type info for the value.
   * @returns The time the message was sent.
   */
  sendValueToTopic(pubuid: number, value: NetworkTablesTypes, typeInfo: NetworkTablesTypeInfo) {
    const time = Math.ceil(this.getServerTime());
    const message = Util.createBinaryMessage(pubuid, time, value, typeInfo);

    const cleanMsg = msgPackSchema.parse(message);
    const topicId = cleanMsg[0];
    const typeNum = cleanMsg[2];

    // Send the message to the server
    if (this.isConnected()) {
      socketLogger.debug('Binary frame sent', { topicId, typeNum });
      this._websocket.send(encode(cleanMsg));
    } else {
      socketLogger.debug('Binary frame dropped (not connected)', {
        topicId,
        typeNum,
      });
    }

    return time;
  }

  /**
   * Send a heartbeat message to the server.
   */
  private heartbeat() {
    const time = Util.getMicros();
    socketLogger.debug('Heartbeat sent', { time });
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
    const wasUpdated = rtt < this.bestRtt || this.bestRtt === -1;
    if (wasUpdated) {
      this.bestRtt = rtt;
      this.offset = Util.getMicros() - serverTime;
    }
    socketLogger.debug('RTT calculated', {
      rtt,
      bestRtt: this.bestRtt,
      offset: this.offset,
      serverTime,
      updated: wasUpdated,
    });
  }

  /**
   * Get the current server time.
   * @returns The current server time.
   */
  private getServerTime() {
    const clientTime = Util.getMicros();
    const serverTime = clientTime - this.offset + this.bestRtt / 2;
    socketLogger.trace('Server time calculated', {
      clientTime,
      offset: this.offset,
      bestRtt: this.bestRtt,
      serverTime,
    });
    return serverTime;
  }

  /**
   * Calculate the time delta between the current time and a given time.
   * @param sentDate - The time to calculate the delta from.
   * @returns The time delta.
   */
  private calcTimeDelta(sentDate: number) {
    const currentTime = Util.getMicros();
    const delta = currentTime - sentDate;
    socketLogger.trace('Time delta calculated', { sentDate, currentTime, delta });
    return delta;
  }

  /**
   * Close the websocket connection.
   */
  close() {
    this._websocket.close();
  }
}

export default NetworkTablesSocket;
