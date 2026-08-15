import { pubsubLogger } from '../util/logger';

import type { NetworkTablesPrefixTopic } from './prefix-topic';
import type { PubSubClient } from './pubsub';
import type { NetworkTablesTopic } from './topic';
import type {
  AnnounceMessageParams,
  NetworkTablesTypes,
  PropertiesMessage,
  SetPropertiesMessageParams,
  SubscribeOptions,
  TopicProperties,
} from '../types/types';

export type CallbackFn<T> = (value: T | null, params: AnnounceMessageParams) => void;

export abstract class NetworkTablesBaseTopic<T> {
  protected abstract readonly type: 'regular' | 'prefix';
  protected client: PubSubClient;
  private _id?: number;
  private readonly _name: string;
  protected _lastChangedTime?: number;
  protected _announceParams: AnnounceMessageParams | null;
  private _subscribers: Map<
    number,
    {
      callback: CallbackFn<T>;
      options: SubscribeOptions;
    }
  >;

  isRegular(): this is NetworkTablesTopic<NetworkTablesTypes> {
    return this.type === 'regular';
  }

  isPrefix(): this is NetworkTablesPrefixTopic {
    return this.type === 'prefix';
  }

  /**
   * Gets the ID of the topic.
   * @returns The ID of the topic.
   */
  get id() {
    return this._id;
  }

  /**
   * Gets the name of the topic.
   * @returns The name of the topic.
   */
  get name() {
    return this._name;
  }

  /**
   * Gets the server time of the last value change.
   * @returns The server time of the last value change.
   */
  get lastChangedTime() {
    return this._lastChangedTime;
  }

  /**
   * Whether the topic has been announced.
   * @returns Whether the topic has been announced.
   */
  get announced() {
    return this._announceParams != null;
  }

  /**
   * Gets the subscribers to the topic.
   * @returns The subscribers to the topic.
   */
  get subscribers() {
    return this._subscribers;
  }

  /**
   * Creates a new topic. This should only be done after the
   * base NTCore client has been initialized.
   * @param client - The client that owns the topic.
   * @param name - The name of the topic.
   */
  constructor(client: PubSubClient, name: string) {
    this.client = client;
    this._name = name;
    this._announceParams = null;
    this._subscribers = new Map();
  }

  // ------------- //
  // ANNOUNCEMENTS //
  // ------------- //

  /**
   * Marks the topic as announced. This should only be called by the PubSubClient.
   * @param params - The parameters of the announcement.
   */
  announce(params: AnnounceMessageParams) {
    pubsubLogger.debug('Topic announced in base topic', { topicName: this.name, topicId: params.id });
    this._announceParams = params;
    this._id = params.id;
  }

  /** Marks the topic as unannounced. This should only be called by the PubSubClient. */
  unannounce() {
    pubsubLogger.debug('Topic unannounced in base topic', { topicName: this.name, topicId: this._id });
    this._announceParams = null;
    this._id = undefined;
  }

  // ----------- //
  // SUBSCRIBING //
  // ----------- //

  /**
   * Creates a new subscriber.
   * @param callback - The callback to call when the topic value changes.
   * @param options - The options for the subscriber. `id` and `save` are not part of the public API;
   *   use {@link subscribeWithId} for reconnect internals.
   * @returns The UID of the subscriber.
   */
  abstract subscribe(callback: CallbackFn<T>, options?: Omit<SubscribeOptions, 'prefix'>): number;

  /**
   * Creates a new subscriber, optionally reusing a subscription UID.
   * @internal Used by resubscribeAll and tests. Not part of the public subscribe() signature.
   * @param callback - The callback to call when the topic value changes.
   * @param options - The options for the subscriber.
   * @param id - The UID of the subscriber.
   * @param save - Whether to save the subscriber.
   * @returns The UID of the subscriber.
   */
  protected abstract subscribeWithId(
    callback: CallbackFn<T>,
    options?: Omit<SubscribeOptions, 'prefix'>,
    id?: number,
    save?: boolean
  ): number;

  /**
   * Resubscribes all local subscribers.
   * @param client - The client to resubscribe with.
   */
  abstract resubscribeAll(client: PubSubClient): void;

  /**
   * Removes a subscriber
   * @param subuid - The UID of the subscriber.
   * @param removeCallback - Whether to remove the callback. Leave this as true unless you know what you're doing.
   */
  unsubscribe(subuid: number, removeCallback = true) {
    pubsubLogger.debug('Unsubscribed from topic', {
      topicName: this.name,
      subuid,
      removeCallback,
      remainingSubscribers: this.subscribers.size - (this.subscribers.has(subuid) ? 1 : 0),
    });
    this.client.messenger.unsubscribe(subuid);
    if (removeCallback) this.subscribers.delete(subuid);
  }

  /**
   * Removes all local subscribers.
   */
  unsubscribeAll() {
    const subscriberCount = this.subscribers.size;
    pubsubLogger.debug('Unsubscribing all', { topicName: this.name, subscriberCount });
    this.subscribers.forEach((_, subuid) => this.unsubscribe(subuid));
  }

  /**
   * Strips client-only subscribe options (e.g. `immediateNotify`) before sending to the NT server.
   * @param options - The subscriber options, possibly including client-only fields.
   * @returns Protocol subscribe options.
   */
  protected toProtocolSubscribeOptions(
    options: Omit<SubscribeOptions, 'prefix'> = {}
  ): Omit<SubscribeOptions, 'prefix' | 'immediateNotify'> {
    const rest = { ...options };
    delete rest.immediateNotify;
    return rest;
  }

  // ---------- //
  // PUBLISHING //
  // ---------- //

  /**
   * Sets the properties of the topic.
   * @param properties - Topic properties to update (e.g. `{ persistent: true, retained: true }`).
   * @returns The server's response.
   */
  async setProperties(properties: TopicProperties = {}): Promise<PropertiesMessage> {
    const setPropertiesParams: SetPropertiesMessageParams = {
      name: this.name,
      update: properties,
    };

    // Send the set properties request
    return await this.client.messenger.setProperties(setPropertiesParams);
  }
}
