import { pubsubLogger } from '../util/logger';

import { NetworkTablesBaseTopic } from './base-topic';

import type { CallbackFn } from './base-topic';
import type { PubSubClient } from './pubsub';
import type {
  AnnounceMessage,
  AnnounceMessageParams,
  NetworkTablesTypeInfo,
  NetworkTablesTypes,
  PublishMessageParams,
  SubscribeMessageParams,
  SubscribeOptions,
  TopicProperties,
} from '../types/types';

export class NetworkTablesTopic<T extends NetworkTablesTypes> extends NetworkTablesBaseTopic<T> {
  readonly type = 'regular';
  private value: T | null;
  private readonly _typeInfo: NetworkTablesTypeInfo;
  private _publisher: boolean;
  private _pubuid?: number;
  private _publishProperties?: TopicProperties;

  /**
   * Gets the type info for the topic.
   * @returns The type info for the topic.
   */
  get typeInfo(): NetworkTablesTypeInfo {
    return this._typeInfo;
  }

  /**
   * Gets whether the client is the publisher of the topic.
   * @returns Whether the client is the publisher of the topic.
   */
  get publisher() {
    return this._publisher;
  }

  /**
   * Gets the UID of the publisher.
   * @returns The UID of the publisher, or undefined if the client is not the publisher.
   */
  get pubuid() {
    return this._pubuid;
  }

  /**
   * Creates a new topic. This should only be done after the
   * base NTCore client has been initialized.
   * @param client - The client that owns the topic.
   * @param name - The name of the topic.
   * @param typeInfo - The type info for the topic.
   * @param defaultValue - The default value for the topic.
   */
  constructor(client: PubSubClient, name: string, typeInfo: NetworkTablesTypeInfo, defaultValue?: T) {
    super(client, name);
    this._typeInfo = typeInfo;
    this.value = defaultValue ?? null;
    this._publisher = false;

    const existingTopic = this.client.getTopicFromName(name);
    if (existingTopic) {
      if (existingTopic.typeInfo[0] === typeInfo[0] && existingTopic.typeInfo[1] === typeInfo[1]) {
        pubsubLogger.info('Existing topic reused', { topicName: name, type: typeInfo[1] });
        // This is a valid cast because we have checked via typeInfo that the topic is of type T
        return existingTopic as unknown as NetworkTablesTopic<T>;
      } else {
        pubsubLogger.debug('Type mismatch detected', {
          topicName: name,
          existingType: existingTopic.typeInfo[1],
          requestedType: typeInfo[1],
        });
        throw new Error(`Topic ${name} already exists, but with a different type.`);
      }
    }

    pubsubLogger.debug('Topic created', { topicName: name, type: typeInfo[1] });
    this.client.registerTopic(this);
  }

  /**
   * Sets the value of the topic.
   * The client must be the publisher of the topic to set the value.
   * @param value - The value to set.
   */
  setValue(value: T) {
    if (!this.publisher) {
      pubsubLogger.debug('Publisher check failed before setValue', { topicName: this.name });
      throw new Error('Cannot set value on topic without being the publisher');
    }
    const oldValue = this.value;
    pubsubLogger.debug('Value set', { topicName: this.name, oldValue, newValue: value, type: this._typeInfo[1] });
    this.value = value;
    this.notifySubscribers();
    this.client.updateServer<T>(this, value);
  }

  /**
   * Gets the value of the topic.
   * @returns The value of the topic.
   */
  getValue() {
    pubsubLogger.debug('Value retrieved', { topicName: this.name, value: this.value });
    return this.value;
  }

  /**
   * Updates the value of the topic.
   * This should only be called by the PubSubClient.
   * @param value - The value to update.
   * @param lastChangedTime - The server time of the last value change.
   */
  updateValue(value: T, lastChangedTime: number) {
    const oldValue = this.value;
    pubsubLogger.debug('Value updated', {
      topicName: this.name,
      oldValue,
      newValue: value,
      lastChangedTime,
      type: this._typeInfo[1],
    });
    this.value = value;
    this._lastChangedTime = lastChangedTime;
    this.notifySubscribers();
  }

  /** */
  /* ANNOUNCEMENTS */
  /** */

