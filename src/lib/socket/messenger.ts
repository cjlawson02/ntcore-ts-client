import { NetworkTablesSocket } from './socket';

import type { Topic } from 'src/lib/pubsub/topic';
import type {
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
} from 'src/lib/types/types';

/** NetworkTables client. */
export class Messenger {
    private readonly _socket: NetworkTablesSocket;
    private readonly publications = new Map<number, PublishMessageParams>();
    private readonly subscriptions = new Map<number, SubscribeMessageParams>();
    private readonly pendingMessages = new Map<string, NetworkTableTypes>();
    private static _instance: Messenger;

    /**
     * Gets the NetworkTablesSocket used by the Messenger.
     *
     * @returns The NetworkTablesSocket used by the Messenger.
     */
    get socket() {
        return this._socket;
    }

    /**
     * Creates a new NetworkTables client.
     *
     * @param serverUrl - The URL of the server to connect to.
     * @param onTopicUpdate - Called when a topic is updated.
     * @param onAnnounce - Called when a topic is announced.
     * @param onUnannounce - Called when a topic is unannounced.
     */
    private constructor(
        serverUrl: string,
        onTopicUpdate: (_: BinaryMessageData) => void,
        onAnnounce: (_: AnnounceMessageParams) => void,
        onUnannounce: (_: UnannounceMessageParams) => void
    ) {
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
     *
     * @param serverUrl - The URL of the server to connect to. This is not needed after the first call.
     * @param onTopicUpdate - Called when a topic is updated.
     * @param onAnnounce - Called when a topic is announced.
     * @param onUnannounce - Called when a topic is unannounced.
     * @returns The instance of the NetworkTables client.
     */
    static getInstance(
        serverUrl: string,
        onTopicUpdate: (_: BinaryMessageData) => void,
        onAnnounce: (_: AnnounceMessageParams) => void,
        onUnannounce: (_: UnannounceMessageParams) => void
    ): Messenger {
        if (!this._instance) {
            this._instance = new this(serverUrl, onTopicUpdate, onAnnounce, onUnannounce);
        }

        return Messenger._instance;
    }

    /**
     * Reinstantiates the messenger by resetting the socket with a new URL.
     *
     * @param serverUrl - The URL of the server to connect to.
     */
    reinstantiate(serverUrl: string) {
        this._socket.stopAutoConnect();
        this._socket.reinstantiate(serverUrl);
        this._socket.startAutoConnect();
    }

    /**
     * Gets all publications.
     *
     * @returns An iterator of all publications in the form [id, params].
     */
    getPublications() {
        return this.publications.entries();
    }

    /**
     * Gets all subscriptions.
     *
     * @returns An iterator of all subscriptions in the form [id, params].
     */
    getSubscriptions() {
        return this.subscriptions.entries();
    }

    /**
     * Called when the socket opens.
     */
    onSocketOpen = () => {
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
    onSocketClose = () => {};

    /**
     * Publishes a topic to the server.
     *
     * @param params - The publication parameters.
     * @param force - Whether to force the publication.
     */
    publish(params: PublishMessageParams, force?: boolean) {
        // Check if the topic is already published
        if (this.publications.has(params.pubuid) && !force) return;

        // Add the topic to the list of published topics
        this.publications.set(params.pubuid, params);

        // Send the message to the server
        const message: PublishMessage = {
            method: 'publish',
            params,
        };

        this._socket.sendTextFrame(message);
    }

    /**
     * Unpublishes a topic from the server.
     *
     * @param pubuid - The publication ID to unpublish.
     */
    unpublish(pubuid: number) {
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
     *
     * @param params - The subscription parameters.
     * @param force - Whether to force the subscription.
     */
    subscribe(params: SubscribeMessageParams, force?: boolean) {
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
     *
     * @param subuid - The subscription ID to unsubscribe from.
     */
    unsubscribe(subuid: number) {
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
     *
     * @param params - The parameters to set
     */
    setProperties(params: SetPropertiesMessageParams) {
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
     * @param topic - The topic to update.
     * @param value - The value to update the topic to.
     * @returns The timestamp of the update, or -1 if the topic is not announced.
     */
    sendToTopic<T extends NetworkTableTypes>(topic: Topic<T>, value: T) {
        const typeInfo = topic.typeInfo;

        if (!topic.publisher || !topic.pubuid) {
            throw new Error(`Topic ${topic.name} is not a publisher, so it cannot be updated`);
        }

        if (topic.announced) {
            return this._socket.sendValueToTopic(topic.pubuid, value, typeInfo);
        } else {
            // TODO: is this needed?
            console.warn(`Topic ${topic.name} is not announced, so it cannot be updated`);
            this.pendingMessages.set(topic.name, value);
            return -1;
        }
    }
}
