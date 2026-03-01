import { NetworkTablesPrefixTopic } from './pubsub/prefix-topic';
import { NetworkTablesProtobufTopic } from './pubsub/protobuf-topic';
import { NetworkTablesStructTopic } from './pubsub/struct-topic';
import { PubSubClient } from './pubsub/pubsub';
import { NetworkTablesTopic } from './pubsub/topic';
import { NetworkTablesTypeInfos } from './types/types';
import {
  defaultLogger,
  setLogLevel,
  setModuleLogLevel,
  getModuleLogLevel,
  type LoggerModule,
  type LogLevel,
} from './util/logger';
import { Util } from './util/util';

import type { NetworkTablesTypeInfo, NetworkTablesTypes } from './types/types';

import type { z } from 'zod';

/** Properties for creating the NetworkTables class. */
interface NT_PROPS {
  /** The team number of the robot (overrides URI). */
  team?: number;
  /** The URI of the robot (not used if team is specified). */
  uri?: string;
  /** The port to connect to the robot on. */
  port: number;
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

  /**
   * Creates a new NetworkTables instance.
   * @param props - The properties to use to create the instance.
   * @throws Error if the team number or URI is not provided.
   */
  private constructor(props: NT_PROPS) {
    if (props.team) {
      this.uri = Util.getRobotAddress(props.team);
      defaultLogger.debug('Instance created', { team: props.team, uri: this.uri, port: props.port });
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
   * @returns The NetworkTables instance.
   * @throws Error if the team number is not provided.
   */
  static getInstanceByTeam(team: number, port = 5810) {
    const key = `${Util.getRobotAddress(team)}:${port}`;
    let instance = this._instances.get(key);
    if (!instance) {
      instance = new this({ team, port });
    } else {
      defaultLogger.debug('Instance retrieved from cache', { team, uri: Util.getRobotAddress(team), port });
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
    const connected = this._client.messenger.socket.isConnected();
    defaultLogger.debug('Connection status queried', { connected, uri: this.uri, port: this.port });
    return connected;
  }

  /**
   * Returns whether the robot is currently connecting.
   * @returns Whether the robot is connecting.
   */
  isRobotConnecting() {
    const connecting = this._client.messenger.socket.isConnecting();
    defaultLogger.debug('Connection status queried', { connecting, uri: this.uri, port: this.port });
    return connecting;
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
   * @param immediateNotify - Whether to immediately notify the callback of the current connection status.
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
   * Creates a new topic.
   * @param name - The name of the topic.
   * @param typeInfo - The type information of the topic. Protobuf types are not allowed (use createProtobufTopic instead).
   * @param defaultValue - The default value of the topic.
   * @returns The topic.
   * @remarks
   * If a topic with the same name and type already exists (from a previous call to `createTopic`),
   * the existing topic instance is returned and the `defaultValue` from this call is ignored. Only the
   * `defaultValue` from the first call to `createTopic` for a given topic name and type will be used.
   * If a topic with the same name but different type exists, an error is thrown.
   */
  createTopic<T extends NetworkTablesTypes>(name: string, typeInfo: NetworkTablesTypeInfo, defaultValue?: T) {
    if (typeInfo === NetworkTablesTypeInfos.kProtobuf) {
      throw new Error(
        `Protobuf types are not allowed in createTopic. Use createProtobufTopic('${name}', options) instead for proper encoding/decoding support.`
      );
    }
    if (typeof typeInfo[1] === 'string' && typeInfo[1].startsWith('struct:')) {
      throw new Error(
        `Struct types are not allowed in createTopic. Use createStructTopic('${name}', options) instead for proper encoding/decoding support.`
      );
    }
    defaultLogger.debug('Topic created', { topicName: name, type: typeInfo[1] });
    return new NetworkTablesTopic<T>(this._client, name, typeInfo, defaultValue);
  }

  /**
   * Creates a new protobuf topic.
   * @param name - The name of the topic.
   * @param options - Optional configuration for the protobuf topic.
   * @param options.defaultValue - The default value of the topic.
   * @param options.validator - Optional Zod schema to validate decoded protobuf values at runtime.
   * @param options.protoFilePath - Optional path to the .proto file. If provided, the schema will be registered automatically when publishing.
   * @returns The topic.
   * @remarks
   * If a topic with the same name already exists (from a previous call to `createProtobufTopic`),
   * the existing topic instance is returned and the options from this call are applied to it,
   * so the returned instance is always consistently initialized with the requested options.
   */
  createProtobufTopic<T extends object>(
    name: string,
    options?: {
      defaultValue?: T;
      validator?: z.ZodSchema<T>;
      protoFilePath?: string;
    }
  ) {
    const existingTopic = this._client.getTopicFromName(name);
    if (existingTopic instanceof NetworkTablesProtobufTopic) {
      (existingTopic as NetworkTablesProtobufTopic<T>).applyOptions(options);
      return existingTopic as NetworkTablesProtobufTopic<T>;
    }
    return new NetworkTablesProtobufTopic<T>(this._client, name, options);
  }

  /**
   * Creates a new struct topic.
   * @param name - The name of the topic.
   * @param options - Optional typeName, schema, defaultValue, validator.
   * @returns The struct topic. If a topic with the same name already exists (from a previous createStructTopic),
   * the existing topic is returned and options are applied.
   * @remarks Struct fields using `int64` or `uint64` are returned as JavaScript `number`,
   * which loses precision beyond ±2^53 (`Number.MAX_SAFE_INTEGER`). No built-in WPILib
   * struct types are affected — they all use `double`.
   */
  createStructTopic<T extends Record<string, unknown> | Record<string, unknown>[]>(
    name: string,
    options?: {
      typeName?: string;
      schema?: string;
      defaultValue?: T;
      validator?: z.ZodSchema<T>;
    }
  ): NetworkTablesStructTopic<T> {
    const existingTopic = this._client.getTopicFromName(name);
    if (existingTopic instanceof NetworkTablesStructTopic) {
      if (options?.typeName) {
        const requestedBase = options.typeName.replace(/\[\]$/, '');
        const existingType = (existingTopic as NetworkTablesStructTopic<T>).typeInfo[1];
        const requestedPlain = `struct:${requestedBase}`;
        const requestedArray = `struct:${requestedBase}[]`;
        if (existingType !== requestedPlain && existingType !== requestedArray) {
          defaultLogger.warn('createStructTopic: typeName mismatch on reuse', {
            topicName: name,
            existingType,
            requestedTypeName: options.typeName,
          });
        }
      }
      (existingTopic as NetworkTablesStructTopic<T>).applyOptions(options);
      return existingTopic as NetworkTablesStructTopic<T>;
    }
    return new NetworkTablesStructTopic<T>(this._client, name, options);
  }

  /**
   * Creates a new topic with a prefix.
   * @param prefix - The prefix of the topic.
   * @returns The topic.
   */
  createPrefixTopic(prefix: string) {
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
