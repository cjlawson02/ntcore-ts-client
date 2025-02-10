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
        return existingTopic;
      } else {
        throw new Error(`Topic ${name} already exists, but with a different type.`);
      }
    }

    this.client.registerTopic(this);
  }

  /**
   * Sets the value of the topic.
   * The client must be the publisher of the topic to set the value.
   * @param value - The value to set.
   */
  setValue(value: T) {
    if (!this.publisher) {
      throw new Error('Cannot set value on topic without being the publisher');
    }
    this.value = value;
    this.notifySubscribers();
    this.client.updateServer<T>(this, value);
  }

  /**
   * Gets the value of the topic.
   * @returns The value of the topic.
   */
  getValue() {
    return this.value;
  }

  /**
   * Updates the value of the topic.
   * This should only be called by the PubSubClient.
   * @param value - The value to update.
   * @param lastChangedTime - The server time of the last value change.
   */
  updateValue(value: T, lastChangedTime: number) {
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
    if (params.pubuid === this._pubuid) {
      this._publisher = true;
    }
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

    return subuid;
  }

  resubscribeAll(client: PubSubClient) {
    this.client = client;
    this.subscribers.forEach((info, subuid) => {
      this.subscribe(info.callback, info.options, subuid, false);
    });
  }

  /**
   * Notifies all subscribers of the current value.
   */
  private notifySubscribers() {
    // We know that _announceParams is not null here because we received a value update
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.subscribers.forEach((info) => info.callback(this.value, this._announceParams!));
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
    if (this.publisher) return;

    this._pubuid = id ?? this.client.messenger.getNextPubUID();
    this._publishProperties = properties;

    const publishParams: PublishMessageParams = {
      type: this.typeInfo[1],
      name: this.name,
      pubuid: this._pubuid,
      properties,
    };

    return await this.client.messenger.publish(publishParams);
  }

  /**
   * Unpublishes the topic.
   */
  unpublish() {
    if (!this.publisher || this._pubuid === null) {
      throw new Error('Cannot unpublish topic without being the publisher');
    }

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
    if (!this.publisher || this._pubuid === null) {
      throw new Error('Cannot republish topic without being the publisher');
    }

    this._publisher = false;

    return await this.publish(this._publishProperties, this._pubuid);
  }
}
