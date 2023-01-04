import { messageSchema, msgPackSchema } from '../types/schemas';
import {
  AnnounceMessageParams,
  BinaryMessage,
  Message,
  PropertiesMessageParams,
  UnannounceMessageParams,
  NetworkTableTypes,
  NetworkTableTypeInfo,
  NetworkTableTypeInfos,
  BinaryMessageData,
} from '../types/types';
import { encode, decodeMulti } from '@msgpack/msgpack';
import Util from '../util/util';

/** Socket for NetworkTables 4.0 */
export class NetworkTablesSocket {
  private static instance: NetworkTablesSocket;
  private readonly connectionListeners = new Set<
    (connected: boolean) => void
  >();
  private lastHeartbeatDate = 0;
  private offset = 0;
  private bestRtt = -1;

  private _websocket: WebSocket;
  public get websocket() {
    return this._websocket;
  }

  public set websocket(websocket: WebSocket) {
    this._websocket = websocket;
  }
  private serverUrl: string;

  private readonly onSocketOpen: () => void;
  private readonly onSocketClose: () => void;
  private readonly onTopicUpdate: (message: BinaryMessageData) => void;
  private readonly onAnnounce: (params: AnnounceMessageParams) => void;
  private readonly onUnannounce: (params: UnannounceMessageParams) => void;

  private autoConnect = true;
  private messageQueue: (string | ArrayBuffer)[] = [];

  /**
   * Creates a new NetworkTables socket.
   * @param serverUrl The URL of the server to connect to.
   * @param client The client to notify of socket events.
   */
  private constructor(
    serverUrl: string,
    onSocketOpen: () => void,
    onSocketClose: () => void,
    onTopicUpdate: (message: BinaryMessageData) => void,
    onAnnounce: (params: AnnounceMessageParams) => void,
    onUnannounce: (params: UnannounceMessageParams) => void
  ) {
    // Connect to the server using the provided URL
    this._websocket = new WebSocket(serverUrl, 'networktables.first.wpi.edu');
    this.serverUrl = serverUrl;
    this.onSocketOpen = onSocketOpen;
    this.onSocketClose = onSocketClose;
    this.onTopicUpdate = onTopicUpdate;
    this.onAnnounce = onAnnounce;
    this.onUnannounce = onUnannounce;

    this.init();
  }

  public static getInstance(
    serverUrl: string,
    onSocketOpen: () => void,
    onSocketClose: () => void,
    onTopicUpdate: (message: BinaryMessageData) => void,
    onAnnounce: (params: AnnounceMessageParams) => void,
    onUnannounce: (params: UnannounceMessageParams) => void
  ): NetworkTablesSocket {
    if (!this.instance) {
      this.instance = new this(
        serverUrl,
        onSocketOpen,
        onSocketClose,
        onTopicUpdate,
        onAnnounce,
        onUnannounce
      );
    }
    return this.instance;
  }

  /**
   * Initialization. This is done outside of the constructor to allow for
   * the socket to refresh itself.
   */
  private init() {
    let heartbeatInterval: ReturnType<typeof setInterval>;

    if (this._websocket) {
      // Open handler
      this._websocket.onopen = () => {
        this.updateConnectionListeners();
        this.onSocketOpen();
        console.info('Robot Connected!');
        this.sendQueuedMessages();

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          if (this.isConnected()) {
            this.heartbeat();
          }
        }, 1000);
      };

      // Close handler
      this._websocket.onclose = (e) => {
        // Notify client and cancel heartbeat
        this.updateConnectionListeners();
        this.onSocketClose();
        clearInterval(heartbeatInterval);

        // Lost connection message
        console.warn(
          'Unable to connect to Robot. Reconnect will be attempted in 1 second.',
          e.reason
        );

        // Attempt to reconnect
        if (this.autoConnect) {
          setTimeout(() => {
            this._websocket = new WebSocket(
              this.serverUrl,
              'networktables.first.wpi.edu'
            );
            this.init();
          }, 1000);
        }
      };

      this._websocket.binaryType = 'arraybuffer';

