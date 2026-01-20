import * as protobuf from 'protobufjs';
import 'protobufjs/ext/descriptor';

import * as path from 'path';

// Import types from our type declaration file
import type { IFileDescriptorProto, IFileDescriptorSet } from './protobufjs-descriptor';

import { NetworkTablesTypeInfos } from '../types/types';

import { NetworkTablesPrefixTopic } from './prefix-topic';
import { NetworkTablesTopic } from './topic';

import type { PubSubClient } from './pubsub';
import type { AnnounceMessageParams } from '../types/types';

/**
 * Manages protobuf schema fetching and caching from NetworkTables.
 * Schemas are automatically cached from `/.schema/proto:*` topics using a prefix subscription.
 */
export class ProtobufSchemaManager {
  private readonly schemaCache: Map<string, protobuf.Namespace> = new Map();
  private readonly registeredSchemas: Set<string> = new Set();
  private readonly schemaPrefixTopic: NetworkTablesPrefixTopic;
  private readonly client: PubSubClient;
  private fileDescriptorProtoType = protobuf
    .loadSync(require.resolve('protobufjs/google/protobuf/descriptor.proto'))
    .lookupType('google.protobuf.FileDescriptorProto');

  constructor(client: PubSubClient) {
    this.client = client;
    // Create a prefix topic for all schema topics
    this.schemaPrefixTopic = new NetworkTablesPrefixTopic(client, '/.schema/proto:');

    // Subscribe to all schema topics and automatically decode and cache them
    this.schemaPrefixTopic.subscribe(
      (value, params) => {
        this.handleSchemaUpdate(value as Uint8Array, params);
      },
      {},
      undefined,
      true
    );
  }

  /**
   * Handles schema updates from the prefix topic subscription.
   * Automatically decodes and caches all schema files that arrive.
   * @param value - The value of the schema update.
   * @param params - The parameters of the announce message.
   */
  private handleSchemaUpdate(value: Uint8Array, params: AnnounceMessageParams): void {
    const protoFileName = params.name.substring('/.schema/proto:'.length);
    if (!protoFileName) return;

    const decoded = this.fileDescriptorProtoType.decode(value);

    // Convert to a plain JS object (numbers for enums are fine for fromDescriptor)
    // toObject returns a plain object that matches IFileDescriptorProto structure
    const fd = this.fileDescriptorProtoType.toObject(decoded, {
      enums: Number,
      longs: String,
      bytes: String,
    }) as IFileDescriptorProto;

    // IMPORTANT: fromDescriptor is STATIC, not instance
    // It expects an IFileDescriptorSet with a 'file' array property
    const descriptorSet: IFileDescriptorSet = { file: [fd] };

    // fromDescriptor is a static method added by protobufjs/ext/descriptor
    // Our type declaration file augments protobuf.Root to include this method
    // The method returns Namespace, but we know it's actually a Root instance
    const schemaRoot = protobuf.Root.fromDescriptor(descriptorSet).resolveAll();

    this.schemaCache.set(protoFileName, schemaRoot);
    this.schemaCache.set(params.name, schemaRoot);
  }

  /**
   * Fetches a protobuf schema from NetworkTables.
   * Searches all loaded schemas in the cache to find one containing the requested message type.
   * @param messageName - The name of the protobuf message type (e.g., "frc.Pose2d").
   * @returns The protobufjs Root containing the schema.
   * @throws {Error} If the schema is not found in the cache.
   */
  fetchMessageType(messageName: string): protobuf.Type {
    // Search all cached schemas for the requested message type
    for (const schema of this.schemaCache.values()) {
      try {
        return schema.lookupType(messageName);
      } catch {
        // lookupType throws if type not found, continue searching
        continue;
      }
    }

    throw new Error(`Schema containing message type "${messageName}" not found in cache`);
  }

  /**
   * Clears the schema cache.
   */
  clearCache() {
    this.schemaCache.clear();
  }

  /**
   * Gets the message name from a protobuf root.
   * Auto-detects the first message type in the proto file.
   * @param root - The protobuf root containing the schema.
   * @returns The message name in format "package.MessageName" or "MessageName" if no package.
   */
  getMessageNameFromProto(root: protobuf.Namespace): string {
    // Get all nested types (messages) from the root
    const nested = root.nested;
    if (!nested) {
      throw new Error('Proto file has no messages');
    }

    // Find the first message type
    for (const [_, nestedObj] of Object.entries(nested)) {
      if (nestedObj instanceof protobuf.Type) {
        // Get the full name which includes package
        const fullName = nestedObj.fullName;
        return fullName;
      }
      // If it's a namespace (package), recurse into it
      if (nestedObj instanceof protobuf.Namespace) {
        const message = this.findFirstMessage(nestedObj);
        if (message) {
          return message.fullName;
        }
      }
    }

    throw new Error('No message type found in proto file');
  }

