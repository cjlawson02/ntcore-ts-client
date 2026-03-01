import {
  type AnnounceMessage,
  type AnnounceMessageParams,
  type PublishMessageParams,
  type SubscribeOptions,
  type TopicProperties,
} from '../types/types';

import { pubsubLogger } from '../util/logger';

import { NetworkTablesTopic } from './topic';

import type { CallbackFn } from './base-topic';
import type { PubSubClient } from './pubsub';
import type { z } from 'zod';
import type { StructDescriptor } from '../struct/struct-descriptor';
import { pack, unpack, type StructPlainObject } from '../struct/struct-codec';
import { getBuiltInDescriptor } from '../struct/built-in-schemas';
import { parseSchema, buildStructDescriptor } from '../struct/struct-parser';

function structTypeInfo(typeName: string, isArray: boolean): [5, string] {
  return [5, isArray ? `struct:${typeName}[]` : `struct:${typeName}`];
}

export class NetworkTablesStructTopic<
  T extends StructPlainObject | StructPlainObject[],
> extends NetworkTablesTopic<Uint8Array> {
  private decodedValue: T | null = null;
  private _typeName: string;
  private _isArray: boolean;
  private _validator?: z.ZodSchema<T>;
  private _descriptor: StructDescriptor | null = null;

  constructor(
    client: PubSubClient,
    name: string,
    options?: {
      typeName?: string;
      schema?: string;
      defaultValue?: T;
      validator?: z.ZodSchema<T>;
    }
  ) {
    const typeName = options?.typeName ?? '';
    const isArray = typeName.endsWith('[]');
    const baseTypeName = isArray ? typeName.slice(0, -2) : typeName;
    super(client, name, structTypeInfo(baseTypeName || 'Unknown', isArray), undefined);
    this._typeName = baseTypeName || typeName;
    this._isArray = isArray;
    this._validator = options?.validator;
    if (options?.defaultValue !== undefined) {
      this.decodedValue = options.defaultValue;
    }
    if (options?.schema) {
      try {
        const fields = parseSchema(options.schema);
        const getNested = (n: string) => client.structSchemaManager.fetchDescriptor(n);
        this._descriptor = buildStructDescriptor(this._typeName, fields, getNested);
      } catch (err) {
        pubsubLogger.debug('Deferred struct descriptor build from schema option', { topicName: name, error: err });
      }
    }
    if (!this._descriptor && this._typeName) {
      this._descriptor = getBuiltInDescriptor(this._typeName) ?? null;
    }
  }

  applyOptions(options?: { typeName?: string; schema?: string; defaultValue?: T; validator?: z.ZodSchema<T> }): void {
    if (options?.validator !== undefined) this._validator = options.validator;
    if (options?.defaultValue !== undefined) this.decodedValue = options.defaultValue;
  }

  private ensureDescriptor(): StructDescriptor {
    if (this._descriptor) return this._descriptor;
    const d = this.client.structSchemaManager.fetchDescriptor(this._typeName);
    if (d) {
      this._descriptor = d;
      return d;
    }
    throw new Error(`Struct descriptor not found for type "${this._typeName}"`);
  }

  private maybeValidate<V>(value: V): T {
    return (this._validator ? this._validator.parse(value) : value) as T;
  }

  // @ts-expect-error - Base returns Uint8Array; we return decoded T
  override getValue(): T | null {
    return this.decodedValue;
  }

  // @ts-expect-error - Base expects Uint8Array; we accept T and encode
  override setValue(value: T): void {
    const validated = this.maybeValidate(value);
    this.decodedValue = validated;
    const encoded = this.encodeValue(validated);
    super.setValue(encoded);
  }

  private decodeValue(value: Uint8Array): T | null {
    try {
      const desc = this.ensureDescriptor();
      if (this._isArray) {
        const elemSize = desc.size;
        const n = value.length / elemSize;
        const arr: StructPlainObject[] = [];
        for (let i = 0; i < n; i++) {
          arr.push(unpack(new Uint8Array(value.buffer, value.byteOffset + i * elemSize, elemSize), desc));
        }
        return this.maybeValidate(arr);
      }
      const out = unpack(value, desc);
      return this.maybeValidate(out);
    } catch (err) {
      pubsubLogger.debug('Failed to decode struct value', { topicName: this.name, error: err });
      return null;
    }
  }

  private encodeValue(value: T): Uint8Array {
    const desc = this.ensureDescriptor();
    if (this._isArray) {
      const arr = value as unknown as StructPlainObject[];
      const elemSize = desc.size;
      const buf = new Uint8Array(arr.length * elemSize);
      for (let i = 0; i < arr.length; i++) {
        buf.set(pack(arr[i] as StructPlainObject, desc), i * elemSize);
      }
      return buf;
    }
    return pack(value as StructPlainObject, desc);
  }

  override updateValue(value: Uint8Array, lastChangedTime: number): void {
    this.decodedValue = this.decodeValue(value);
    super.updateValue(value, lastChangedTime);
  }

  override announce(params: AnnounceMessageParams): void {
    super.announce(params);
    const typeString = params.type;
    if (!this.name.startsWith('/.schema/') && typeString.startsWith('struct:')) {
      const suffix = typeString.slice(7);
      this._isArray = suffix.endsWith('[]');
      this._typeName = this._isArray ? suffix.slice(0, -2) : suffix;
      this._descriptor = this.client.structSchemaManager.fetchDescriptor(this._typeName) ?? this._descriptor;
    }
  }

  // Override to accept callback with decoded T; we pass decoded value in notifySubscribers
  // @ts-expect-error - Base expects CallbackFn<Uint8Array>; we accept (T | null, params) => void
  override subscribe(
    callback: (value: T | null, params: AnnounceMessageParams) => void,
    options: Omit<SubscribeOptions, 'prefix'> = {},
    id?: number,
    save = true
  ): number {
    return super.subscribe(callback as CallbackFn<Uint8Array>, options, id, save);
  }

  override notifySubscribers(): void {
    const params =
      this._announceParams ??
      ({
        name: this.name,
        id: -1,
        type: this.typeInfo[1],
        properties: this._publishProperties ?? {},
        ...(this._pubuid != null ? { pubuid: this._pubuid } : {}),
      } as AnnounceMessageParams);
    this.subscribers.forEach((info) =>
      (info.callback as (value: T | null, params: AnnounceMessageParams) => void)(this.decodedValue, params)
    );
  }

  override async publish(properties: TopicProperties = {}, id?: number): Promise<AnnounceMessage | void> {
    const operationKey = `publish:${this.name}`;
    return this.client.getOrCreateInFlightOperation(operationKey, async () => {
      if (this.publisher) {
        pubsubLogger.debug('Publish skipped', { topicName: this.name, reason: 'already publisher' });
        return;
      }
      const desc = this.ensureDescriptor();
      await this.client.structSchemaManager.addSchema(desc);
      const typeString = this._isArray ? `struct:${this._typeName}[]` : `struct:${this._typeName}`;
      const pubuid = id ?? this.client.messenger.getNextPubUID();
      this._pubuid = pubuid;
      this._publishProperties = properties;
      pubsubLogger.debug('Topic published', { topicName: this.name, pubuid, properties, type: typeString });
      const publishParams: PublishMessageParams = { type: typeString, name: this.name, pubuid, properties };
      return await this.client.messenger.publish(publishParams);
    });
  }
}
