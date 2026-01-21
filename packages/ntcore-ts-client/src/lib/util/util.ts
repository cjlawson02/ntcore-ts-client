import { NetworkTablesTypeInfos } from '../types/types';

import type { BinaryMessage, NetworkTablesTypeInfo, NetworkTablesTypes } from '../types/types';

/**
 * Class for holding utility functions.
 */
export class Util {
  /**
   * Get the DOM time in microseconds.
   * @returns The current microseconds of the DOM.
   */
  static getMicros() {
    return performance.now() * 1000;
  }

  /**
   * Given a number, determine if it is a double
   * @param x - A number.
   * @returns Whether it is a double.
   */
  static isDouble(x: number) {
    if (typeof x === 'number' && Number.isFinite(x) && !Number.isInteger(x)) {
      return true;
    }

    return false;
  }

  /**
   * Given a value, find the NT type number.
   * @param data - The value.
   * @returns The NT type number.
   */
  static getNetworkTablesTypeFromObject(data: NetworkTablesTypes): NetworkTablesTypeInfo {
    if (typeof data === 'boolean') {
      return NetworkTablesTypeInfos.kBoolean;
    } else if (typeof data === 'number') {
      if (this.isDouble(data)) {
        return NetworkTablesTypeInfos.kDouble;
      }
      return NetworkTablesTypeInfos.kInteger;
    } else if (typeof data === 'string') {
      return NetworkTablesTypeInfos.kString;
    } else if (data instanceof Uint8Array) {
      return NetworkTablesTypeInfos.kUint8Array;
    } else if (Array.isArray(data)) {
      if (new Set(data.map((x) => typeof x)).size <= 1) {
        if (typeof data[0] === 'boolean') {
          return NetworkTablesTypeInfos.kBooleanArray;
        } else if (typeof data[0] === 'number') {
          if ((data as number[]).every((e) => this.isDouble(e))) {
            return NetworkTablesTypeInfos.kDoubleArray;
          }
          return NetworkTablesTypeInfos.kIntegerArray;
        } else if (typeof data[0] === 'string') {
          return NetworkTablesTypeInfos.kStringArray;
        }
      }
    }
    throw new Error(`Invalid data for NT: ${data}`);
  }

  /**
   * Create a binary message from a topic.
   * @param pubuid - The topic's publisher UID.
   * @param timestamp - The timestamp of the message, matching the server.
   * @param data - The data.
   * @param typeInfo - The type info.
   * @returns The binary message.
   */
  static createBinaryMessage(
    pubuid: number,
    timestamp: number,
    data: NetworkTablesTypes,
    typeInfo?: NetworkTablesTypeInfo
  ): BinaryMessage {
    const type = typeInfo ?? this.getNetworkTablesTypeFromObject(data);
    return [pubuid, timestamp, type[0], data];
  }

  /**
   * Create a server URL for connecting to the robot.
   * @param uri - The URI of the robot.
   * @param port - The port of NT server on the robot.
   * @returns The server URL with a unique client ID.
   */
  static createServerUrl(uri: string, port: number): string {
    return `ws://${uri}:${port}/nt/ntcore-ts-${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * Get the mDNS address of a robot.
   * @param team - The team number.
   * @returns The mDNS address of the robot.
   */
  static getRobotAddress(team: number): string {
    return `roborio-${team}-frc.local`;
  }
}
