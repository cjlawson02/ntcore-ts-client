import {
  NetworkTablesTypeInfos,
  type AnnounceMessage,
  type AnnounceMessageParams,
  type PublishMessageParams,
  type TopicProperties,
} from '../types/types';

import { pubsubLogger } from '../util/logger';

import { NetworkTablesTopic } from './topic';

import type { PubSubClient } from './pubsub';
import type { Type } from 'protobufjs';
import type { z } from 'zod';

/** Options for creating a protobuf topic. */
export interface ProtobufTopicOptions<T extends object> {
  defaultValue?: T;
  validator?: z.ZodSchema<T>;
  /** Path to a .proto file. Node.js only (uses the filesystem). */
  protoFilePath?: string;
  /** Contents of a .proto file. Parsed in-memory; safe in the browser. */
  protoSource?: string;
  /** Prebuilt protobufjs Type. Safe in the browser. */
  messageType?: Type;
}

export class NetworkTablesProtobufTopic<T extends object> extends NetworkTablesTopic<Uint8Array<ArrayBufferLike>, T> {
  // Protobuf support
  private decodedValue: T | null = null;
  private _protobufMessageName?: string;
  private _protobufMessageType: Type | null = null;
  private _validator?: z.ZodSchema<T>;
  private _protoFilePath?: string;
  private _protoSource?: string;
  private _providedMessageType?: Type;
  private _messageTypeString?: string;
  private _schemaRegistered = false;
  /** Stored error when constructor's fire-and-forget loadProtoSchema fails; re-thrown by ensureMessageType. */
  private _schemaLoadError: Error | null = null;

  /**
   * Creates a new topic. This should only be done after the
   * base NTCore client has been initialized.
   * @param client - The client that owns the topic.
   * @param name - The name of the topic.
   * @param options - The options for the topic.
   * @param options.defaultValue
   * @param options.validator
   * @param options.protoFilePath - Node.js only. Use protoSource or messageType in the browser.
   * @param options.protoSource - In-memory .proto text. Safe in the browser.
   * @param options.messageType - Prebuilt protobufjs Type. Safe in the browser.
   */
  constructor(client: PubSubClient, name: string, options?: ProtobufTopicOptions<T>) {
    // Note: We can't encode the default value here because we don't have the message type yet.
    // The default value will be encoded when setValue is called or when the schema is available.
    super(client, name, NetworkTablesTypeInfos.kProtobuf, undefined);
    this._validator = options?.validator;
    this._protoFilePath = options?.protoFilePath;
    this._protoSource = options?.protoSource;
    this._providedMessageType = options?.messageType;
    // Store the default value to encode later when we have the schema
    if (options?.defaultValue !== undefined) {
      this.decodedValue = options.defaultValue;
    }

    if (options?.messageType) {
      this.applyMessageType(options.messageType);
    } else if (options?.protoSource) {
      try {
        const { messageName, root } = this.client.protobufSchemaManager.parseSource(options.protoSource);
        this._protobufMessageName = messageName;
        this._messageTypeString = `proto:${messageName}`;
        this._protobufMessageType = root.lookupType(messageName);
      } catch (error) {
        this._schemaLoadError =
          error instanceof Error ? error : new Error(`Failed to parse proto source: ${String(error)}`);
        console.error(`Failed to parse proto source for ${name}:`, error);
      }
      this.loadProtoSource(options.protoSource).catch((error) => {
        if (this._protobufMessageType != null) {
          console.error(`Failed to register proto source for ${name}:`, error);
          return;
        }
        this._schemaLoadError =
          error instanceof Error ? error : new Error(`Failed to parse proto source: ${String(error)}`);
        console.error(`Failed to parse proto source for ${name}:`, error);
      });
    } else if (options?.protoFilePath) {
      this.loadProtoSchema(options.protoFilePath).catch((error) => {
        this._schemaLoadError =
          error instanceof Error ? error : new Error(`Failed to load proto schema: ${String(error)}`);
        console.error(`Failed to load proto schema from ${options.protoFilePath}:`, error);
      });
    }
  }

