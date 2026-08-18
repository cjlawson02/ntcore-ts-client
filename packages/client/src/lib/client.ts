import { NetworkTablesPrefixTopic } from './pubsub/prefix-topic';
import { NetworkTablesProtobufTopic, type ProtobufTopicOptions } from './pubsub/protobuf-topic';
import { NetworkTablesJsonTopic, type JsonTopicOptions } from './pubsub/json-topic';
import { NetworkTablesStructTopic } from './pubsub/struct-topic';
import { PubSubClient } from './pubsub/pubsub';
import { NetworkTablesTopic } from './pubsub/topic';
import { isStructTypeDescriptor, type StructTypeDescriptor, type StructTypeName } from './struct/geometry';
import { NetworkTablesTypeInfos } from './types/types';
import {
  defaultLogger,
  setLogLevel,
  setModuleLogLevel,
  getModuleLogLevel,
  type LoggerModule,
  type LogLevel,
} from './util/logger';
import { Util, getRobotAddress, type RobotPlatform } from './util/util';

import type { NetworkTablesTypeInfo, NetworkTablesTypes } from './types/types';

import type { z } from 'zod';

/** Options for getStructTopic when using an options object. */
export interface StructTopicOptions<T extends object | object[] = object> {
  typeName?: StructTypeName;
  schema?: string;
  defaultValue?: T;
  validator?: z.ZodSchema<T>;
}

/** Properties for creating the NetworkTables class. */
interface NT_PROPS {
  /** The team number of the robot (overrides URI). */
  team?: number;
  /** The URI of the robot (not used if team is specified). */
  uri?: string;
  /** The port to connect to the robot on. */
  port: number;
  /** Controller used to resolve `team` to a hostname. Ignored when `uri` is set. */
  platform?: RobotPlatform;
}

/** NetworkTables class for interacting with NetworkTables over a WebSocket connection. */
export class NetworkTables {
  /** The URI of the server. */
  private uri: string;

  private port: number;

  /** The PubSubClient instance used to establish and manage the connection to the robot. */
  private _client: PubSubClient;

  /** The instance of the NetworkTables class. */
  private static _instances = new Map<string, NetworkTables>();
  private retainCount = 0;

  /**
   * Creates a new NetworkTables instance.
   * @param props - The properties to use to create the instance.
   * @throws Error if the team number or URI is not provided.
   */
  private constructor(props: NT_PROPS) {
    if (props.team) {
      this.uri = getRobotAddress(props.team, props.platform);
      defaultLogger.debug('Instance created', {
        team: props.team,
        platform: props.platform ?? 'roborio',
        uri: this.uri,
        port: props.port,
      });
    } else if (props.uri) {
      this.uri = props.uri;
      defaultLogger.debug('Instance created', { uri: this.uri, port: props.port });
    } else {
      throw new Error('Must provide either a team number or URI.');
    }

    this.port = props.port;

    NetworkTables._instances.set(`${this.uri}:${this.port}`, this);

    this._client = PubSubClient.getInstance(Util.createServerUrl(this.uri, this.port));
  }

  /**
   * Creates a new NetworkTables instance if it does not exist.
   * @param team - The team number of the robot.
   * @param port - The port to connect to the robot on. Defaults to 5810.
   * @param platform - RoboRIO mDNS (`roborio-<team>-frc.local`, default) or SystemCore team IP (`10.TE.AM.2`).
   * @returns The NetworkTables instance.
   * @throws Error if the team number is not provided.
   */
  static getInstanceByTeam(team: number, port = 5810, platform: RobotPlatform = 'roborio') {
    const uri = getRobotAddress(team, platform);
    const key = `${uri}:${port}`;
    let instance = this._instances.get(key);
    if (!instance) {
      instance = new this({ team, port, platform });
    } else {
      defaultLogger.debug('Instance retrieved from cache', { team, platform, uri, port });
    }
    return instance;
  }

  /**
   * Creates a new NetworkTables instance if it does not exist.
   * @param uri - The URI of the robot.
   * @param port - The port to connect to the robot on. Defaults to 5810.
   * @returns The NetworkTables instance.
   * @throws Error if the URI is not provided.
   */
  static getInstanceByURI(uri: string, port = 5810) {
    const key = `${uri}:${port}`;
    let instance = this._instances.get(key);
    if (!instance) {
      instance = new this({ uri, port });
    } else {
      defaultLogger.debug('Instance retrieved from cache', { uri, port });
    }
    return instance;
  }

  /**
   * Returns the URI of the server.
   * @returns The robot address.
   */
  getURI(): string {
    return this.uri;
  }

