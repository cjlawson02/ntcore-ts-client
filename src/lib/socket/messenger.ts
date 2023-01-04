import {
  Message,
  PublishMessage,
  PublishMessageParams,
  SetPropertiesMessage,
  SetPropertiesMessageParams,
  SubscribeMessage,
  SubscribeMessageParams,
  UnpublishMessage,
  NetworkTableTypes,
  BinaryMessageData,
  AnnounceMessageParams,
  UnannounceMessageParams,
} from '../types/types';
import { NetworkTablesSocket } from './socket';
import { Topic } from '../pubsub/topic';

/** NetworkTables client. */
export default class Messenger {
  private readonly _socket: NetworkTablesSocket;
  private readonly publications = new Map<number, PublishMessageParams>();
  private readonly subscriptions = new Map<number, SubscribeMessageParams>();
  private readonly pendingMessages = new Map<string, NetworkTableTypes>();
  private serverUrl: string;
  private static _instance: Messenger;

  public get socket() {
    return this._socket;
  }

  /**
   * Creates a new NetworkTables client.
   * @param serverUrl The URL of the server to connect to.
   */
  private constructor(
    serverUrl: string,
    onTopicUpdate: (message: BinaryMessageData) => void,
    onAnnounce: (params: AnnounceMessageParams) => void,
    onUnannounce: (params: UnannounceMessageParams) => void
  ) {
    this.serverUrl = serverUrl;
    this._socket = NetworkTablesSocket.getInstance(
      serverUrl,
      this.onSocketOpen,
      this.onSocketClose,
      onTopicUpdate,
      onAnnounce,
      onUnannounce
    );
  }

  /**
   * Gets the instance of the NetworkTables client.
   * @param serverUrl The URL of the server to connect to. This is not needed after the first call.
   * @returns The instance of the NetworkTables client.
   */
  public static getInstance(
    serverUrl: string,
    onTopicUpdate: (message: BinaryMessageData) => void,
    onAnnounce: (params: AnnounceMessageParams) => void,
    onUnannounce: (params: UnannounceMessageParams) => void
  ): Messenger {
    if (!this._instance) {
      this._instance = new this(
        serverUrl,
        onTopicUpdate,
        onAnnounce,
        onUnannounce
      );
    }

    return Messenger._instance;
  }

  public reinstantiate(serverUrl: string) {
    this.serverUrl = serverUrl;
    this._socket.stopAutoConnect();
    this._socket.reinstantiate(serverUrl);
    this._socket.startAutoConnect();
  }

  public getPublications() {
    return this.publications.entries();
  }

  public getSubscriptions() {
    return this.subscriptions.entries();
  }

  /**
   *  Called when the socket opens.
   */
  public onSocketOpen = () => {
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
  public onSocketClose = () => {};

  /**
   * Publishes a topic to the server.
   * @param topic The topic to publish.
   */
  public publish(params: PublishMessageParams, force?: boolean) {
    // Check if the topic is already published
    if (this.publications.has(params.pubuid) && !force) return;

    // Add the topic to the list of published topics
    this.publications.set(params.pubuid, params);

    // Send the message to the server
    const message: PublishMessage = {
      method: 'publish',
      params,
    };

    console.log('publishing', message);

    this._socket.sendTextFrame(message);
  }

  /**
   * Unpublishes a topic from the server.
   * @param pubuid The publication ID to unpublish
   */
  public unpublish(pubuid: number) {
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
   * @param params The subscription parameters
   */
  public subscribe(params: SubscribeMessageParams, force?: boolean) {
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
   * @param subuid The subscription ID to unsubscribe from
   */
  public unsubscribe(subuid: number) {
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
   * @param params The parameters to set
   */
  public setProperties(params: SetPropertiesMessageParams) {
    // Create the message to send to the server
    const message: SetPropertiesMessage = {
      method: 'setproperties',
      params,
    };

    // Send the message to the server
    this._socket.sendTextFrame(message);
  }

  /**
   * Send data to a topic.
   * This should only be called by the PubSubClient.
   *
   * @param topic The topic to update.
   * @param value The value to update the topic to.
   * @returns The timestamp of the update, or -1 if the topic is not announced.
   */
  public sendToTopic<T extends NetworkTableTypes>(topic: Topic<T>, value: T) {
    const typeInfo = topic.typeInfo;

    if (!topic.publisher || !topic.pubuid) {
      throw new Error(
        `Topic ${topic.name} is not a publisher, so it cannot be updated`
      );
    }

    if (topic.announced) {
      return this._socket.sendValueToTopic(topic.pubuid, value, typeInfo);
    } else {
      // TODO: is this needed?
      console.log(
        `Topic ${topic.name} is not announced, so it cannot be updated`
      );
      this.pendingMessages.set(topic.name, value);
      return -1;
    }
  }
}