  /**
   * Applies options to an existing protobuf topic.
   * Used when returning a cached topic from getProtobufTopic so the returned
   * instance has the requested validator, protoFilePath, and defaultValue.
   * A later `validator` replaces any previous validator because the topic is a singleton.
   * @param options - The options to apply.
   */
  applyOptions(options?: ProtobufTopicOptions<T>): void {
    if (options?.validator !== undefined) {
      this._validator = options.validator;
    }
    if (options?.messageType !== undefined) {
      this.assertMessageTypeUnchanged(this.normalizeMessageName(options.messageType.fullName));
      this._providedMessageType = options.messageType;
      this._schemaLoadError = null;
      this.applyMessageType(options.messageType);
      if (!this._publisher) this._schemaRegistered = false;
    } else if (options?.protoSource !== undefined) {
      let parsed;
      try {
        parsed = this.client.protobufSchemaManager.parseSource(options.protoSource);
      } catch (error) {
        if (this._protobufMessageType == null) {
          this._schemaLoadError =
            error instanceof Error ? error : new Error(`Failed to parse proto source: ${String(error)}`);
        }
        console.error(`Failed to parse proto source for ${this.name}:`, error);
        return;
      }
      this.assertMessageTypeUnchanged(parsed.messageName);
      this._protoSource = options.protoSource;
      this._schemaLoadError = null;
      this._protobufMessageName = parsed.messageName;
      this._messageTypeString = `proto:${parsed.messageName}`;
      this._protobufMessageType = parsed.root.lookupType(parsed.messageName);
      if (!this._publisher) this._schemaRegistered = false;
    } else if (options?.protoFilePath !== undefined) {
      if (!this._publisher) this._schemaRegistered = false;
      this.loadProtoSchema(options.protoFilePath)
        .then(() => {
          this._protoFilePath = options.protoFilePath;
          this._schemaLoadError = null;
        })
        .catch((error) => {
          if (this._protobufMessageType == null) {
            this._schemaLoadError =
              error instanceof Error ? error : new Error(`Failed to load proto schema: ${String(error)}`);
          }
          console.error(`Failed to load proto schema from ${options.protoFilePath}:`, error);
        });
    }
    if (options?.defaultValue !== undefined && this.decodedValue == null) {
      this.decodedValue = options.defaultValue;
    }
  }

  private normalizeMessageName(name: string): string {
    return name.startsWith('.') ? name.slice(1) : name;
  }

  private assertMessageTypeUnchanged(messageName: string): void {
    if (this._protobufMessageName && this._protobufMessageName !== messageName) {
      throw new Error(
        `Cannot change protobuf message type on published topic "${this.name}" from "${this._protobufMessageName}" to "${messageName}".`
      );
    }
  }

  /**
   * Gets the value of the topic.
   * @returns The value of the topic.
   */
  override getValue(): T | null {
    return this.decodedValue;
  }

  override setValue(value: T): void {
    const validatedValue = this._validator ? this._validator.parse(value) : value;
    // Encode first so schema load errors (e.g. bad protoFilePath) are thrown before publisher check
    const encoded = this.encodeValue(validatedValue);
    if (!this.publisher) {
      pubsubLogger.debug('Publisher check failed before setValue', { topicName: this.name });
      throw new Error('Cannot set value on topic without being the publisher');
    }
    this.decodedValue = validatedValue;
    this.setWireValue(encoded);
    this.afterSetWireValue();
  }

  /**
   * Ensures the protobuf message type is available, fetching it if necessary.
   * @returns The protobuf message type.
   * @throws {Error} If schema loading failed in the constructor (protoFilePath), re-throws that error.
   * @throws {Error} If the protobuf message type cannot be found in the schema cache.
   */
  private ensureMessageType(): Type {
    if (this._schemaLoadError) {
      throw this._schemaLoadError;
    }
    if (!this._protobufMessageType) {
      // Try to fetch schema if not already fetched
      if (this._protobufMessageName) {
        this.fetchProtobufSchema(this._protobufMessageName);
      }
      if (!this._protobufMessageType) {
        throw new Error('Protobuf message type not found');
      }
    }
    return this._protobufMessageType;
  }

  /**
   * Decodes a protobuf-encoded value to a typed object.
   * @param value - The protobuf-encoded Uint8Array value.
   * @returns The decoded protobuf object.
   * @throws {Error} If the protobuf message type is not found in the schema cache.
   *                  This can occur if decoding is attempted before the schema has been
   *                  fetched from NetworkTables (e.g., value update arrives before
   *                  announcement is processed or schema topic is received).
   */
  private decodeValue(value: Uint8Array): T {
    const messageType = this.ensureMessageType();

    const decoded = messageType.decode(value);
    const obj = messageType.toObject(decoded, { defaults: true }) as T;

    // If a validator is provided, validate the decoded object
    if (this._validator) {
      return this._validator.parse(obj);
    }

    return obj;
  }

