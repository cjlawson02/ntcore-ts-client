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
    typeInfo: NetworkTablesTypeInfo
  ): BinaryMessage {
    return [pubuid, timestamp, typeInfo[0], data];
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
