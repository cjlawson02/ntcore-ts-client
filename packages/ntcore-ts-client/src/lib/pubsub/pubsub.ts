import { Messenger } from '../socket/messenger';

import type { NetworkTablesBaseTopic } from './base-topic';
import type { NetworkTablesPrefixTopic } from './prefix-topic';
import type { NetworkTablesTopic } from './topic';
import type {
  AnnounceMessageParams,
  BinaryMessageData,
  NetworkTablesTypes,
  PropertiesMessageParams,
  UnannounceMessageParams,
} from '../types/types';

/** The client for the PubSub protocol. */
export class PubSubClient {
  private readonly _messenger: Messenger;
  private readonly topics: Map<string, NetworkTablesTopic<any>>;
  private readonly prefixTopics: Map<string, NetworkTablesPrefixTopic>;
  // topic id -> topic params
  private readonly knownTopicParams: Map<number, AnnounceMessageParams>;
  private static _instances = new Map<string, PubSubClient>();
  private _currentPubUID = 0;
  private _currentSubUID = 0;

  get messenger() {
    return this._messenger;
  }

  private constructor(serverUrl: string) {
    this._messenger = Messenger.getInstance(
      serverUrl,
      this.onTopicUpdate,
      this.onTopicAnnounce,
      this.onTopicUnannounce,
      this.onTopicProperties
    );
    this.topics = new Map();
    this.prefixTopics = new Map();
    this.knownTopicParams = new Map();

    // In the DOM, auto-cleanup
    if (typeof window !== 'undefined') {
      window.onbeforeunload = () => {
        this.cleanup();
      };
    }
  }

  /**
   * Gets the instance of the NetworkTables client.
   * @param serverUrl - The URL of the server to connect to. This is not used after the first call.
   * @returns The instance of the NetworkTables client.
   */
  static getInstance(serverUrl: string): PubSubClient {
    let instance = this._instances.get(serverUrl);
    if (!instance) {
      instance = new PubSubClient(serverUrl);
      this._instances.set(serverUrl, instance);
    }

    return instance;
  }

  /**
   * Reinstantiates the client by resubscribing to all previously subscribed topics
   * and republishing for all previously published topics.
   * @param url - The URL of the server to connect to.
   */
  reinstantiate(url: string) {
    this._messenger.reinstantiate(url);
    this.topics.forEach((topic) => {
      topic.resubscribeAll(this);
      if (topic.publisher) topic.republish(this);
    });
    this.prefixTopics.forEach((prefixTopic) => {
      prefixTopic.resubscribeAll(this);
    });
  }

  /**
   * Registers a topic with this PubSubClient.
   * @param topic - The topic to register
   */
  registerTopic<T extends NetworkTablesTypes>(topic: NetworkTablesBaseTopic<T>) {
    if (topic.isRegular()) {
      if (this.topics.has(topic.name)) {
        throw new Error(`Topic ${topic.name} already exists. Cannot register a topic with the same name.`);
      }
      this.topics.set(topic.name, topic);
    } else if (topic.isPrefix()) {
      if (this.prefixTopics.has(topic.name)) {
        throw new Error(`Prefix topic ${topic.name} already exists. Cannot register a topic with the same name.`);
      }
      this.prefixTopics.set(topic.name, topic);
    }
  }

  /**
   * Called by the messenger when a topic is updated.
   * @param message - The message data.
   */
  private onTopicUpdate = (message: BinaryMessageData) => {
    const topic = this.getTopicFromId(message.topicId);
    if (topic) {
      topic.updateValue(message.value, message.serverTime);
    }

    const knownTopic = this.getKnownTopicParams(message.topicId);

    if (knownTopic) {
      this.prefixTopics.forEach((prefixTopic) => {
        if (knownTopic.name.startsWith(prefixTopic.name)) {
          prefixTopic.updateValue(knownTopic, message.value, message.serverTime);
        }
      });
    }

    if (!topic && !knownTopic) {
      console.warn(`Received update for unknown topic with ID ${message.topicId}`);
    }
  };

  /**
   * Called by the messenger when a topic is announced.
   * @param params - The announce message parameters.
   */
  private onTopicAnnounce = (params: AnnounceMessageParams) => {
    this.knownTopicParams.set(params.id, params);

    // Announce to the topic
    const topic = this.topics.get(params.name);
    topic?.announce(params);

    // Find all prefix topics that match the announced topic
    this.prefixTopics.forEach((prefixTopic) => {
      if (params.name.startsWith(prefixTopic.name)) {
        prefixTopic.announce(params);
      }
    });
  };

  /**
   * Called by the messenger when a topic is unannounced.
   * @param params - The unannounce message parameters.
   */
  private onTopicUnannounce = (params: UnannounceMessageParams) => {
    const topic = this.topics.get(params.name);
    if (!topic) {
      console.warn(`Topic ${params.name} was unannounced, but does not exist`);
      return;
    }
    topic.unannounce();
  };

  /**
   * Called by the messenger when a topic's properties are updated.
   * @param params - The properties message parameters.
   */
  private onTopicProperties = (params: PropertiesMessageParams) => {
    const topic = this.topics.get(params.name);
    if (params.ack) {
      if (!topic) {
        console.warn(`Topic ${params.name} properties were updated, but does not exist`);
        return;
      }
    }
  };

  /**
   * Updates the value of a topic on the server.
   * @param topic - The topic to update.
   * @param value - The new value of the topic.
   */
  updateServer<T extends NetworkTablesTypes>(topic: NetworkTablesTopic<T>, value: T) {
    this._messenger.sendToTopic(topic, value);
  }

  /**
   * Gets the topic with the given ID.
   * @param topicId - The ID of the topic to get.
   * @returns The topic with the given ID, or null if no topic with that ID exists.
   */
  private getTopicFromId<T extends NetworkTablesTypes>(topicId: number): NetworkTablesTopic<T> | null {
    for (const topic of this.topics.values()) {
      if (topic.id === topicId) {
        return topic;
      }
    }

    return null;
  }

  /**
   * Gets the topic with the given name.
   * @param topicName - The name of the topic to get.
   * @returns The topic with the given name, or null if no topic with that name exists.
   */
  getTopicFromName(topicName: string) {
    return this.topics.get(topicName) ?? null;
  }

  /**
   * Gets the topic with the given name.
   * @param topicName - The name of the topic to get.
   * @returns The topic with the given name, or null if no topic with that name exists.
   */
  getPrefixTopicFromName(topicName: string) {
    return this.prefixTopics.get(topicName) ?? null;
  }

  /**
   * Gets the known announcement parameters for a topic.
   * @param id - The ID of the topic.
   * @returns The known announcement parameters for the topic, or undefined if the topic is not known.
   */
  getKnownTopicParams(id: number) {
    return this.knownTopicParams.get(id);
  }

  /**
   * Cleans up the client by unsubscribing from all topics and stopping publishing for all topics.
   */
  cleanup() {
    this.topics.forEach((topic) => {
      topic.unsubscribeAll();
      if (topic.publisher) topic.unpublish();
    });
    this.prefixTopics.forEach((prefixTopic) => {
      prefixTopic.unsubscribeAll();
    });
    this._messenger.socket.close();
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
