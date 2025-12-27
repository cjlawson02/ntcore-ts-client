import { NetworkTablesTypeInfos } from '../types/types';

import type { BinaryMessage, NetworkTablesTypeInfo, NetworkTablesTypes, TypeNum, TypeString } from '../types/types';

/**
 * Class for holding utility functions.
 */
export class Util {
  private static usedIds: Set<number> = new Set();

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

  static getNetworkTablesTypeFromTypeNum(typeNum: TypeNum) {
    switch (typeNum) {
      case NetworkTablesTypeInfos.kBoolean[0]:
        return NetworkTablesTypeInfos.kBoolean;
      case NetworkTablesTypeInfos.kDouble[0]:
        return NetworkTablesTypeInfos.kDouble;
      case NetworkTablesTypeInfos.kInteger[0]:
        return NetworkTablesTypeInfos.kInteger;
      case NetworkTablesTypeInfos.kString[0]:
        return NetworkTablesTypeInfos.kString;
      case NetworkTablesTypeInfos.kUint8Array[0]:
        return NetworkTablesTypeInfos.kUint8Array;
      case NetworkTablesTypeInfos.kBooleanArray[0]:
        return NetworkTablesTypeInfos.kBooleanArray;
      case NetworkTablesTypeInfos.kDoubleArray[0]:
        return NetworkTablesTypeInfos.kDoubleArray;
      case NetworkTablesTypeInfos.kIntegerArray[0]:
        return NetworkTablesTypeInfos.kIntegerArray;
      case NetworkTablesTypeInfos.kStringArray[0]:
        return NetworkTablesTypeInfos.kStringArray;
      default:
        throw new Error(`Invalid type number: ${typeNum}`);
    }
  }

  /**
   * Get the type info from a type string.
   * @param typeString - The type string.
   * @returns The type info.
   */
  static getNetworkTablesTypeFromTypeString(typeString: TypeString) {
    switch (typeString) {
      case NetworkTablesTypeInfos.kBoolean[1]:
        return NetworkTablesTypeInfos.kBoolean;
      case NetworkTablesTypeInfos.kDouble[1]:
        return NetworkTablesTypeInfos.kDouble;
      case NetworkTablesTypeInfos.kInteger[1]:
        return NetworkTablesTypeInfos.kInteger;
      case NetworkTablesTypeInfos.kString[1]:
        return NetworkTablesTypeInfos.kString;
      case NetworkTablesTypeInfos.kUint8Array[1]:
        return NetworkTablesTypeInfos.kUint8Array;
      case NetworkTablesTypeInfos.kBooleanArray[1]:
        return NetworkTablesTypeInfos.kBooleanArray;
      case NetworkTablesTypeInfos.kDoubleArray[1]:
        return NetworkTablesTypeInfos.kDoubleArray;
      case NetworkTablesTypeInfos.kIntegerArray[1]:
        return NetworkTablesTypeInfos.kIntegerArray;
      case NetworkTablesTypeInfos.kStringArray[1]:
        return NetworkTablesTypeInfos.kStringArray;
      default:
        throw new Error(`Unsupported type string: ${typeString}`);
    }
  }

  /**
   * Create a binary message from a topic.
   * @param topicId - The topic ID.
   * @param timestamp - The timestamp of the message, matching the server.
   * @param data - The data.
   * @param typeInfo - The type info.
   * @returns The binary message.
   */
  static createBinaryMessage(
    topicId: number,
    timestamp: number,
    data: NetworkTablesTypes,
    typeInfo?: NetworkTablesTypeInfo
  ): BinaryMessage {
    const type = typeInfo ?? this.getNetworkTablesTypeFromObject(data);
    return [topicId, timestamp, type[0], data];
  }

  /**
   * Splits an ArrayBuffer into chunks of a specified size.
   * @param buffer - The ArrayBuffer to split.
   * @param chunkSize - The size of each chunk, in bytes.
   * @returns An array of ArrayBuffer chunks.
   * @throws Error If the chunk size is not divisible by the ArrayBuffer size.
   */
  static splitArrayBuffer(buffer: ArrayBuffer, chunkSize: number) {
    if (buffer.byteLength % chunkSize !== 0) {
      throw new Error('Chunk size must be divisible by ArrayBuffer size');
    }
    const chunks: ArrayBuffer[] = [];
    let offset = 0;
    while (offset < buffer.byteLength) {
      const chunk = buffer.slice(offset, offset + chunkSize);
      chunks.push(chunk);
      offset += chunkSize;
    }
    return chunks;
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
