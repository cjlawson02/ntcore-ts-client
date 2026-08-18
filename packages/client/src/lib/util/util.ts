import type { BinaryMessage, NetworkTablesTypeInfo, NetworkTablesTypes } from '../types/types';

/** Robot controller used to resolve a team number to a hostname. */
export type RobotPlatform = 'roborio' | 'systemcore';

/** SystemCore mDNS name (WPILib `SetServerFixed`). Use as a URI, not as a team mapping. */
export const SYSTEMCORE_MDNS_HOST = 'robot.local';

const ROBORIO_MDNS = /^roborio-(\d+)-frc\.local$/i;
const TEAM_IP = /^10\.(\d{1,3})\.(\d{1,3})\.2$/;

/** WPILib maximum team number for `10.TE.AM.2` addressing. */
const MAX_TEAM_NUMBER = 25599;

/**
 * Field/radio IPv4 for a team (`10.TE.AM.2`), matching WPILib `SetServerTeam`.
 * Team 973 → `10.9.73.2`.
 */
export function getTeamIpAddress(team: number): string {
  const n = Math.trunc(team);
  if (!Number.isFinite(n) || n < 1 || n > MAX_TEAM_NUMBER) {
    throw new Error(`Team number must be an integer from 1 to ${MAX_TEAM_NUMBER}`);
  }
  return `10.${Math.floor(n / 100)}.${n % 100}.2`;
}

/**
 * Hostname used for a team-number connection.
 * RoboRIO (default): `roborio-<team>-frc.local`.
 * SystemCore: `10.TE.AM.2` (WPILib `SetServerTeam`). Use {@link SYSTEMCORE_MDNS_HOST} as a URI for `robot.local`.
 */
export function getRobotAddress(team: number, platform: RobotPlatform = 'roborio'): string {
  if (platform === 'systemcore') {
    return getTeamIpAddress(team);
  }
  return `roborio-${team}-frc.local`;
}

export type ParsedRobotAddress =
  { platform: 'roborio'; team: number } | { platform: 'systemcore'; team: number } | { platform: null; team: null };

/** Detects a RoboRIO mDNS name or SystemCore team IP. Other hosts return `{ platform: null, team: null }`. */
export function parseRobotAddress(host: string): ParsedRobotAddress {
  const robo = host.match(ROBORIO_MDNS);
  if (robo) {
    return { platform: 'roborio', team: Number(robo[1]) };
  }
  const ip = host.match(TEAM_IP);
  if (ip) {
    const te = Number(ip[1]);
    const am = Number(ip[2]);
    if (te <= 255 && am <= 99) {
      const team = te * 100 + am;
      if (team >= 1 && team <= MAX_TEAM_NUMBER && getTeamIpAddress(team) === host) {
        return { platform: 'systemcore', team };
      }
    }
  }
  return { platform: null, team: null };
}

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
   * Get the hostname of a robot for a team number.
   * @param team - The team number.
   * @param platform - RoboRIO mDNS (default) or SystemCore team IP.
   * @returns The hostname or IPv4 address.
   */
  static getRobotAddress(team: number, platform: RobotPlatform = 'roborio'): string {
    return getRobotAddress(team, platform);
  }
}
