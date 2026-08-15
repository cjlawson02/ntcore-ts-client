import { NetworkTablesTypeInfos } from '../types/types';

import { pubsubLogger } from '../util/logger';

import { NetworkTablesTopic } from './topic';

import type { PubSubClient } from './pubsub';
import type { z } from 'zod';

/** Options for {@link NetworkTablesJsonTopic} and `getJsonTopic`. */
export interface JsonTopicOptions<T extends object> {
  validator?: z.ZodSchema<T>;
}

/**
 * JSON topic: public value is a parsed object; wire format is a JSON string with type `'json'`.
 */
export class NetworkTablesJsonTopic<T extends object> extends NetworkTablesTopic<string, T> {
  private decodedValue!: T | null;
  private _validator?: z.ZodSchema<T>;

  /**
   * Creates a new JSON topic.
   * @param client - The client that owns the topic.
   * @param name - The name of the topic.
   * @param defaultValue - The default public value of the topic.
   * @param options - Optional runtime validator for parsed JSON.
   */
  constructor(client: PubSubClient, name: string, defaultValue?: T, options?: JsonTopicOptions<T>) {
    super(client, name, NetworkTablesTypeInfos.kJson, undefined);
    if (this.decodedValue === undefined) {
      this.decodedValue = null;
    }
    this.applyOptions({ defaultValue, validator: options?.validator });
  }

  /**
   * Applies options to this topic. Used when returning a cached topic from getJsonTopic.
   * A later defaultValue is ignored once a value exists (matches createTopic).
   * A later `validator` replaces any previous validator because the topic is a singleton.
   * @param options - The options to apply.
   */
  applyOptions(options?: { defaultValue?: T } & JsonTopicOptions<T>): void {
    if (options?.validator !== undefined) {
      this._validator = options.validator;
    }
    if (options?.defaultValue !== undefined && this.decodedValue == null) {
      this.decodedValue = options.defaultValue;
    }
  }

  private maybeValidate(value: unknown): T {
    return (this._validator ? this._validator.parse(value) : value) as T;
  }

  /**
   * Gets the parsed JSON value of the topic.
   * @returns The parsed JSON object, or null if no value has been set.
   */
  override getValue(): T | null {
    return this.decodedValue;
  }

  /**
   * Sets the JSON value of the topic. The value is serialized with JSON.stringify for the wire.
   * @param value - The object to publish.
   */
  override setValue(value: T): void {
    if (!this.publisher) {
      pubsubLogger.debug('Publisher check failed before setValue', { topicName: this.name });
      throw new Error('Cannot set value on topic without being the publisher');
    }
    const validated = this.maybeValidate(value);
    const encoded = JSON.stringify(validated);
    this.decodedValue = validated;
    this.setWireValue(encoded);
    this.afterSetWireValue();
  }

  /**
   * Updates the value of the topic from the wire JSON string.
   * This should only be called by the PubSubClient.
   * @param value - The wire-format JSON string.
   * @param lastChangedTime - The server time of the last value change.
   */
  override updateValue(value: string, lastChangedTime: number): void {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`Bad JSON value: ${value}`);
    }
    this.decodedValue = this.maybeValidate(parsed);
    super.updateValue(value, lastChangedTime);
  }
}