  /**
   * Changes the URI of the server.
   * @param uri - The new URI of the server.
   * @param port - The port to connect to the server on. Defaults to 5810.
   */
  changeURI(uri: string, port = 5810) {
    const oldUri = this.uri;
    const oldPort = this.port;
    defaultLogger.info('URI changed', { oldUri, oldPort, newUri: uri, newPort: port });
    // Update instance map so getInstanceByURI/getInstanceByTeam return this instance for the new target
    NetworkTables._instances.delete(`${oldUri}:${oldPort}`);
    this.uri = uri;
    this.port = port;
    NetworkTables._instances.set(`${this.uri}:${this.port}`, this);
    this._client.reinstantiate(Util.createServerUrl(uri, port));
  }

  /**
   * Changes the server using a team number.
   * @param team - The team number of the robot.
   * @param port - The port to connect to the server on. Defaults to 5810.
   * @param platform - RoboRIO mDNS (default) or SystemCore team IP.
   */
  changeTeam(team: number, port = 5810, platform: RobotPlatform = 'roborio') {
    this.changeURI(getRobotAddress(team, platform), port);
  }

  /**
   * Returns the port to connect to the robot on.
   * @returns The port number.
   */
  getPort() {
    return this.port;
  }

  /**
   * Returns whether the robot is currently connected.
   * @returns Whether the robot is connected.
   */
  isRobotConnected() {
    return this._client.messenger.socket.isConnected();
  }

  /**
   * Returns whether the robot is currently connecting.
   * @returns Whether the robot is connecting.
   */
  isRobotConnecting() {
    return this._client.messenger.socket.isConnecting();
  }

  /**
   * Returns the best round-trip time to the robot in milliseconds.
   * @returns RTT in ms, or -1 if not connected or not yet measured.
   */
  getRttMs(): number {
    return this._client.messenger.socket.getBestRttMs();
  }

  /**
   * Adds a listener for robot connection status updates.
   * @param callback - The callback to call when the connection status changes.
   * @param immediateNotify - When true, also notifies once with the current status on a microtask after
   *   this method returns (so the returned disposer can be called from that first notification).
   * @returns A function to remove the listener.
   */
  addRobotConnectionListener(callback: (_: boolean) => void, immediateNotify?: boolean) {
    defaultLogger.debug('Connection listener added', { immediateNotify, uri: this.uri, port: this.port });
    return this._client.messenger.socket.addConnectionListener(callback, immediateNotify);
  }

  /**
   * Stops automatic reconnection to the server. Use when the user dismisses the connection
   * overlay (e.g. Escape) so the client does not keep trying to reconnect in the background.
   */
  stopAutoConnect(): void {
    this._client.messenger.socket.stopAutoConnect();
  }

  /**
   * Resumes automatic reconnection to the server after a previous call to stopAutoConnect.
   */
  startAutoConnect(): void {
    this._client.messenger.socket.startAutoConnect();
  }

  /**
   * Disconnects from the server, unsubscribes/unpublishes all topics, and drops this instance
   * (and the underlying PubSubClient/Messenger/Socket singletons) so they do not leak.
   */
  close(): void {
    defaultLogger.info('Closing NetworkTables instance', { uri: this.uri, port: this.port });
    this.retainCount = 0;
    this._client.cleanup();
    this._client.releaseInstance();
    NetworkTables._instances.delete(`${this.uri}:${this.port}`);
  }

  /**
   * Increments the retain count used by NtcoreProvider so multiple trees can share
   * this singleton without tearing it down on the first unmount.
   */
  retain(): void {
    this.retainCount++;
  }

  /**
   * Decrements the retain count and calls {@link close} when it reaches zero.
   */
  release(): void {
    this.retainCount--;
    if (this.retainCount <= 0) {
      this.close();
    }
  }

