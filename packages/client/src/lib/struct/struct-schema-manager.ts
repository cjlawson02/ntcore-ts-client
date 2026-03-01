import { NetworkTablesTypeInfos } from '../types/types';
import type { AnnounceMessageParams } from '../types/types';
import { parseSchema, buildStructDescriptor } from './struct-parser';
import type { ParsedField } from './struct-parser';
import type { StructDescriptor } from './struct-descriptor';
import { getBuiltInDescriptor, getBuiltInSchemaString } from './built-in-schemas';
import { NetworkTablesPrefixTopic } from '../pubsub/prefix-topic';
import { NetworkTablesTopic } from '../pubsub/topic';
import type { PubSubClient } from '../pubsub/pubsub';
import { pubsubLogger } from '../util/logger';

const STRUCT_SCHEMA_PREFIX = '/.schema/struct:';

/**
 * Manages struct schema fetching and caching from NetworkTables.
 * Subscribes to `/.schema/struct:*` and parses/caches descriptors by type name.
 */
export class StructSchemaManager {
  private readonly parsedFieldsCache = new Map<string, ParsedField[]>();
  private readonly descriptorCache = new Map<string, StructDescriptor>();
  private readonly schemaStringCache = new Map<string, string>();
  private readonly pendingTypeNames = new Set<string>();
  /** Type names for which we have already published a schema topic (avoids redundant republish). */
  private readonly publishedSchemaTypes = new Set<string>();
  private readonly schemaPrefixTopic: NetworkTablesPrefixTopic;
  private readonly client: PubSubClient;

  constructor(client: PubSubClient) {
    this.client = client;
    // Create a prefix topic for all struct schema topics
    this.schemaPrefixTopic = new NetworkTablesPrefixTopic(client, STRUCT_SCHEMA_PREFIX);
    // Subscribe to all schema topics and automatically decode and cache them
    this.schemaPrefixTopic.subscribe(
      (value, params) => {
        this.handleSchemaUpdate(value as Uint8Array | null, params);
      },
      {},
      undefined,
      true
    );
  }

  /**
   * Handles schema updates from the prefix topic subscription.
   * Decodes UTF-8 bytes to string, parses schema, and caches descriptor when dependencies are ready.
   * @param value - The value of the schema update (null when a topic is unannounced).
   * @param params - The parameters of the announce message.
   */
  private handleSchemaUpdate(value: Uint8Array | null, params: AnnounceMessageParams): void {
    if (value == null) return;
    if (!ArrayBuffer.isView(value)) return;

    const typeName = params.name.substring(STRUCT_SCHEMA_PREFIX.length);
    if (!typeName) return;

    const schemaString = new TextDecoder().decode(value);
    this.schemaStringCache.set(typeName, schemaString);
    let parsed: ParsedField[];
    try {
      parsed = parseSchema(schemaString);
    } catch (err) {
      pubsubLogger.debug('Failed to parse struct schema', { typeName, error: err });
      return;
    }
    this.parsedFieldsCache.set(typeName, parsed);
    this.pendingTypeNames.add(typeName);
    this.tryBuildPending();
  }

  private getNested(name: string): StructDescriptor | null {
    return this.descriptorCache.get(name) ?? getBuiltInDescriptor(name) ?? null;
  }

  private tryBuildPending(): void {
    while (this.pendingTypeNames.size > 0) {
      let builtAny = false;
      for (const typeName of this.pendingTypeNames) {
        const fields = this.parsedFieldsCache.get(typeName);
        if (!fields || this.descriptorCache.has(typeName)) continue;
        try {
          const descriptor = buildStructDescriptor(typeName, fields, (n) => this.getNested(n));
          this.descriptorCache.set(typeName, descriptor);
          this.descriptorCache.set(`struct:${typeName}`, descriptor);
          this.pendingTypeNames.delete(typeName);
          builtAny = true;
        } catch (err) {
          pubsubLogger.debug('Deferred struct descriptor build', { typeName, error: err });
        }
      }
      if (!builtAny) break;
    }
  }

  /**
   * Returns the struct descriptor for the given type name or type string (e.g. "Pose2d" or "struct:Pose2d").
   * Returns null if not in cache and not a built-in (built-ins are resolved on first use).
   */
  fetchDescriptor(typeNameOrTypeString: string): StructDescriptor | null {
    const typeName = typeNameOrTypeString.startsWith('struct:') ? typeNameOrTypeString.slice(7) : typeNameOrTypeString;
    const cached = this.descriptorCache.get(typeName) ?? this.descriptorCache.get(`struct:${typeName}`);
    if (cached) return cached;
    const builtIn = getBuiltInDescriptor(typeName);
    if (builtIn) return builtIn;
    return null;
  }

  hasSchema(typeString: string): boolean {
    return this.fetchDescriptor(typeString) != null;
  }

  clearCache(): void {
    this.parsedFieldsCache.clear();
    this.descriptorCache.clear();
    this.schemaStringCache.clear();
    this.pendingTypeNames.clear();
    this.publishedSchemaTypes.clear();
  }

  /**
   * Publishes nested struct schemas to NetworkTables (nested first), then the given descriptor's schema.
   * Used when publishing a struct topic so subscribers can decode.
   */
  async addSchema(descriptor: StructDescriptor): Promise<void> {
    const typeName = descriptor.typeName;
    const schemaTopicName = `${STRUCT_SCHEMA_PREFIX}${typeName}`;
    // Use unified in-flight protection from PubSubClient
    // Key format: "schema:" prefix to avoid conflicts with topic publishes
    const operationKey = `schema:${schemaTopicName}`;
    await this.client.getOrCreateInFlightOperation(operationKey, async () => {
      const nested = this.collectNestedTypeNames(descriptor);
      for (const name of nested) {
        await this.publishSchemaTopic(name);
      }
      await this.publishSchemaTopic(typeName);
    });
  }

  private collectNestedTypeNames(desc: StructDescriptor): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const visit = (d: StructDescriptor) => {
      for (const f of d.fields) {
        if (f.nestedDescriptor && !seen.has(f.nestedDescriptor.typeName)) {
          seen.add(f.nestedDescriptor.typeName);
          visit(f.nestedDescriptor);
          out.push(f.nestedDescriptor.typeName);
        }
      }
    };
    visit(desc);
    return out;
  }

  private async publishSchemaTopic(typeName: string): Promise<void> {
    if (this.publishedSchemaTypes.has(typeName)) return;

    const schemaTopicName = `${STRUCT_SCHEMA_PREFIX}${typeName}`;
    const schemaString = this.schemaStringCache.get(typeName) ?? getBuiltInSchemaString(typeName);
    if (!schemaString) return;

    const encodedSchema = new TextEncoder().encode(schemaString);

    let topic = this.client.getTopicFromName<Uint8Array>(schemaTopicName);
    if (!topic) {
      topic = new NetworkTablesTopic(this.client, schemaTopicName, NetworkTablesTypeInfos.kStructSchema);
    }

    if (topic.typeInfo[1] === 'structschema') {
      await topic.publish({ retained: true });
      topic.setValue(encodedSchema);
    } else {
      // Existing topic created with older code (e.g. type 'raw'); publish with custom type via messenger
      const pubuid = this.client.messenger.getNextPubUID();
      topic['_pubuid'] = pubuid;
      await this.client.messenger.publish({
        name: schemaTopicName,
        pubuid,
        type: 'structschema',
        properties: { retained: true },
      });
      this.client.updateServer(topic, encodedSchema);
    }

    this.publishedSchemaTypes.add(typeName);
  }
}