      // Set up event listeners for messages and errors
      this._websocket.onmessage = (event) => this.onMessage(event);
      this._websocket.onerror = (event) => this.onError(event);
    }
  }

  public reinstantiate(serverUrl: string) {
    this.close();
    this.serverUrl = serverUrl;
    this._websocket = new WebSocket(
      this.serverUrl,
      'networktables.first.wpi.edu'
    );
    this.init();
  }

  /**
   * Returns whether the socket is connected.
   * @returns Whether the socket is connected.
   */
  public isConnected() {
    return this._websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Returns whether the socket is connecting.
   * @returns Whether the socket is connecting.
   */
  public isConnecting() {
    return this._websocket.readyState === WebSocket.CONNECTING;
  }

  /**
   * Returns whether the socket is closing.
   * @returns Whether the socket is closing.
   */
  public isClosing() {
    return this._websocket.readyState === WebSocket.CLOSING;
  }

  /**
   * Returns whether the socket is closed.
   * @returns Whether the socket is closed.
   */
  public isClosed() {
    return this._websocket.readyState === this._websocket.CLOSED;
  }

  /**
   * Create a connection listener.
   * @param callback Called when the connection state changes.
   * @param immediateNotify Whether to immediately notify the callback of the current connection state.
   * @returns A function that removes the listener.
   */
  public addConnectionListener(
    callback: (connected: boolean) => void,
    immediateNotify?: boolean
  ) {
    this.connectionListeners.add(callback);

    if (immediateNotify) {
      callback(this.isConnected());
    }

    return () => this.connectionListeners.delete(callback);
  }

  /**
   * Updates all connection listeners with the current connection state.
   */
  private updateConnectionListeners() {
    this.connectionListeners.forEach((callback) =>
      callback(this.isConnected())
    );
  }

  /**
   * Stops auto-reconnecting to the server.
   */
  public stopAutoConnect() {
    this.autoConnect = false;
  }

  /**
   * Starts auto-reconnecting to the server.
   */
  public startAutoConnect() {
    this.autoConnect = true;
  }

  /**
   * Handle a message from the websocket.
   * @param event The message event.
   */
  private onMessage(event: MessageEvent) {
    this.connectionListeners?.forEach((f) => f(this.isConnected()));

    if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
      this.handleBinaryFrame(event.data);
    } else {
      this.handleTextFrame(event.data);
    }
  }

  /**
   * Handle an error from the websocket.
   * @param event The error event.
   */
  private onError(event: Event) {
    // Log the error to the console
    console.error('WebSocket error:', event);
  }

  /**
   * Handle a binary frame from the websocket.
   * @param frame The frame.
   */
  private handleBinaryFrame(frame: ArrayBuffer | Uint8Array) {
    // TODO: Use streams
    for (const f of decodeMulti(frame)) {
      const message = msgPackSchema.parse(f);

      const messageData: BinaryMessageData = {
        topicId: message[0],
        serverTime: message[1],
        typeInfo: Util.getNetworkTableTypeFromTypeNum(message[2]),
        value: message[3],
      };

      // Heartbeat message
      if (messageData.topicId === -1) {
        this.handleRTT(messageData.serverTime);
      }

      // Normal message
      else {
        this.onTopicUpdate(messageData);
      }
    }
  }

  /**
   * Handle a text frame from the websocket.
   * @param frame The frame.
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
          console.warn(
            'Client does not handle message method:',
            message.method
          );
      }
    });
  }

  /**
   * Handle an announce message from the server.
   * @param params The message params.
   */
  private handleAnnounceParams(params: AnnounceMessageParams) {
    this.onAnnounce(params);
  }

  /**
   * Handle an unannounce message from the server.
   * @param params The message params.
   */
  private handleUnannounceParams(params: UnannounceMessageParams) {
    this.onUnannounce(params);
  }

  /**
   * Handle a properties message from the server.
   * @param params The message params.
   */
  private handlePropertiesParams(params: PropertiesMessageParams) {
    // Extract the topic ID and properties from the params
    const { name, ack } = params;

    // TODO: Do we need to do something with this?
    console.log('Server properties: ', name, 'ack:', ack);
  }

  /**
   * Send a text frame to the server.
   * @param message The message to send.
   */
  public sendTextFrame(message: Message) {
    // Send the message to the server
    if (this.isConnected()) {
      this._websocket.send(JSON.stringify([message]));
    } else {
      this.messageQueue.push(JSON.stringify([message]));
    }
  }

  /**
   * Send a binary frame to the server.
   * @param message The message to send.
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
   * @param topic The topic ID or the pubuid.
   * @param value The value to send.
   */
  public sendValueToTopic(
    id: number,
    value: NetworkTableTypes,
    typeInfo?: NetworkTableTypeInfo
  ) {
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
    this.sendValueToTopic(-1, time, NetworkTableTypeInfos.kDouble);
    this.lastHeartbeatDate = time;
  }

  /**
   * Handle a round trip time message from the server.
   *
   * This is used to calculate the offset between the client and server time
   * in order to estimate the current server time for binary messages.
   * @param serverTime The server time.
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
   * @param sentDate The time to calculate the delta from.
   * @returns The time delta.
   */
  private calcTimeDelta(sentDate: number) {
    return Util.getMicros() - sentDate;
  }

  /**
   * Close the websocket connection.
   */
  public close() {
    this._websocket.close();
  }
}

export default NetworkTablesSocket;