  /**
   * Creates a new JSON topic. Wire format is a JSON string with type `'json'`.
   * @param name - The name of the topic.
   * @param typeInfo - Must be {@link NetworkTablesTypeInfos.kJson}.
   * @param defaultValue - The default parsed JSON value of the topic.
   */
  createTopic<T extends object>(
    name: string,
    typeInfo: typeof NetworkTablesTypeInfos.kJson,
    defaultValue?: T
  ): NetworkTablesJsonTopic<T>;
  /**
   * Creates a new topic.
   * @param name - The name of the topic.
   * @param typeInfo - The type information of the topic. Protobuf types are not allowed (use getProtobufTopic instead).
   *   Struct types are not allowed (use getStructTopic instead). JSON types return a {@link NetworkTablesJsonTopic}.
   * @param defaultValue - The default value of the topic.
   * @returns The topic.
   * @remarks
   * If a topic with the same name and type already exists (from a previous call to `createTopic`),
   * the existing topic instance is returned and the `defaultValue` from this call is ignored. Only the
   * `defaultValue` from the first call to `createTopic` for a given topic name and type will be used.
   * If a topic with the same name but different type exists, an error is thrown.
   */
  createTopic<T extends NetworkTablesTypes>(
    name: string,
    typeInfo: NetworkTablesTypeInfo,
    defaultValue?: T
  ): NetworkTablesTopic<T>;
  createTopic(name: string, typeInfo: NetworkTablesTypeInfo, defaultValue?: NetworkTablesTypes | object) {
    if (typeInfo === NetworkTablesTypeInfos.kProtobuf || typeInfo[1] === 'protobuf') {
      throw new Error(
        `Protobuf types are not allowed in createTopic. Use getProtobufTopic('${name}', options) instead for proper encoding/decoding support.`
      );
    }
    if (typeof typeInfo[1] === 'string' && typeInfo[1].startsWith('struct:')) {
      throw new Error(
        `Struct types are not allowed in createTopic. Use getStructTopic('${name}', options) instead for proper encoding/decoding support.`
      );
    }
    defaultLogger.debug('Topic created', { topicName: name, type: typeInfo[1] });
    if (typeInfo === NetworkTablesTypeInfos.kJson || typeInfo[1] === 'json') {
      return this.getJsonTopic(name, defaultValue as object | undefined);
    }
    return new NetworkTablesTopic(this._client, name, typeInfo, defaultValue as NetworkTablesTypes | undefined);
  }

  getBooleanTopic(name: string, defaultValue?: boolean): NetworkTablesTopic<boolean> {
    return this.createTopic(name, NetworkTablesTypeInfos.kBoolean, defaultValue);
  }

  getDoubleTopic(name: string, defaultValue?: number): NetworkTablesTopic<number> {
    return this.createTopic(name, NetworkTablesTypeInfos.kDouble, defaultValue);
  }

  getIntegerTopic(name: string, defaultValue?: number): NetworkTablesTopic<number> {
    return this.createTopic(name, NetworkTablesTypeInfos.kInteger, defaultValue);
  }

  getFloatTopic(name: string, defaultValue?: number): NetworkTablesTopic<number> {
    return this.createTopic(name, NetworkTablesTypeInfos.kFloat, defaultValue);
  }

  getStringTopic(name: string, defaultValue?: string): NetworkTablesTopic<string> {
    return this.createTopic(name, NetworkTablesTypeInfos.kString, defaultValue);
  }

  getBooleanArrayTopic(name: string, defaultValue?: boolean[]): NetworkTablesTopic<boolean[]> {
    return this.createTopic(name, NetworkTablesTypeInfos.kBooleanArray, defaultValue);
  }

  getDoubleArrayTopic(name: string, defaultValue?: number[]): NetworkTablesTopic<number[]> {
    return this.createTopic(name, NetworkTablesTypeInfos.kDoubleArray, defaultValue);
  }

  getIntegerArrayTopic(name: string, defaultValue?: number[]): NetworkTablesTopic<number[]> {
    return this.createTopic(name, NetworkTablesTypeInfos.kIntegerArray, defaultValue);
  }

  getFloatArrayTopic(name: string, defaultValue?: number[]): NetworkTablesTopic<number[]> {
    return this.createTopic(name, NetworkTablesTypeInfos.kFloatArray, defaultValue);
  }

  getStringArrayTopic(name: string, defaultValue?: string[]): NetworkTablesTopic<string[]> {
    return this.createTopic(name, NetworkTablesTypeInfos.kStringArray, defaultValue);
  }

  getRawTopic(name: string, defaultValue?: Uint8Array): NetworkTablesTopic<Uint8Array> {
    return this.createTopic(name, NetworkTablesTypeInfos.kUint8Array, defaultValue);
  }

  getJsonTopic<T extends object>(
    name: string,
    defaultValue?: T,
    options?: JsonTopicOptions<T>
  ): NetworkTablesJsonTopic<T> {
    const existingTopic = this._client.getTopicFromName(name);
    if (existingTopic instanceof NetworkTablesJsonTopic) {
      (existingTopic as NetworkTablesJsonTopic<T>).applyOptions({
        defaultValue,
        validator: options?.validator,
      });
      return existingTopic as NetworkTablesJsonTopic<T>;
    }
    return new NetworkTablesJsonTopic(this._client, name, defaultValue, options);
  }

