import {
  NetworkTablesTypeInfos,
  type AnnounceMessage,
  type AnnounceMessageParams,
  type PublishMessageParams,
  type SubscribeOptions,
  type TopicProperties,
} from '../types/types';

import { NetworkTablesTopic } from './topic';

import type { CallbackFn } from './base-topic';
import type { PubSubClient } from './pubsub';
import type { Type } from 'protobufjs';
import type { z } from 'zod';

export class NetworkTablesProtobufTopic<T extends Record<string, any>> extends NetworkTablesTopic<
  Uint8Array<ArrayBufferLike>
> {
  // Protobuf support
  private decodedValue: T | null = null;
  private _protobufMessageName?: string;
  private _protobufMessageType: Type | null = null;
  private _validator?: z.ZodSchema<T>;
  private _protoFilePath?: string;
  private _messageTypeString?: string;
  private _schemaRegistered = false;

  /**
   * Creates a new topic. This should only be done after the
   * base NTCore client has been initialized.
   * @param client - The client that owns the topic.
   * @param name - The name of the topic.
   * @param options - The options for the topic.
   * @param options.defaultValue
   * @param options.validator
   * @param options.protoFilePath
   */
  constructor(
    client: PubSubClient,
    name: string,
    options?: {
      defaultValue?: T;
      validator?: z.ZodSchema<T>;
      protoFilePath?: string;
    }
  ) {
    // Note: We can't encode the default value here because we don't have the message type yet.
    // The default value will be encoded when setValue is called or when the schema is available.
    super(client, name, NetworkTablesTypeInfos.kProtobuf, undefined);
    this._validator = options?.validator;
    this._protoFilePath = options?.protoFilePath;
    // Store the default value to encode later when we have the schema
    if (options?.defaultValue !== undefined) {
      this.decodedValue = options.defaultValue;
    }

    // If proto file path is provided, load the schema asynchronously to enable encoding
    if (options?.protoFilePath) {
      this.loadProtoSchema(options.protoFilePath).catch((error) => {
        console.error(`Failed to load proto schema from ${options.protoFilePath}:`, error);
      });
    }
  }

  /**
   * Gets the value of the topic.
   * @returns The value of the topic.
   */
  // TypeScript limitation: We override to return T instead of Uint8Array
  // This is safe because we decode protobuf values internally
  // @ts-expect-error - Base class returns Uint8Array, but we return decoded T. This is intentional.
  override getValue(): T | null {
    return this.decodedValue;
  }

  // TypeScript limitation: We override to accept T instead of Uint8Array
  // This is safe because we encode T to Uint8Array before passing to base class
  // @ts-expect-error - Base class expects Uint8Array, but we accept T and encode it. This is intentional.
  override setValue(value: T): void {
    // Validate the value if a validator is provided
    const validatedValue = this._validator ? this._validator.parse(value) : value;
    // Store the decoded value so getValue() returns it
    this.decodedValue = validatedValue;
    super.setValue(this.encodeValue(validatedValue));
  }

  /**
   * Gets the decoded protobuf value if this is a protobuf topic.
   * @param value
   * @returns The decoded protobuf object, or null if not available.
   */
  private decodeValue(value: Uint8Array): T {
    if (!this._protobufMessageType) {
      // Try to fetch schema if not already fetched
      if (this._protobufMessageName) {
        this.fetchProtobufSchema(this._protobufMessageName);
      }
      if (!this._protobufMessageType) {
        throw new Error('Protobuf message type not found');
      }
    }

    const decoded = this._protobufMessageType.decode(value);
    const obj = this._protobufMessageType.toObject(decoded) as T;

    // If a validator is provided, validate the decoded object
    if (this._validator) {
      return this._validator.parse(obj);
    }

    return obj;
  }

  private encodeValue(value: T): Uint8Array<ArrayBufferLike> {
    if (!this._protobufMessageType) {
      // Try to fetch schema if not already fetched
      if (this._protobufMessageName) {
        this.fetchProtobufSchema(this._protobufMessageName);
      }
      if (!this._protobufMessageType) {
        throw new Error('Protobuf message type not found');
      }
    }

    return this._protobufMessageType.encode(value).finish();
  }

  /**
   * Updates the value of the topic.
   * This should only be called by the PubSubClient.
   * @param value - The value to update.
   * @param lastChangedTime - The server time of the last value change.
   */
  override updateValue(value: Uint8Array<ArrayBufferLike>, lastChangedTime: number) {
    this.decodedValue = this.decodeValue(value);
    super.updateValue(value, lastChangedTime);
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

    const typeString = params.type;

    // Check if this is a protobuf topic
    // Skip schema topics (they contain FileDescriptorProto and shouldn't be decoded)
    if (!this.name.startsWith('/.schema/')) {
      // Extract message name from type string
      let messageName: string | undefined;
      if (typeString.startsWith('proto:')) {
        // Type is like "proto:frc.Pose2d" - extract "frc.Pose2d"
        messageName = typeString.substring(6); // Remove "proto:" prefix
      } else if (typeString === 'protobuf') {
        // Type is just "protobuf" - try to infer from topic name
        // This is a fallback; ideally the type should be "proto:MessageName"
        messageName = this.name.split('/').pop(); // Use last segment of topic name
      }

      if (messageName) {
        this._protobufMessageName = messageName;
        // Fetch schema asynchronously
        this.fetchProtobufSchema(messageName);
      }
    }
  }

  /**
   * Fetches the protobuf schema for this topic.
   * @param messageName - The protobuf message name.
   */
  private fetchProtobufSchema(messageName: string): void {
    const messageType = this.client.protobufSchemaManager.fetchMessageType(messageName);
    if (messageType) {
      this._protobufMessageType = messageType;
    }
  }

  /**
   * Loads a proto schema from a file path.
   * @param protoFilePath - Path to the .proto file.
   */
  private async loadProtoSchema(protoFilePath: string): Promise<void> {
    try {
      const { messageName, root } = await this.client.protobufSchemaManager.registerSchema(protoFilePath);
      this._protobufMessageName = messageName;
      this._messageTypeString = `proto:${messageName}`;

      // Get the message type from the root
      const messageType = root.lookupType(messageName);
      if (messageType) {
        this._protobufMessageType = messageType;
      }
    } catch (error) {
      throw new Error(`Failed to load proto schema: ${error instanceof Error ? error.message : String(error)}`);
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
  // TypeScript limitation: We override to accept CallbackFn<T> instead of CallbackFn<Uint8Array>
  // This is safe because we decode protobuf values and pass T to callbacks
  // @ts-expect-error - Base class expects CallbackFn<Uint8Array>, but we accept CallbackFn<T>. This is intentional.
  override subscribe(
    // @ts-expect-error - Base class expects CallbackFn<Uint8Array>, but we accept CallbackFn<T>. This is intentional.
    callback: CallbackFn<T>,
    options: Omit<SubscribeOptions, 'prefix'> = {},
    id?: number,
    save = true
  ): number {
    // Call super with type assertion - we store CallbackFn<T> but base class expects CallbackFn<Uint8Array>
    // This is safe because we decode values in notifySubscribers() before calling callbacks
    // @ts-expect-error - Type mismatch is intentional: we decode Uint8Array to T before calling callbacks
    return super.subscribe(callback, options, id, save);
  }

  /**
   * Notifies all subscribers of the current value.
   */
  override notifySubscribers() {
    // We know that _announceParams is not null here because we received a value update
    // Type assertion needed because base class expects Uint8Array but we provide T
    // @ts-expect-error - Type mismatch is intentional: we decode Uint8Array to T before calling callbacks
    this.subscribers.forEach((info) => info.callback(this.decodedValue, this._announceParams!));
  }

  /** */
  /* PUBLISHING */
  /** */

  /**
   * Publishes the topic.
   * If a proto file path was provided, registers the schema first.
   * @param properties - The properties to publish the topic with.
   * @param id - The UID of the publisher. You must verify that the ID is not already in use.
   * @returns A promise that resolves when the topic is published.
   */
  override async publish(properties: TopicProperties = {}, id?: number): Promise<AnnounceMessage | void> {
    if (this.publisher) return;

    // Use unified in-flight protection from PubSubClient
    // Key format: "publish:" prefix to avoid conflicts with schema registrations
    const operationKey = `publish:${this.name}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      // If proto file path is provided and schema not yet registered, register it first
      // Note: loadProtoSchema() -> registerSchema() already uses unified protection,
      // so concurrent calls will share the same schema registration
      if (this._protoFilePath && !this._schemaRegistered) {
        try {
          await this.loadProtoSchema(this._protoFilePath);
          this._schemaRegistered = true;
        } catch (error) {
          throw new Error(
            `Failed to register protobuf schema before publishing: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Use the message type string if available, otherwise fall back to generic 'protobuf'
      const typeString = this._messageTypeString || this.typeInfo[1];

      // Get or generate pubuid
      const pubuid = id ?? this.client.messenger.getNextPubUID();

      this['_pubuid'] = pubuid;
      this['_publishProperties'] = properties;

      // Publish with the correct type string using messenger directly
      const publishParams: PublishMessageParams = {
        type: typeString,
        name: this.name,
        pubuid,
        properties,
      };

      return await this.client.messenger.publish(publishParams);
    });
  }
}
