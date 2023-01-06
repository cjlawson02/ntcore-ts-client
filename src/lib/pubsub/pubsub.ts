import { Messenger } from 'src/lib/socket/messenger';

import type { Topic } from './topic';
import type {
    AnnounceMessageParams,
    BinaryMessageData,
    NetworkTableTypes,
    UnannounceMessageParams,
} from 'src/lib/types/types';

/** The client for the PubSub protocol. */
export class PubSubClient {
    private readonly _messenger: Messenger;
    private topics: Map<string, Topic<any>>;
    private static _instance: PubSubClient;

    get messenger() {
        return this._messenger;
    }

    private constructor(serverUrl: string) {
        this._messenger = Messenger.getInstance(
            serverUrl,
            this.onTopicUpdate,
            this.onTopicAnnounce,
            this.onTopicUnannounce
        );
        this.topics = new Map();

        window.onbeforeunload = () => {
            this.cleanup();
        };
    }

    /**
     * Gets the instance of the NetworkTables client.
     *
     * @param serverUrl - The URL of the server to connect to. This is not used after the first call.
     * @returns The instance of the NetworkTables client.
     */
    static getInstance(serverUrl: string): PubSubClient {
        if (!this._instance) {
            this._instance = new this(serverUrl);
        }

        return this._instance;
    }

    /**
     * Reinstantiates the client by resubscribing to all previously subscribed topics
     * and republishing for all previously published topics.
     *
     * @param url - The URL of the server to connect to.
     */
    reinstantiate(url: string) {
        this._messenger.reinstantiate(url);
    }

    /**
     * Registers a topic with this PubSubClient.
     *
     * @param topic - The topic to register
     */
    registerTopic<T extends NetworkTableTypes>(topic: Topic<T>) {
        if (this.topics.has(topic.name)) {
            throw new Error(`Topic ${topic.name} already exists. Cannot register a topic with the same name.`);
        }
        this.topics.set(topic.name, topic);
    }

    /**
     * Called by the messenger when a topic is updated.
     *
     * @param message - The message data.
     */
    private onTopicUpdate = (message: BinaryMessageData) => {
        const topic = this.getTopicFromId(message.topicId);
        if (!topic) {
            console.warn('Received message for unknown topic', message);
            return;
        }
        this.updateTopic(topic.name, message.value, message.serverTime);
    };

    /**
     * Called by the messenger when a topic is announced.
     *
     * @param params - The announce message parameters.
     */
    private onTopicAnnounce = (params: AnnounceMessageParams) => {
        const topic = this.topics.get(params.name);
        if (!topic) {
            console.warn('Received announce for unknown topic', params);
            return;
        }
        this.announce(params.id, params.name);
    };

    /**
     * Called by the messenger when a topic is unannounced.
     *
     * @param params - The unannounce message parameters.
     */
    private onTopicUnannounce = (params: UnannounceMessageParams) => {
        const topic = this.topics.get(params.name);
        if (!topic) {
            console.warn('Received unannounce for unknown topic', params);
            return;
        }
        this.unannounce(params.name);
    };

    /**
     * Marks a topic as announced
     *
     * @param topicId - The ID of the topic to announce
     * @param topicName - The name of the topic to announce
     */
    private announce(topicId: number, topicName: string) {
        const topic = this.topics.get(topicName);
        if (!topic) {
            console.warn(`Topic ${topicName} was announced, but does not exist`);
            return;
        }
        topic.announce(topicId);
    }

    /**
     * Marks a topic as unannounced
     *
     * @param topicName - The name of the topic to unannounce
     */
    private unannounce(topicName: string) {
        const topic = this.topics.get(topicName);
        if (!topic) {
            console.warn(`Topic ${topicName} was unannounced, but does not exist`);
            return;
        }
        topic.unannounce();
    }

    /**
     * Updates a topic with a new value
     *
     * @param topicName - The name of the topic to update
     * @param value - The new value of the topic
     * @param lastChangedTime - The server time the topic was last changed
     */
    private updateTopic(topicName: string, value: NetworkTableTypes, lastChangedTime: number) {
        const topic = this.topics.get(topicName);
        if (!topic) {
            console.warn(`Topic ${topicName} was updated, but does not exist`);
            return;
        }
        topic.updateValue(value, lastChangedTime);
    }

    /**
     * Updates the value of a topic on the server.
     *
     * @param topic - The topic to update.
     * @param value - The new value of the topic.
     */
    updateServer<T extends NetworkTableTypes>(topic: Topic<T>, value: T) {
        this._messenger.sendToTopic(topic, value);
    }

    /**
     * Gets the topic with the given ID.
     *
     * @param topicId - The ID of the topic to get.
     * @returns The topic with the given ID, or null if no topic with that ID exists.
     */
    private getTopicFromId(topicId: number) {
        for (const topic of this.topics.values()) {
            if (topic.id === topicId) {
                return topic;
            }
        }
        return null;
    }

    /**
     * Gets the topic with the given name.
     *
     * @param topicName - The name of the topic to get.
     * @returns The topic with the given name, or null if no topic with that name exists.
     */
    getTopicFromName(topicName: string) {
        return this.topics.get(topicName) ?? null;
    }

    /**
     * Cleans up the client by unsubscribing from all topics and stopping publishing for all topics.
     */
    cleanup() {
        this.topics.forEach((topic) => {
            topic.unsubscribeAll();

            if (topic.publisher) topic.unpublish();
        });
        this._messenger.socket.close();
    }
}