  /**
   * Encodes a typed object to a protobuf-encoded Uint8Array.
   * @param value - The typed object to encode.
   * @returns The protobuf-encoded Uint8Array.
   * @throws {Error} If the protobuf message type is not found in the schema cache.
   *                  This can occur if encoding is attempted before the schema has been
   *                  loaded (e.g., setValue called before protoFilePath schema is loaded
   *                  or before the topic announcement provides the message type).
   */
  private encodeValue(value: T): Uint8Array<ArrayBufferLike> {
    const messageType = this.ensureMessageType();

    return messageType.encode(value).finish();
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

  // ------------- //
  // ANNOUNCEMENTS //
  // ------------- //

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
   * Loads a proto schema from a file path (Node.js only).
   * @param protoFilePath - Path to the .proto file.
   */
  private async loadProtoSchema(protoFilePath: string): Promise<void> {
    try {
      const { messageName, root } = await this.client.protobufSchemaManager.registerSchema(protoFilePath);
      this.assertMessageTypeUnchanged(messageName);
      this._protobufMessageName = messageName;
      this._messageTypeString = `proto:${messageName}`;

      const messageType = root.lookupType(messageName);
      if (messageType) {
        this._protobufMessageType = messageType;
      }
    } catch (error) {
      throw new Error(`Failed to load proto schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Loads a proto schema from an in-memory source string.
   * @param protoSource - Contents of a .proto file.
   */
  private async loadProtoSource(protoSource: string): Promise<void> {
    try {
      const { messageName, root } = this.client.protobufSchemaManager.parseSource(protoSource);
      this._protobufMessageName = messageName;
      this._messageTypeString = `proto:${messageName}`;
      this._protobufMessageType = root.lookupType(messageName);
      await this.client.protobufSchemaManager.registerSchemaFromSource(protoSource);
    } catch (error) {
      throw new Error(`Failed to parse proto source: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Applies a prebuilt protobufjs Type for encode/decode.
   * @param messageType - The protobufjs Type.
   */
  private applyMessageType(messageType: Type): void {
    const normalize = (name: string) => (name.startsWith('.') ? name.slice(1) : name);
    const messageName = normalize(messageType.fullName);
    this._protobufMessageName = messageName;
    this._messageTypeString = `proto:${messageName}`;
    this._protobufMessageType = messageType;
  }

  // ----------- //
  // SUBSCRIBING //
  // ----------- //

  // ---------- //
  // PUBLISHING //
  // ---------- //

  /**
   * Publishes the topic.
   * If a proto file path was provided, registers the schema first.
   * @param properties - The properties to publish the topic with.
   * @param id - The UID of the publisher. You must verify that the ID is not already in use.
   * @returns A promise that resolves when the topic is published.
   */
  override async publish(properties: TopicProperties = {}, id?: number): Promise<AnnounceMessage | void> {
    // Use unified in-flight protection from PubSubClient
    // Key format: "publish:" prefix to avoid conflicts with schema registrations
    const operationKey = `publish:${this.name}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      // Check if already publisher inside the in-flight operation to prevent race conditions
      if (this.publisher) {
        pubsubLogger.debug('Publish skipped', { topicName: this.name, reason: 'already publisher' });
        return;
      }

      // If a schema source is provided and schema not yet registered, register it first
      if (!this._schemaRegistered) {
        try {
          if (this._providedMessageType) {
            await this.client.protobufSchemaManager.registerSchemaFromType(this._providedMessageType);
            this._schemaRegistered = true;
          } else if (this._protoSource) {
            await this.loadProtoSource(this._protoSource);
            this._schemaRegistered = true;
          } else if (this._protoFilePath) {
            await this.loadProtoSchema(this._protoFilePath);
            this._schemaRegistered = true;
          }
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

      this._pubuid = pubuid;
      this._publishProperties = properties;
      pubsubLogger.debug('Topic published', { topicName: this.name, pubuid, properties, type: typeString });

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
