import { messageSchema } from '../types/schemas';

import { NetworkTablesSocket } from './socket';

import type { NetworkTablesTopic } from '../pubsub/topic';
import type {
  Message,
  PublishMessage,
  PublishMessageParams,
  SetPropertiesMessage,
  SetPropertiesMessageParams,
  SubscribeMessage,
  SubscribeMessageParams,
  UnpublishMessage,
  NetworkTablesTypes,
  BinaryMessageData,
  AnnounceMessageParams,
  UnannounceMessageParams,
  PropertiesMessageParams,
  AnnounceMessage,
  PropertiesMessage,
} from '../types/types';
import type { MessageEvent as WS_MessageEvent } from 'ws';

/** NetworkTables client. */
export class Messenger {
  private readonly _socket: NetworkTablesSocket;
  private readonly publications = new Map<number, PublishMessageParams>();
  private readonly subscriptions = new Map<number, SubscribeMessageParams>();
  private static _instances = new Map<string, Messenger>();
  private _currentPubUID = 0;
  private _currentSubUID = 0;

  /**
   * Gets the NetworkTablesSocket used by the Messenger.
   * @returns The NetworkTablesSocket used by the Messenger.
   */
  get socket() {
    return this._socket;
  }

  /**
   * Creates a new NetworkTables client.
   * @param serverUrl - The URL of the server to connect to.
   * @param onTopicUpdate - Called when a topic is updated.
   * @param onAnnounce - Called when a topic is announced.
   * @param onUnannounce - Called when a topic is unannounced.
   * @param onTopicProperties - Called when a topic's properties are updated.
   */
  private constructor(
    serverUrl: string,
    onTopicUpdate: (_: BinaryMessageData) => void,
    onAnnounce: (_: AnnounceMessageParams) => void,
    onUnannounce: (_: UnannounceMessageParams) => void,
    onTopicProperties: (_: PropertiesMessageParams) => void
  ) {
    this._socket = NetworkTablesSocket.getInstance(
      serverUrl,
      this.onSocketOpen,
      this.onSocketClose,
      onTopicUpdate,
      onAnnounce,
      onUnannounce,
      onTopicProperties
    );
  }

  /**
   * Gets the instance of the NetworkTables client.
   * @param serverUrl - The URL of the server to connect to. This is not needed after the first call.
   * @param onTopicUpdate - Called when a topic is updated.
   * @param onAnnounce - Called when a topic is announced.
   * @param onUnannounce - Called when a topic is unannounced.
   * @param onTopicProperties - Called when a topic's properties are updated.
   * @returns The instance of the NetworkTables client.
   */
  static getInstance(
    serverUrl: string,
    onTopicUpdate: (_: BinaryMessageData) => void,
    onAnnounce: (_: AnnounceMessageParams) => void,
    onUnannounce: (_: UnannounceMessageParams) => void,
    onTopicProperties: (_: PropertiesMessageParams) => void
  ): Messenger {
    let instance = this._instances.get(serverUrl);
    if (!instance) {
      instance = new this(serverUrl, onTopicUpdate, onAnnounce, onUnannounce, onTopicProperties);
      this._instances.set(serverUrl, instance);
    }
    return instance;
  }

  /**
   * Reinstantiates the messenger by resetting the socket with a new URL.
   * @param serverUrl - The URL of the server to connect to.
   */
  reinstantiate(serverUrl: string) {
    this._socket.stopAutoConnect();
    this._socket.reinstantiate(serverUrl);
    this._socket.startAutoConnect();
  }

  /**
   * Gets all publications.
   * @returns An iterator of all publications in the form [id, params].
   */
  getPublications() {
    return this.publications.entries();
  }

  /**
   * Gets all subscriptions.
   * @returns An iterator of all subscriptions in the form [id, params].
   */
  getSubscriptions() {
    return this.subscriptions.entries();
  }

  /**
   * Called when the socket opens.
   */
  onSocketOpen = () => {
    // Send all subscriptions
    this.subscriptions.forEach((params) => {
      this.subscribe(params, true);
    });

    // Send all publications
    this.publications.forEach((params) => {
      this.publish(params, true);
    });
  };

