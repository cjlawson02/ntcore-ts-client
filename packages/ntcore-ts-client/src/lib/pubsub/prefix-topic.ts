import { Util } from '../util/util';

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
      return existingTopic;
    }

    this.client.registerTopic(this);
  }

  /** */
  /* SUBSCRIBING */
  /** */

  /**
   * Creates a new subscriber. This should only be called by the PubSubClient.
   * @param callback - The callback to call when the topic value changes.
   * @param _ - Unused.
   * @param options - The options for the subscriber.
   * @param id - The UID of the subscriber.
   * @param save - Whether to save the subscriber.
   * @returns The UID of the subscriber.
   */
  subscribe(
    callback: CallbackFn<NetworkTablesTypes>,
    _?: boolean,
    options: Omit<SubscribeOptions, 'prefix'> = {},
    id?: number,
    save = true
  ) {
    const subuid = id || Util.generateUid();

    const subscribeParams: SubscribeMessageParams = {
      topics: [this.name],
      subuid,
      options: {
        ...options,
        prefix: true,
      },
    };
    this.client.messenger.subscribe(subscribeParams);

    if (save) this.subscribers.set(subuid, { callback, immediateNotify: false, options });

    return subuid;
  }

  resubscribeAll(client: PubSubClient) {
    this.client = client;
    this.subscribers.forEach((info, subuid) => {
      this.subscribe(info.callback, info.immediateNotify, info.options, subuid, false);
    });
  }

  /**
   * Updates the value of a subtopic. Notifies all subscribers of the change.
   * @param topicId - The id of the subtopic
   * @param value - The value of the subtopic
   * @param serverTime - The time the value was updated
   */
  updateValue(topicId: number, value: NetworkTablesTypes, serverTime: number) {
    this._lastChangedTime = serverTime;
    const params = this.client.getKnownTopicParams(topicId);
    this.notifySubscribers(params, value);
  }

  private notifySubscribers(params: AnnounceMessageParams | null, value: NetworkTablesTypes) {
    this.subscribers.forEach((info) => info.callback(value, params));
  }
}
