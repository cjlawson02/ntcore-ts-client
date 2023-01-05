import { Util } from 'src/lib/util/util';

import type { PubSubClient } from './pubsub';
import type {
    NetworkTableTypeInfo,
    NetworkTableTypes,
    PublishMessageParams,
    SetPropertiesMessageParams,
    SubscribeMessageParams,
    SubscribeOptions,
    TopicProperties,
} from 'src/lib/types/types';

export class Topic<T extends NetworkTableTypes> {
    private client: PubSubClient;
    private _id: number | null;
    private readonly _name: string;
    private readonly _typeInfo: NetworkTableTypeInfo;
    private value: T | null;
    private _lastChangedTime: number | null;
    private _announced: boolean;
    private _publisher: boolean;
    private _pubuid: number | null;
    private _subscribers: Map<
        number,
        {
            callback: (_: T | null) => void;
            immediateNotify: boolean;
            options: SubscribeOptions;
        }
    >;

    /** The ID of the topic. */
    get id() {
        return this._id;
    }

    /** The name of the topic. */
    get name() {
        return this._name;
    }

    /** The type info for the topic. */
    get typeInfo(): NetworkTableTypeInfo {
        return this._typeInfo;
    }

    /** The server time of the last value change. */
    get lastChangedTime() {
        return this._lastChangedTime;
    }

    /** Whether the topic has been announced. */
    get announced() {
        return this._announced;
    }

    /** Whether the client is the publisher of the topic. */
    get publisher() {
        return this._publisher;
    }

    /** The UID of the publisher. */
    get pubuid() {
        return this._pubuid;
    }

    /** The subscribers to the topic. */
    get subscribers() {
        return this._subscribers;
    }

    /**
     * Creates a new topic. This should only be done after the
     * base NTCore client has been initialized.
     *
     * @param client - The client that owns the topic.
     * @param name - The name of the topic.
     * @param typeInfo - The type info for the topic.
     * @param defaultValue - The default value for the topic.
     */
    constructor(client: PubSubClient, name: string, typeInfo: NetworkTableTypeInfo, defaultValue?: T) {
        this.client = client;
        this._id = null;
        this._name = name;
        this._typeInfo = typeInfo;
        this.value = defaultValue ?? null;
        this._lastChangedTime = null;
        this._announced = false;
        this._publisher = false;
        this._pubuid = null;
        this._subscribers = new Map();

        const existingTopic = this.client.getTopicFromName(name);
        if (existingTopic) {
            return existingTopic as Topic<T>;
        }

        this.client.registerTopic(this);
    }

    /**
     * Sets the value of the topic.
     * The client must be the publisher of the topic to set the value.
     *
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

    getValue() {
        return this.value;
    }

    /**
     * Updates the value of the topic.
     * This should only be called by the PubSubClient.
     *
     * @param value - The value to update.
     * @param lastChangedTime - The server time of the last value change.
     */
    updateValue(value: T, lastChangedTime: number) {
        this.value = value;
        this._lastChangedTime = lastChangedTime;
        this.notifySubscribers();
    }

    /** ***************/
    /* ANNOUNCEMENTS */
    /** ***************/

    /** Marks the topic as announced. This should only be called by the PubSubClient. */
    announce(id: number) {
        this._announced = true;
        this._id = id;
    }

    /** Marks the topic as unannounced. This should only be called by the PubSubClient. */
    unannounce() {
        this._announced = false;
        this._id = null;
    }

    /** *************/
    /* SUBSCRIBING */
    /** *************/

    /** Creates a new subscriber. This should only be called by the PubSubClient. */
    subscribe(
        callback: (_: T | null) => void,
        immediateNotify = false,
        options: SubscribeOptions = {},
        id?: number,
        save = true
    ) {
        const subuid = id || Util.generateUid();

        const subscribeParams: SubscribeMessageParams = {
            topics: [this.name],
            subuid,
            options,
        };
        this.client.messenger.subscribe(subscribeParams);

        if (immediateNotify) callback(this.value);

        if (save) this.subscribers.set(subuid, { callback, immediateNotify, options });

        return subuid;
    }

    /**
     * Removes a subscriber
     * @param subuid - The UID of the subscriber.
     */
    unsubscribe(subuid: number, removeCallback = true) {
        this.client.messenger.unsubscribe(subuid);
        if (removeCallback) this.subscribers.delete(subuid);
    }

    /**
     * Removes all local subscribers.
     */
    unsubscribeAll() {
        this.subscribers.forEach((_, subuid) => this.unsubscribe(subuid));
    }

    /**
     * Resubscribes all local subscribers.
     */
    resubscribeAll(client: PubSubClient) {
        this.client = client;
        this.subscribers.forEach((info, subuid) => {
            this.subscribe(info.callback, info.immediateNotify, info.options, subuid, false);
        });
    }

    /**
     * Notifies all subscribers of the current value.
     */
    private notifySubscribers() {
        this.subscribers.forEach((info) => info.callback(this.value));
    }

    /** ************/
    /* PUBLISHING */
    /** ************/

    /**
     * Publishes the topic.
     * @param properties - The properties to publish the topic with.
     */
    publish(properties: TopicProperties = {}, id?: number) {
        if (this.publisher) return;
        this._publisher = true;
        this._pubuid = id ?? Util.generateUid();

        const publishParams: PublishMessageParams = {
            type: this.typeInfo[1],
            name: this.name,
            pubuid: this._pubuid,
            properties,
        };

        this.client.messenger.publish(publishParams);
    }

    /**
     * Unpublishes the topic.
     */
    unpublish() {
        if (!this.publisher || !this._pubuid) {
            throw new Error('Cannot unpublish topic without being the publisher');
        }

        this.client.messenger.unpublish(this._pubuid);

        this._publisher = false;
        this._pubuid = null;
    }

    /**
     * Republishes the topic.
     */
    republish(client: PubSubClient) {
        this.client = client;
        if (!this.publisher || !this._pubuid) {
            throw new Error('Cannot republish topic without being the publisher');
        }

        this.publish({}, this._pubuid);
    }

    /**
     * Sets the properties of the topic.
     * @param persistent - If true, the last set value will be periodically saved to persistent storage on the server and be restored during server startup. Topics with this property set to true will not be deleted by the server when the last publisher stops publishing.
     * @param retained - Topics with this property set to true will not be deleted by the server when the last publisher stops publishing.
     */
    setProperties(persistent?: boolean, retained?: boolean) {
        const setPropertiesParams: SetPropertiesMessageParams = {
            name: this.name,
            update: {
                persistent,
                retained,
            },
        };

        this.client.messenger.setProperties(setPropertiesParams);
    }
}