  /**
   * Called when the socket closes.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onSocketClose = () => {};

  private parseAndFilterMessage<T extends Message>(
    event: MessageEvent | WS_MessageEvent,
    method: Message['method']
  ): T | null {
    if (!(event.data instanceof ArrayBuffer) && !(event.data instanceof Uint8Array)) {
      const messageData = JSON.parse(event.data);
      const messages = messageSchema.parse(messageData);
      for (const message of messages) {
        if (message.method === method) {
          return message as T;
        }
      }
    }

    return null;
  }

  /**
   * Publishes a topic to the server.
   * @param params - The publication parameters.
   * @param force - Whether to force the publication.
   * @returns The announcement parameters.
   */
  async publish(params: PublishMessageParams, force?: boolean): Promise<AnnounceMessage> {
    // Send the message to the server
    const message: PublishMessage = {
      method: 'publish',
      params,
    };

    return new Promise((resolve, reject) => {
      // Check if the topic is already published
      if (this.publications.has(params.pubuid) && !force) reject(new Error('Topic is already published'));

      // Listen for the announcement
      const resolver = (msg: AnnounceMessage) => {
        this.socket.websocket.removeEventListener('message', wsHandler);
        // Add the topic to the list of published topics
        this.publications.set(params.pubuid, params);

        resolve(msg);
      };

      const wsHandler = (event: MessageEvent | WS_MessageEvent) => {
        const message = this.parseAndFilterMessage<AnnounceMessage>(event, 'announce');
        if (message && message.params.name === params.name) {
          resolver(message);
        }
      };

      this.socket.websocket.addEventListener('message', wsHandler);

      // Send the message to the server
      this._socket.sendTextFrame(message);

      // HOTFIX: Subscribe to the topic to get the announcement.
      // This is a bug in 2025.2.1 WPILib
      const subMsg: SubscribeMessageParams = {
        options: {
          topicsonly: true,
        },
        topics: [params.name],
        subuid: this.getNextSubUID(),
      };
      this.subscribe(subMsg);

      // Reject the promise if the topic is not announced within 3 seconds
      this.socket.waitForConnection().then(() => {
        setTimeout(() => {
          reject(new Error(`Topic ${params.name} was not announced within 3 seconds`));
        }, 3000);
      });
    });
  }

  /**
   * Unpublishes a topic from the server.
   * @param pubuid - The publication ID to unpublish.
   */
  unpublish(pubuid: number) {
    // Check if the topic is not published
    if (!this.publications.delete(pubuid)) return;

    // Send the message to the server
    const message: UnpublishMessage = {
      method: 'unpublish',
      params: {
        pubuid,
      },
    };

    this._socket.sendTextFrame(message);
  }

  /**
   * Subscribes to a topic.
   * @param params - The subscription parameters.
   * @param force - Whether to force the subscription.
   */
  subscribe(params: SubscribeMessageParams, force?: boolean) {
    if (this.subscriptions.has(params.subuid) && !force) return;

    this.subscriptions.set(params.subuid, params);

    // Create the message to send to the server
    const message: SubscribeMessage = {
      method: 'subscribe',
      params,
    };

    // Send the message to the server
    this._socket.sendTextFrame(message);
  }

  /**
   * Unsubscribes from a topic.
   * @param subuid - The subscription ID to unsubscribe from.
   */
  unsubscribe(subuid: number) {
    // Check if the topic is not subscribed
    if (!this.subscriptions.has(subuid)) return;

    // Remove the topic from the list of subscribed topics
    this.subscriptions.delete(subuid);

    // Send the message to the server
    const message: Message = {
      method: 'unsubscribe',
      params: {
        subuid,
      },
    };

    this._socket.sendTextFrame(message);
  }

  /**
   * Sets the properties of a topic.
   * @param params - The parameters to set
   * @returns The new properties of the topic.
   */
  async setProperties(params: SetPropertiesMessageParams): Promise<PropertiesMessage> {
    // Create the message to send to the server
    const message: SetPropertiesMessage = {
      method: 'setproperties',
      params,
    };

    return new Promise((resolve, reject) => {
      const resolver = (message: PropertiesMessage) => {
        this._socket.websocket.removeEventListener('message', wsHandler);
        clearInterval(responseCheck);
        resolve(message);
      };

      const wsHandler = (event: MessageEvent | WS_MessageEvent) => {
        const message = this.parseAndFilterMessage<PropertiesMessage>(event, 'announce');
        if (message?.params.ack) {
          resolver(message);
        }
      };

      this._socket.websocket.addEventListener('message', wsHandler);

      // Send the message to the server
      this._socket.sendTextFrame(message);

      // Reject the promise if the topic is not announced within 3 seconds

      const responseCheck = setInterval(() => {
        if (this.socket.isConnected()) {
          reject(new Error(`Topic ${params.name} was not announced within 3 seconds`));
        }
      }, 3000);
    });
  }

  /**
   * Send data to a topic.
   * This should only be called by the PubSubClient.
   * @param topic - The topic to update.
   * @param value - The value to update the topic to.
   * @returns The timestamp of the update, or -1 if the topic is not announced.
   */
  sendToTopic<T extends NetworkTablesTypes>(topic: NetworkTablesTopic<T>, value: T) {
    const typeInfo = topic.typeInfo;

    if (!topic.publisher || topic.pubuid == null) {
      throw new Error(`Topic ${topic.name} is not a publisher, so it cannot be updated`);
    }

    if (!topic.announced) {
      console.warn(`Topic ${topic.name} is not announced, but the new value will be queued`);
    }

    return this._socket.sendValueToTopic(topic.pubuid, value, typeInfo);
  }

  /**
   * Gets the next available publisher UID.
   * @returns The next available publisher UID.
   */
  getNextPubUID() {
    return this._currentPubUID++;
  }

  /**
   * Gets the next available subscriber UID.
   * @returns The next available subscriber UID.
   */
  getNextSubUID() {
    return this._currentSubUID++;
  }
}
