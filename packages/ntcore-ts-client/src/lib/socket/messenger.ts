import { messageSchema } from '../types/schemas';
import { messengerLogger } from '../util/logger';

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
    messengerLogger.info('Reinstantiating messenger', {
      newUrl: serverUrl,
      subscriptionCount: this.subscriptions.size,
      publicationCount: this.publications.size,
    });
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
    const subscriptionCount = this.subscriptions.size;
    const publicationCount = this.publications.size;
    messengerLogger.debug('Subscribing all topics', { count: subscriptionCount });
    // Send all subscriptions
    this.subscriptions.forEach((params) => {
      this.subscribe(params, true);
    });

    messengerLogger.debug('Publishing all topics', { count: publicationCount });
    // Re-send publish frames best-effort on reconnect.
    // Do not await announcements here (fire-and-forget) to avoid timers/rejections
    // outliving the reconnect event.
    this.publications.forEach((params) => {
      this.sendPublishFrames(params);
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
  ): T[] {
    if (typeof event.data === 'string') {
      messengerLogger.trace('Raw message received', { data: event.data });
      const messageData = JSON.parse(event.data);
      messengerLogger.trace('Message parsed from JSON', {
        messageCount: Array.isArray(messageData) ? messageData.length : 1,
      });
      const messages = messageSchema.parse(messageData);
      messengerLogger.trace('Message schema validated', { messageCount: messages.length });
      const filtered = messages.filter((msg) => msg.method === method) as T[];
      messengerLogger.trace('Message filtered by method', {
        method,
        inputCount: messages.length,
        outputCount: filtered.length,
      });
      return filtered;
    }

    return [];
  }

  /**
   * Publishes a topic to the server.
   * @param params - The publication parameters.
   * @param force - Whether to force the publication.
   * @returns The announcement parameters.
   */
  async publish(params: PublishMessageParams, force?: boolean): Promise<AnnounceMessage> {
    return new Promise((resolve, reject) => {
      // Check if the topic is already published
      if (this.publications.has(params.pubuid) && !force) {
        messengerLogger.debug('Publish rejected', {
          topicName: params.name,
          pubuid: params.pubuid,
          reason: 'already published',
        });
        reject(new Error('Topic is already published'));
        return;
      }

      messengerLogger.debug('Publish request initiated', {
        topicName: params.name,
        pubuid: params.pubuid,
        timeout: 3000,
        force,
      });

      let timeoutId: NodeJS.Timeout | null = null;

      // Cleanup function to remove listener and clear timeout
      const cleanup = () => {
        messengerLogger.trace('Cleanup: removing event listener and clearing timeout', { topicName: params.name });
        this.socket.websocket.removeEventListener('message', wsHandler);
        if (timeoutId) {
          clearTimeout(timeoutId);
          messengerLogger.trace('Timeout cleared', { topicName: params.name });
        }
      };

      // Listen for the announcement
      const resolver = (msg: AnnounceMessage) => {
        messengerLogger.trace('Promise resolver called', { topicName: params.name, pubuid: params.pubuid });
        cleanup();
        // Add the topic to the list of published topics
        this.publications.set(params.pubuid, params);
        messengerLogger.debug('Topic published', { topicName: params.name, pubuid: params.pubuid });

        resolve(msg);
      };

      // Rejector function to cleanup before rejecting
      const rejector = (error: Error) => {
        messengerLogger.trace('Promise rejector called', { topicName: params.name, error: error.message });
        cleanup();
        reject(error);
      };

      const wsHandler = (event: MessageEvent | WS_MessageEvent) => {
        const messages = this.parseAndFilterMessage<AnnounceMessage>(event, 'announce');
        messengerLogger.debug('Messages filtered for announce', { count: messages.length });
        for (const message of messages) {
          if (message.params.name === params.name && message.params.pubuid === params.pubuid) {
            messengerLogger.debug('Announcement received', {
              topicName: message.params.name,
              pubuid: message.params.pubuid,
              matched: true,
            });
            resolver(message);
            break;
          }
        }
      };

      messengerLogger.trace('Event listener attached', { topicName: params.name });
      this.socket.websocket.addEventListener('message', wsHandler);

      this.sendPublishFrames(params);

      // Reject the promise if the topic is not announced within 3 seconds
      this.socket
        .waitForConnection()
        .then(() => {
          timeoutId = setTimeout(() => {
            rejector(new Error(`Topic ${params.name} was not announced within 3 seconds`));
          }, 3000);
        })
        .catch((error) => {
          rejector(error);
        });
    });
  }

  private sendPublishFrames(params: PublishMessageParams) {
    // Send publish frame
    const message: PublishMessage = {
      method: 'publish',
      params,
    };
    this._socket.sendTextFrame(message);

    // HOTFIX: Subscribe to the topic to get the announcement.
    // This is a bug in 2025.2.1 WPILib
    //
    // IMPORTANT: This is intentionally NOT stored in `this.subscriptions`.
    // It is internal, best-effort, and should not pollute public subscription state.
    const subMsg: SubscribeMessage = {
      method: 'subscribe',
      params: {
        options: {
          topicsonly: true,
        },
        topics: [params.name],
        subuid: this.getNextSubUID(),
      },
    };
    this._socket.sendTextFrame(subMsg);
  }

  /**
   * Unpublishes a topic from the server.
   * @param pubuid - The publication ID to unpublish.
   */
  unpublish(pubuid: number) {
    // Check if the topic is not published
    const params = this.publications.get(pubuid);
    if (!this.publications.delete(pubuid)) return;

    messengerLogger.debug('Topic unpublished', { pubuid, topicName: params?.name });
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
    if (this.subscriptions.has(params.subuid) && !force) {
      messengerLogger.debug('Subscription skipped', { subuid: params.subuid, reason: 'already exists' });
      return;
    }

    if (force) {
      messengerLogger.debug('Force subscribe', { subuid: params.subuid, topicNames: params.topics });
    }

    this.subscriptions.set(params.subuid, params);
    messengerLogger.debug('Subscription created', {
      subuid: params.subuid,
      topicNames: params.topics,
      prefix: params.options?.prefix || false,
    });

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
    const params = this.subscriptions.get(subuid);
    if (!this.subscriptions.has(subuid)) return;

    // Remove the topic from the list of subscribed topics
    this.subscriptions.delete(subuid);
    messengerLogger.debug('Unsubscribed from topic', { subuid, topicNames: params?.topics });

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
    messengerLogger.debug('Properties update initiated', { topicName: params.name, update: params.update });
    // Create the message to send to the server
    const message: SetPropertiesMessage = {
      method: 'setproperties',
      params,
    };

    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      // Cleanup function to remove listener and clear timeout
      const cleanup = () => {
        messengerLogger.trace('Cleanup: removing event listener and clearing timeout', { topicName: params.name });
        this._socket.websocket.removeEventListener('message', wsHandler);
        if (timeoutId) {
          clearTimeout(timeoutId);
          messengerLogger.trace('Timeout cleared', { topicName: params.name });
        }
        messengerLogger.debug('Cleanup performed', { topicName: params.name });
      };

      const resolver = (message: PropertiesMessage) => {
        messengerLogger.trace('Promise resolver called', { topicName: params.name });
        cleanup();
        messengerLogger.debug('Properties ack received', { topicName: params.name, ack: message.params.ack });
        resolve(message);
      };

      // Rejector function to cleanup before rejecting
      const rejector = (error: Error) => {
        messengerLogger.trace('Promise rejector called', { topicName: params.name, error: error.message });
        cleanup();
        reject(error);
      };

      const wsHandler = (event: MessageEvent | WS_MessageEvent) => {
        const messages = this.parseAndFilterMessage<PropertiesMessage>(event, 'properties');
        messengerLogger.debug('Messages filtered for properties', { count: messages.length });
        for (const message of messages) {
          if (message.params.name === params.name && message.params.ack) {
            messengerLogger.debug('Properties message matched', { topicName: params.name, ack: message.params.ack });
            resolver(message);
            break;
          }
        }
      };

      this._socket.websocket.addEventListener('message', wsHandler);

      // Send the message to the server
      this._socket.sendTextFrame(message);

      // Reject the promise if an ACK is not received within 3 seconds
      this.socket
        .waitForConnection()
        .then(() => {
          timeoutId = setTimeout(() => {
            rejector(new Error(`Properties for topic ${params.name} were not acknowledged within 3 seconds`));
          }, 3000);
        })
        .catch((error) => {
          rejector(error);
        });
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

    if (topic.id == null) {
      messengerLogger.debug('Topic is not announced; skipping server update', { topicName: topic.name });
      return -1;
    }

    return this._socket.sendValueToTopic(topic.id, value, typeInfo);
  }

  /**
   * Gets the next available publisher UID.
   * @returns The next available publisher UID.
   */
  getNextPubUID() {
    const pubuid = this._currentPubUID++;
    messengerLogger.debug('Next PubUID generated', { pubuid });
    return pubuid;
  }

  /**
   * Gets the next available subscriber UID.
   * @returns The next available subscriber UID.
   */
  getNextSubUID() {
    const subuid = this._currentSubUID++;
    messengerLogger.debug('Next SubUID generated', { subuid });
    return subuid;
  }
}