  /**
   * Marks the topic as announced. This should only be called by the PubSubClient.
   * @param params - The parameters of the announcement.
   */
  override announce(params: AnnounceMessageParams) {
    super.announce(params);
    const wasPublisher = this._publisher;
    if (params.pubuid === this._pubuid) {
      this._publisher = true;
      pubsubLogger.debug('Publisher status updated', {
        topicName: this.name,
        pubuid: this._pubuid,
        wasPublisher,
        isPublisher: true,
      });
    }
    pubsubLogger.debug('Topic announced', { topicName: this.name, topicId: params.id, pubuid: params.pubuid });
  }

  /** */
  /* SUBSCRIBING */
  /** */

  /**
   * Creates a new subscriber.
   * @param callback - The callback to call when the topic value changes.
   * @param options - The options for the subscriber.
   * @param id - The UID of the subscriber. You must verify that the ID is not already in use.
   * @param save - Whether to save the subscriber.
   * @returns The UID of the subscriber.
   */
  subscribe(callback: CallbackFn<T>, options: Omit<SubscribeOptions, 'prefix'> = {}, id?: number, save = true) {
    const subuid = id || this.client.messenger.getNextSubUID();

    const subscribeParams: SubscribeMessageParams = {
      topics: [this.name],
      subuid,
      options,
    };
    this.client.messenger.subscribe(subscribeParams);

    if (save) this.subscribers.set(subuid, { callback, options });
    pubsubLogger.debug('Subscriber added', {
      topicName: this.name,
      subuid,
      options,
      totalSubscribers: this.subscribers.size,
    });

    return subuid;
  }

  resubscribeAll(client: PubSubClient) {
    const subscriberCount = this.subscribers.size;
    pubsubLogger.debug('Resubscribe all', { topicName: this.name, subscriberCount });
    this.client = client;
    this.subscribers.forEach((info, subuid) => {
      this.subscribe(info.callback, info.options, subuid, false);
    });
  }

  /**
   * Notifies all subscribers of the current value.
   */
  private notifySubscribers() {
    const subscriberCount = this.subscribers.size;
    pubsubLogger.debug('Subscribers notified', { topicName: this.name, count: subscriberCount });
    // We know that _announceParams is not null here because we received a value update
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.subscribers.forEach((info, subuid) => {
      pubsubLogger.trace('Callback invoked', {
        topicName: this.name,
        subuid,
        value: this.value,
        params: this._announceParams!,
      });
      info.callback(this.value, this._announceParams!);
    });
  }

  /** */
  /* PUBLISHING */
  /** */

  /**
   * Publishes the topic.
   * @param properties - The properties to publish the topic with.
   * @param id - The UID of the publisher. You must verify that the ID is not already in use.
   * @returns A promise that resolves when the topic is published.
   */
  async publish(properties: TopicProperties = {}, id?: number): Promise<AnnounceMessage | void> {
    // Use unified in-flight protection from PubSubClient
    // Key format: "publish:" prefix to avoid conflicts with schema registrations
    const operationKey = `publish:${this.name}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      // Check if already publisher inside the in-flight operation to prevent race conditions
      if (this.publisher) {
        pubsubLogger.debug('Publish skipped', { topicName: this.name, reason: 'already publisher' });
        return;
      }

      this._pubuid = id ?? this.client.messenger.getNextPubUID();
      this._publishProperties = properties;
      pubsubLogger.debug('Topic published', { topicName: this.name, pubuid: this._pubuid, properties });

      const publishParams: PublishMessageParams = {
        type: this.typeInfo[1],
        name: this.name,
        pubuid: this._pubuid,
        properties,
      };

      return await this.client.messenger.publish(publishParams);
    });
  }

  /**
   * Unpublishes the topic.
   */
  unpublish() {
    if (!this.publisher || this._pubuid == null) {
      pubsubLogger.debug('Publisher check failed before unpublish', {
        topicName: this.name,
        publisher: this.publisher,
        pubuid: this._pubuid,
      });
      throw new Error('Cannot unpublish topic without being the publisher');
    }

    pubsubLogger.debug('Topic unpublished', { topicName: this.name, pubuid: this._pubuid });
    this.client.messenger.unpublish(this._pubuid);

    this._publisher = false;
    this._pubuid = undefined;
  }

  /**
   * Republishes the topic.
   * @param client - The client to republish with.
   * @returns A promise that resolves when the topic is republished.
   */
  async republish(client: PubSubClient) {
    this.client = client;
    if (!this.publisher || this._pubuid == null) {
      throw new Error('Cannot republish topic without being the publisher');
    }

    pubsubLogger.debug('Topic republished', { topicName: this.name, pubuid: this._pubuid });
    this._publisher = false;

    return await this.publish(this._publishProperties, this._pubuid);
  }
}
