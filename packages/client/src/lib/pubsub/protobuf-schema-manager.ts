import * as protobufNs from 'protobufjs';
// Node ESM does not support directory imports, so we import the file explicitly.
import 'protobufjs/ext/descriptor/index.js';

// Portable: import JSON so it works in ESM, CJS, and browser (no require.resolve / filesystem).
// Import attribute required for Node ESM when the import is not inlined by the bundler.
import descriptorJson from 'protobufjs/google/protobuf/descriptor.json' with { type: 'json' };

// When Node ESM loads CJS (protobufjs), the namespace may be { default: root }; support both shapes.
const protobuf = (protobufNs as unknown as { default?: typeof protobufNs }).default ?? protobufNs;

// Import types from our type declaration file
import type { IFileDescriptorProto, IFileDescriptorSet } from './protobufjs-descriptor';

import { NetworkTablesTypeInfos } from '../types/types';
import { pubsubLogger } from '../util/logger';

import { NetworkTablesPrefixTopic } from './prefix-topic';
import { NetworkTablesTopic } from './topic';

import type { PubSubClient } from './pubsub';
import type { AnnounceMessageParams } from '../types/types';

/** Extract basename from a path string without Node's path module (works in browser and Node). */
function basename(filePath: string): string {
  return filePath.replace(/^.*[/\\]/, '');
}

/** True when running under Node.js (filesystem APIs such as protobuf.load are available). */
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && typeof process.versions?.node === 'string';
}

const MAX_PROTO_SOURCE_CHARS = 1_000_000;
const MAX_PROTO_SCHEMA_BYTES = 1_000_000;

/**
 * Manages protobuf schema fetching and caching from NetworkTables.
 * Schemas are automatically cached from `/.schema/proto:*` topics using a prefix subscription.
 */
export class ProtobufSchemaManager {
  private readonly schemaCache: Map<string, protobuf.Namespace> = new Map();
  private readonly registeredSchemas: Set<string> = new Set();
  private readonly schemaPrefixTopic: NetworkTablesPrefixTopic;
  private readonly client: PubSubClient;
  private fileDescriptorProtoType = protobuf.Root.fromJSON(descriptorJson as protobuf.INamespace).lookupType(
    'google.protobuf.FileDescriptorProto'
  );

  constructor(client: PubSubClient) {
    this.client = client;
    // Create a prefix topic for all schema topics
    this.schemaPrefixTopic = new NetworkTablesPrefixTopic(client, '/.schema/proto:');

    // Subscribe to all schema topics and automatically decode and cache them
    this.schemaPrefixTopic.subscribe((value, params) => {
      this.handleSchemaUpdate(value as Uint8Array | null, params);
    });
  }

  /**
   * Handles schema updates from the prefix topic subscription.
   * Automatically decodes and caches all schema files that arrive.
   * @param value - The value of the schema update (null when a topic is unannounced).
   * @param params - The parameters of the announce message.
   */
  private handleSchemaUpdate(value: Uint8Array | null, params: AnnounceMessageParams): void {
    if (value == null) return;
    if (!ArrayBuffer.isView(value)) return;
    if (value.byteLength > MAX_PROTO_SCHEMA_BYTES) {
      pubsubLogger.debug('Rejected oversized protobuf schema', { name: params.name, byteLength: value.byteLength });
      return;
    }

    const protoFileName = params.name.substring('/.schema/proto:'.length);
    if (!protoFileName) return;

    try {
      const decoded = this.fileDescriptorProtoType.decode(value);
      const fd = this.fileDescriptorProtoType.toObject(decoded, {
        enums: Number,
        longs: String,
        bytes: String,
      }) as IFileDescriptorProto;
      const descriptorSet: IFileDescriptorSet = { file: [fd] };
      const schemaRoot = protobuf.Root.fromDescriptor(descriptorSet).resolveAll();
      this.schemaCache.set(protoFileName, schemaRoot);
      this.schemaCache.set(params.name, schemaRoot);
    } catch (error) {
      pubsubLogger.debug('Failed to decode protobuf schema', { name: params.name, error });
    }
  }

