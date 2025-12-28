import { pubsubLogger } from '../util/logger';

import { NetworkTablesBaseTopic } from './base-topic';

import type { CallbackFn } from './base-topic';
import type { PubSubClient } from './pubsub';
import type {
  AnnounceMessageParams,
  NetworkTablesTypes,
  SubscribeMessageParams,
  SubscribeOptions,
} from '../types/types';

export class NetworkTablesPrefixTopic extends NetworkTablesBaseTopic<NetworkTablesTypes> {
  readonly type = 'prefix';

  /**
   * Creates a new topic. This should only be done after the
   * base NTCore client has been initialized.
   * @param client - The client that owns the topic.
   * @param name - The name of the topic.
   */
  constructor(client: PubSubClient, name: string) {
    super(client, name);

    const existingTopic = this.client.getPrefixTopicFromName(name);
    if (existingTopic) {
      pubsubLogger.info('Existing prefix topic reused', { prefix: name });
      return existingTopic;
    }

    pubsubLogger.debug('Prefix topic created', { prefix: name });
    this.client.registerTopic(this);
  }

  /** */
  /* SUBSCRIBING */
  /** */

  /**
   * Creates a new subscriber.
   * @param callback - The callback to call when the topic value changes.
   * @param options - The options for the subscriber.
   * @param id - The UID of the subscriber.
   * @param save - Whether to save the subscriber.
   * @returns The UID of the subscriber.
   */
  subscribe(
    callback: CallbackFn<NetworkTablesTypes>,
    options: Omit<SubscribeOptions, 'prefix'> = {},
    id?: number,
    save = true
  ) {
    const subuid = id || this.client.messenger.getNextSubUID();

    const subscribeParams: SubscribeMessageParams = {
      topics: [this.name],
      subuid,
      options: {
        ...options,
        prefix: true,
      },
    };
    this.client.messenger.subscribe(subscribeParams);

    if (save) this.subscribers.set(subuid, { callback, options });
    pubsubLogger.debug('Subscriber added to prefix topic', {
      prefix: this.name,
      subuid,
      options,
      totalSubscribers: this.subscribers.size,
    });

    return subuid;
  }

  resubscribeAll(client: PubSubClient) {
    const subscriberCount = this.subscribers.size;
    pubsubLogger.debug('Resubscribe all prefix topic', { prefix: this.name, subscriberCount });
    this.client = client;
    this.subscribers.forEach((info, subuid) => {
      this.subscribe(info.callback, info.options, subuid, false);
    });
  }

  /**
   * Updates the value of a subtopic. Notifies all subscribers of the change.
   * @param params - The params of the subtopic
   * @param value - The value of the subtopic
   * @param serverTime - The time the value was updated
   */
  updateValue(params: AnnounceMessageParams, value: NetworkTablesTypes, serverTime: number) {
    pubsubLogger.debug('Value update applied to prefix topic', {
      prefix: this.name,
      subtopicName: params.name,
      subtopicId: params.id,
      serverTime,
    });
    this._lastChangedTime = serverTime;
    this.notifySubscribers(params, value);
  }

  private notifySubscribers(params: AnnounceMessageParams, value: NetworkTablesTypes) {
    const subscriberCount = this.subscribers.size;
    pubsubLogger.debug('Subscribers notified for prefix topic', {
      prefix: this.name,
      subtopicName: params.name,
      count: subscriberCount,
    });
    this.subscribers.forEach((info, subuid) => {
      pubsubLogger.trace('Callback invoked for prefix topic', {
        prefix: this.name,
        subuid,
        subtopicName: params.name,
        value,
        params,
      });
      info.callback(value, params);
    });
  }
}
