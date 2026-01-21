import { NetworkTablesPrefixTopic } from './pubsub/prefix-topic';
import { PubSubClient } from './pubsub/pubsub';
import { NetworkTablesTopic } from './pubsub/topic';
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
    this.uri = uri;
    this.port = port;
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
   * Creates a new topic.
   * @param name - The name of the topic.
   * @param typeInfo - The type information of the topic.
   * @param defaultValue - The default value of the topic.
   * @returns The topic.
   */
  createTopic<T extends NetworkTablesTypes>(name: string, typeInfo: NetworkTablesTypeInfo, defaultValue?: T) {
    defaultLogger.debug('Topic created', { topicName: name, type: typeInfo[1] });
    return new NetworkTablesTopic<T>(this._client, name, typeInfo, defaultValue);
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