  /**
   * Creates a protobuf topic.
   * If a topic with the same name already exists, the existing instance is returned and options are applied.
   */
  getProtobufTopic<T extends object>(name: string, options?: ProtobufTopicOptions<T>) {
    const existingTopic = this._client.getTopicFromName(name);
    if (existingTopic instanceof NetworkTablesProtobufTopic) {
      (existingTopic as NetworkTablesProtobufTopic<T>).applyOptions(options);
      return existingTopic as NetworkTablesProtobufTopic<T>;
    }
    return new NetworkTablesProtobufTopic<T>(this._client, name, options);
  }

  /**
   * Creates a struct topic from a WPILib-style type descriptor (e.g. `Pose2d`).
   * Infers `NetworkTablesStructTopic<Pose2d>` from `nt.getStructTopic(name, Pose2d)`.
   */
  getStructTopic<T extends object>(
    name: string,
    type: StructTypeDescriptor<T>,
    options?: Omit<StructTopicOptions<T>, 'typeName' | 'validator'>
  ): NetworkTablesStructTopic<T>;
  /**
   * Creates a struct topic.
   * @param name - The name of the topic.
   * @param options - Optional typeName, schema, defaultValue, validator.
   *   `typeName` (or a type descriptor as the second argument) is required when creating a new topic.
   *   Reusing an existing topic may omit `typeName`.
   * @returns The struct topic. If a topic with the same name already exists, the existing topic is returned.
   * @remarks Struct fields using `int64` or `uint64` are returned as JavaScript `number`,
   * which loses precision beyond ±2^53 (`Number.MAX_SAFE_INTEGER`). No built-in WPILib
   * struct types are affected — they all use `double`.
   */
  getStructTopic<T extends object | object[]>(
    name: string,
    options?: StructTopicOptions<T>
  ): NetworkTablesStructTopic<T>;
  getStructTopic<T extends object | object[]>(
    name: string,
    typeOrOptions?: StructTypeDescriptor<object> | StructTopicOptions<T>,
    maybeOptions?: Omit<StructTopicOptions<T>, 'typeName' | 'validator'>
  ): NetworkTablesStructTopic<T> {
    const options: StructTopicOptions<T> = isStructTypeDescriptor(typeOrOptions)
      ? {
          typeName: typeOrOptions.typeName,
          validator: typeOrOptions.schema as z.ZodSchema<T>,
          defaultValue: maybeOptions?.defaultValue,
          schema: maybeOptions?.schema,
        }
      : (typeOrOptions ?? {});

    const existingTopic = this._client.getTopicFromName(name);
    if (existingTopic instanceof NetworkTablesStructTopic) {
      if (options.typeName) {
        const requestedType = `struct:${options.typeName}`;
        const existingType = (existingTopic as NetworkTablesStructTopic<T>).typeInfo[1];
        if (existingType !== requestedType) {
          throw new Error(
            `getStructTopic: type mismatch for topic "${name}". ` +
              `Existing type "${existingType}" does not match requested typeName "${options.typeName}". ` +
              `A struct topic's type is immutable once created.`
          );
        }
      }
      (existingTopic as NetworkTablesStructTopic<T>).applyOptions(options);
      return existingTopic as NetworkTablesStructTopic<T>;
    }
    if (!options.typeName) {
      throw new Error(
        `getStructTopic: cannot create topic "${name}" without a type. Pass a descriptor (e.g. Pose2d) or { typeName }.`
      );
    }
    return new NetworkTablesStructTopic<T>(this._client, name, options);
  }

  /**
   * Creates a prefix topic (wildcard subscription).
   * @param prefix - The prefix of the topic.
   * @returns The topic.
   */
  getPrefixTopic(prefix: string) {
    defaultLogger.debug('Prefix topic created', { prefix });
    return new NetworkTablesPrefixTopic(this._client, prefix);
  }

  /**
   * Sets the global log level for all modules.
   * @param level - The log level to set.
   */
  static setLogLevel(level: LogLevel): void {
    setLogLevel(level);
  }

  /**
   * Sets the log level for a specific module.
   * @param module - The module name ('socket', 'messenger', 'pubsub', or 'default').
   * @param level - The log level to set.
   */
  static setModuleLogLevel(module: LoggerModule, level: LogLevel): void {
    setModuleLogLevel(module, level);
  }

  /**
   * Gets the current log level for a specific module.
   * @param module - The module name ('socket', 'messenger', 'pubsub', or 'default').
   * @returns The current log level.
   */
  static getModuleLogLevel(module: LoggerModule = 'default'): LogLevel {
    return getModuleLogLevel(module);
  }
}
