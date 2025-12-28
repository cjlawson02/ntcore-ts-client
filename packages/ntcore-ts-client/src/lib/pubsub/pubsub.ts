import { Messenger } from '../socket/messenger';
import {
  NetworkTablesTypeInfos,
  type AnnounceMessageParams,
  type BinaryMessageData,
  type NetworkTablesTypes,
  type PropertiesMessageParams,
  type UnannounceMessageParams,
} from '../types/types';
import { pubsubLogger } from '../util/logger';

import type { NetworkTablesBaseTopic } from './base-topic';
import type { NetworkTablesPrefixTopic } from './prefix-topic';
import type { NetworkTablesTopic } from './topic';

/** The client for the PubSub protocol. */
export class PubSubClient {
  private readonly _messenger: Messenger;
  private readonly topics: Map<string, NetworkTablesTopic<NetworkTablesTypes>>;
  private readonly prefixTopics: Map<string, NetworkTablesPrefixTopic>;
  // topic id -> topic params
  private readonly knownTopicParams: Map<number, AnnounceMessageParams>;
  private static _instances = new Map<string, PubSubClient>();

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
    pubsubLogger.info('Client reinstantiated', {
      newUrl: url,
      topicCount: this.topics.size,
      prefixTopicCount: this.prefixTopics.size,
    });
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
        pubsubLogger.debug('Topic already exists check', { topicName: topic.name, exists: true });
        throw new Error(`Topic ${topic.name} already exists. Cannot register a topic with the same name.`);
      }
      pubsubLogger.debug('Topic already exists check', { topicName: topic.name, exists: false });
      this.topics.set(topic.name, topic);
      pubsubLogger.debug('Topic registered', { topicName: topic.name, type: 'regular' });
    } else if (topic.isPrefix()) {
      if (this.prefixTopics.has(topic.name)) {
        pubsubLogger.debug('Prefix topic already exists check', { prefix: topic.name, exists: true });
        throw new Error(`Prefix topic ${topic.name} already exists. Cannot register a topic with the same name.`);
      }
      pubsubLogger.debug('Prefix topic already exists check', { prefix: topic.name, exists: false });
      this.prefixTopics.set(topic.name, topic);
      pubsubLogger.debug('Prefix topic registered', { prefix: topic.name });
    }
  }

  /**
   * Called by the messenger when a topic is updated.
   * @param message - The message data.
   */
  private onTopicUpdate = (message: BinaryMessageData) => {
    pubsubLogger.debug('Value update received', {
      topicId: message.topicId,
      typeNum: message.typeNum,
      serverTime: message.serverTime,
    });
    const topic = this.getTopicFromId(message.topicId);
    if (topic) {
      pubsubLogger.trace('Raw value received', {
        topicId: message.topicId,
        value: message.value,
        typeNum: message.typeNum,
      });
      let validatedData: NetworkTablesTypes;
      try {
        validatedData = NetworkTablesTypeInfos.validateData(topic.typeInfo, message.value);
        pubsubLogger.debug('Value validated successfully', { topicName: topic.name, topicId: message.topicId });
        pubsubLogger.trace('Type validation details', {
          topicName: topic.name,
          expectedType: topic.typeInfo[1],
          receivedTypeNum: message.typeNum,
          validated: true,
        });
      } catch (e) {
        pubsubLogger.trace('Type validation failed', {
          topicName: topic.name,
          expectedType: topic.typeInfo[1],
          receivedTypeNum: message.typeNum,
          error: String(e),
        });
        throw new Error(`Invalid data for topic ${topic.name}: ${e}`);
      }
      pubsubLogger.debug('Value update applied to topic', { topicName: topic.name, topicId: message.topicId });
      topic.updateValue(validatedData, message.serverTime);
    }

    const knownTopic = this.getKnownTopicParams(message.topicId);

    if (knownTopic) {
      let matchedPrefixCount = 0;
      this.prefixTopics.forEach((prefixTopic) => {
        if (knownTopic.name.startsWith(prefixTopic.name)) {
          matchedPrefixCount++;
          pubsubLogger.debug('Prefix topic matched', { topicName: knownTopic.name, prefix: prefixTopic.name });
          prefixTopic.updateValue(knownTopic, message.value, message.serverTime);
        }
      });
      if (matchedPrefixCount > 0) {
        pubsubLogger.debug('Value update applied to prefix topics', {
          topicName: knownTopic.name,
          count: matchedPrefixCount,
        });
      }
    }

    if (!topic && !knownTopic) {
      pubsubLogger.debug('Received update for unknown topic', { topicId: message.topicId });
    }
  };

  /**
   * Called by the messenger when a topic is announced.
   * @param params - The announce message parameters.
   */
  private onTopicAnnounce = (params: AnnounceMessageParams) => {
    pubsubLogger.trace('Map operation: knownTopicParams.set', {
      topicId: params.id,
      topicName: params.name,
      mapSizeBefore: this.knownTopicParams.size,
    });
    this.knownTopicParams.set(params.id, params);
    pubsubLogger.trace('Map operation: knownTopicParams.set complete', { mapSizeAfter: this.knownTopicParams.size });
    pubsubLogger.debug('Topic announced', { topicName: params.name, topicId: params.id, type: params.type });

    // Announce to the topic
    const topic = this.topics.get(params.name);
    topic?.announce(params);

    // Find all prefix topics that match the announced topic
    let matchedPrefixCount = 0;
    this.prefixTopics.forEach((prefixTopic) => {
      if (params.name.startsWith(prefixTopic.name)) {
        matchedPrefixCount++;
        pubsubLogger.debug('Prefix topic matched', { topicName: params.name, prefix: prefixTopic.name });
        prefixTopic.announce(params);
      }
    });
    if (this.prefixTopics.size > 0) {
      pubsubLogger.debug('Prefix topics checked', {
        totalPrefixTopics: this.prefixTopics.size,
        matchedCount: matchedPrefixCount,
      });
    }
  };

  /**
   * Called by the messenger when a topic is unannounced.
   * @param params - The unannounce message parameters.
   */
  private onTopicUnannounce = (params: UnannounceMessageParams) => {
    const topic = this.topics.get(params.name);
    if (!topic) {
      pubsubLogger.debug('Topic was unannounced but does not exist', { topicName: params.name });
      // Still clean up knownTopicParams even if topic doesn't exist locally
      pubsubLogger.trace('Map operation: knownTopicParams.delete', {
        topicId: params.id,
        mapSizeBefore: this.knownTopicParams.size,
      });
      this.knownTopicParams.delete(params.id);
      pubsubLogger.trace('Map operation: knownTopicParams.delete complete', {
        mapSizeAfter: this.knownTopicParams.size,
      });
      return;
    }
    pubsubLogger.debug('Topic unannounced', { topicName: params.name, topicId: topic.id });
    topic.unannounce();
    // Clean up knownTopicParams when topic is unannounced
    pubsubLogger.trace('Map operation: knownTopicParams.delete', {
      topicId: params.id,
      mapSizeBefore: this.knownTopicParams.size,
    });
    this.knownTopicParams.delete(params.id);
    pubsubLogger.trace('Map operation: knownTopicParams.delete complete', { mapSizeAfter: this.knownTopicParams.size });
  };

  /**
   * Called by the messenger when a topic's properties are updated.
   * @param params - The properties message parameters.
   */
  private onTopicProperties = (params: PropertiesMessageParams) => {
    const topic = this.topics.get(params.name);
    if (params.ack) {
      if (!topic) {
        pubsubLogger.debug('Topic properties updated but does not exist', { topicName: params.name });
        return;
      }
      pubsubLogger.debug('Topic properties updated', { topicName: params.name, ack: params.ack });
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
  private getTopicFromId(topicId: number): NetworkTablesTopic<NetworkTablesTypes> | null {
    for (const topic of this.topics.values()) {
      if (topic.id === topicId) {
        pubsubLogger.debug('Topic found by ID', { topicId, topicName: topic.name });
        return topic;
      }
    }

    pubsubLogger.debug('Topic not found by ID', { topicId });
    return null;
  }

  /**
   * Gets the topic with the given name.
   * @param topicName - The name of the topic to get.
   * @returns The topic with the given name, or null if no topic with that name exists.
   */
  getTopicFromName(topicName: string) {
    const topic = this.topics.get(topicName) ?? null;
    if (topic) {
      pubsubLogger.debug('Topic found by name', { topicName });
    } else {
      pubsubLogger.debug('Topic not found by name', { topicName });
    }
    return topic;
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
    const params = this.knownTopicParams.get(id);
    if (params) {
      pubsubLogger.debug('Known topic params retrieved', { topicId: id, topicName: params.name });
    } else {
      pubsubLogger.debug('Known topic params not found', { topicId: id });
    }
    return params;
  }

  /**
   * Cleans up the client by unsubscribing from all topics and stopping publishing for all topics.
   */
  cleanup() {
    pubsubLogger.debug('Topic cleanup initiated', {
      topicCount: this.topics.size,
      prefixTopicCount: this.prefixTopics.size,
    });
    this.topics.forEach((topic) => {
      topic.unsubscribeAll();
      if (topic.publisher) topic.unpublish();
    });
    this.prefixTopics.forEach((prefixTopic) => {
      prefixTopic.unsubscribeAll();
    });
    this._messenger.socket.close();
  }
}