  /**
   * Fetches a protobuf message type from the cache.
   * Searches all loaded schemas in the cache to find one containing the requested message type.
   * Returns null if the schema is not yet in cache (e.g. topic announced before schema topic arrived).
   * @param messageName - The name of the protobuf message type (e.g., "frc.Pose2d").
   * @returns The protobufjs Type, or null if not found in cache.
   */
  fetchMessageType(messageName: string): protobuf.Type | null {
    // Search all cached schemas for the requested message type
    for (const schema of this.schemaCache.values()) {
      try {
        return schema.lookupType(messageName);
      } catch {
        // lookupType throws if type not found, continue searching
        continue;
      }
    }

    return null;
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
   * @returns The message name in format "package.MessageName" or "MessageName" if no package (no leading dot).
   */
  getMessageNameFromProto(root: protobuf.Namespace): string {
    // Get all nested types (messages) from the root
    const nested = root.nested;
    if (!nested) {
      throw new Error('Proto file has no messages');
    }

    // protobufjs fullName includes a leading dot (e.g. ".networktables.TestData");
    // NetworkTables type strings must be "proto:package.MessageName" with no leading dot.
    const normalize = (name: string) => (name.startsWith('.') ? name.slice(1) : name);

    // Find the first message type
    for (const nestedObj of Object.values(nested)) {
      if (nestedObj instanceof protobuf.Type) {
        return normalize(nestedObj.fullName);
      }
      // If it's a namespace (package), recurse into it
      if (nestedObj instanceof protobuf.Namespace) {
        const message = this.findFirstMessage(nestedObj);
        if (message) {
          return normalize(message.fullName);
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
    for (const nestedObj of Object.values(namespace.nested || {})) {
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
   * Node.js only — uses the filesystem. In the browser, use {@link registerSchemaFromSource} or
   * {@link registerSchemaFromType} instead.
   * @param protoFilePath - Path to the .proto file.
   * @param messageName - Optional message name to use. If not provided, auto-detected from proto file.
   * @returns A promise that resolves to the message name and schema root.
   * @throws {Error} If called in a browser, or if the proto file cannot be loaded or schema cannot be registered.
   */
  async registerSchema(
    protoFilePath: string,
    messageName?: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    if (!isNodeRuntime()) {
      throw new Error(
        `protoFilePath ("${protoFilePath}") requires Node.js filesystem access. Use protoSource or messageType instead for browser environments.`
      );
    }
    const filename = basename(protoFilePath);
    return this.registerRootFromLoader(
      filename,
      messageName,
      async () => {
        try {
          return await protobuf.load(protoFilePath);
        } catch (error) {
          throw new Error(
            `Failed to load proto file "${protoFilePath}": ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },
      protoFilePath
    );
  }

  /**
   * Parses a `.proto` source string without publishing (no filesystem).
   * @param protoSource - The contents of a .proto file.
   * @returns The detected message name and resolved root.
   */
  parseSource(protoSource: string): { messageName: string; root: protobuf.Root } {
    if (protoSource.length > MAX_PROTO_SOURCE_CHARS) {
      throw new Error(`protoSource exceeds ${MAX_PROTO_SOURCE_CHARS} characters`);
    }
    try {
      const parsed = protobuf.parse(protoSource);
      const root = parsed.root.resolveAll() as protobuf.Root;
      const messageName = this.getMessageNameFromProto(root);
      return { messageName, root };
    } catch (error) {
      throw new Error(`Failed to parse proto source: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async registerSchemaFromSource(
    protoSource: string,
    filename?: string,
    messageName?: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    const parsed = this.parseSource(protoSource);
    const detectedMessageName = messageName || parsed.messageName;
    const schemaFilename = filename ?? `${detectedMessageName}.proto`;
    return this.publishRoot(parsed.root, schemaFilename, detectedMessageName);
  }

  /**
   * Registers a protobuf schema from a prebuilt protobufjs Type (no filesystem). Safe in the browser.
   * @param messageType - A protobufjs Type used for encode/decode.
   * @param filename - Optional filename used for the schema topic (defaults to the message name).
   * @returns A promise that resolves to the message name and schema root.
   */
  async registerSchemaFromType(
    messageType: protobuf.Type,
    filename?: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    const normalize = (name: string) => (name.startsWith('.') ? name.slice(1) : name);
    const detectedMessageName = normalize(messageType.fullName);
    const schemaFilename = filename ?? `${detectedMessageName}.proto`;
    return this.publishRoot(messageType.root, schemaFilename, detectedMessageName);
  }

  /**
   * Loads a root then publishes it, sharing in-flight protection by schema topic name.
   */
  private async registerRootFromLoader(
    filename: string,
    messageName: string | undefined,
    loadRoot: () => Promise<protobuf.Root>,
    sourceLabel: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    const schemaTopicName = `/.schema/proto:${filename}`;
    if (this.registeredSchemas.has(schemaTopicName)) {
      const cachedRoot = this.schemaCache.get(schemaTopicName);
      if (cachedRoot) {
        const detectedMessageName = messageName || this.getMessageNameFromProto(cachedRoot);
        return { messageName: detectedMessageName, root: cachedRoot };
      }
    }

    const operationKey = `schema:${schemaTopicName}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      const root = await loadRoot();
      return this.publishLoadedRoot(root, filename, messageName, sourceLabel);
    });
  }

  /**
   * Publishes an already-parsed root, sharing in-flight protection by schema topic name.
   */
  private async publishRoot(
    root: protobuf.Root,
    filename: string,
    messageName?: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    const schemaTopicName = `/.schema/proto:${filename}`;
    if (this.registeredSchemas.has(schemaTopicName)) {
      const cachedRoot = this.schemaCache.get(schemaTopicName);
      if (cachedRoot) {
        const detectedMessageName = messageName || this.getMessageNameFromProto(cachedRoot);
        return { messageName: detectedMessageName, root: cachedRoot };
      }
    }

    const operationKey = `schema:${schemaTopicName}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      return this.publishLoadedRoot(root, filename, messageName, filename);
    });
  }

  /**
   * Encodes a FileDescriptorProto from a root, publishes the schema topic, and caches it.
   * Must be called inside an in-flight operation.
   */
  private async publishLoadedRoot(
    root: protobuf.Root,
    filename: string,
    messageName: string | undefined,
    sourceLabel: string
  ): Promise<{ messageName: string; root: protobuf.Namespace }> {
    const schemaTopicName = `/.schema/proto:${filename}`;

    let encoded: Uint8Array;
    try {
      const descriptor = root.toDescriptor('proto3');
      if (!descriptor?.file?.length) {
        throw new Error('No file descriptor found in proto');
      }
      const fileDescriptorProto = descriptor.file[0];
      encoded = this.fileDescriptorProtoType.encode(fileDescriptorProto).finish();
    } catch (error) {
      throw new Error(
        `Failed to extract/encode FileDescriptorProto from "${sourceLabel}": ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const detectedMessageName = messageName || this.getMessageNameFromProto(root);

    let schemaTopic = this.client.getTopicFromName<Uint8Array>(schemaTopicName);
    if (!schemaTopic) {
      schemaTopic = new NetworkTablesTopic<Uint8Array>(
        this.client,
        schemaTopicName,
        NetworkTablesTypeInfos.kUint8Array
      );
    }

    const pubuid = this.client.messenger.getNextPubUID();
    schemaTopic['_pubuid'] = pubuid;
    await this.client.messenger.publish({
      name: schemaTopicName,
      pubuid,
      type: 'proto:FileDescriptorProto',
      properties: { retained: true },
    });

    this.client.updateServer(schemaTopic, encoded);

    this.schemaCache.set(schemaTopicName, root);
    this.schemaCache.set(filename, root);
    this.registeredSchemas.add(schemaTopicName);

    return { messageName: detectedMessageName, root };
  }
}