  /**
   * Recursively finds the first message type in a namespace.
   * @param namespace - The namespace to search.
   * @returns The first message type found, or null.
   */
  private findFirstMessage(namespace: protobuf.Namespace): protobuf.Type | null {
    for (const [_, nestedObj] of Object.entries(namespace.nested || {})) {
      if (nestedObj instanceof protobuf.Type) {
        return nestedObj;
      }
      if (nestedObj instanceof protobuf.Namespace) {
        const message = this.findFirstMessage(nestedObj);
        if (message) {
          return message;
        }
      }
    }
    return null;
  }

  /**
   * Registers a protobuf schema by loading a proto file and publishing it to NetworkTables.
   * @param protoFilePath - Path to the .proto file.
   * @param messageName - Optional message name to use. If not provided, auto-detected from proto file.
   * @returns A promise that resolves to the message name and schema root.
   * @throws {Error} If the proto file cannot be loaded or schema cannot be registered.
   */
  async registerSchema(
    protoFilePath: string,
    messageName?: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    // Extract filename from path
    const filename = path.basename(protoFilePath);
    const schemaTopicName = `/.schema/proto:${filename}`;

    // Check if schema is already registered
    if (this.registeredSchemas.has(schemaTopicName)) {
      // Schema already registered, return cached version
      const cachedRoot = this.schemaCache.get(schemaTopicName);
      if (cachedRoot) {
        const detectedMessageName = messageName || this.getMessageNameFromProto(cachedRoot);
        return { messageName: detectedMessageName, root: cachedRoot };
      }
    }

    // Use unified in-flight protection from PubSubClient
    // Key format: "schema:" prefix to avoid conflicts with topic publishes
    const operationKey = `schema:${schemaTopicName}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      // Load and parse the proto file
      let root: protobuf.Root;
      try {
        root = await protobuf.load(protoFilePath);
      } catch (error) {
        throw new Error(
          `Failed to load proto file "${protoFilePath}": ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Extract and encode FileDescriptorProto
      let encoded: Uint8Array;
      try {
        // toDescriptor is properly typed via our type declaration file
        const descriptor = root.toDescriptor('proto3');
        if (!descriptor?.file?.length) {
          throw new Error('No file descriptor found in proto');
        }
        const fileDescriptorProto = descriptor.file[0];
        encoded = this.fileDescriptorProtoType.encode(fileDescriptorProto).finish();
      } catch (error) {
        throw new Error(
          `Failed to extract/encode FileDescriptorProto from "${protoFilePath}": ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Auto-detect message name if not provided
      const detectedMessageName = messageName || this.getMessageNameFromProto(root);

      // Create or get the schema topic (as raw/ArrayBuffer type for internal use)
      let schemaTopic = this.client.getTopicFromName(schemaTopicName) as NetworkTablesTopic<Uint8Array> | null;
      if (!schemaTopic) {
        schemaTopic = new NetworkTablesTopic<Uint8Array>(
          this.client,
          schemaTopicName,
          NetworkTablesTypeInfos.kUint8Array
        );
      }

      // Publish the schema topic with type "proto:FileDescriptorProto" and retained property
      // We need to use the messenger directly to publish with a custom type string
      const pubuid = this.client.messenger.getNextPubUID();
      await this.client.messenger.publish({
        name: schemaTopicName,
        pubuid,
        type: 'proto:FileDescriptorProto',
        properties: { retained: true },
      });

      // Manually mark the topic as publisher since we used messenger.publish() directly
      // The server's announcement doesn't include pubuid, so topic.announce() won't mark it as publisher
      // We need to set both _pubuid and _publisher manually
      schemaTopic['_pubuid'] = pubuid;
      schemaTopic['_publisher'] = true;

      // Set the schema value (encoded FileDescriptorProto) as the default value
      this.client.updateServer(schemaTopic, encoded);

      // Cache the schema
      this.schemaCache.set(schemaTopicName, root);
      this.schemaCache.set(filename, root);
      this.registeredSchemas.add(schemaTopicName);

      return { messageName: detectedMessageName, root };
    });
  }
}
