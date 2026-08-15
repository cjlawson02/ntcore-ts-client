import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { NetworkTables } from '@ntcore-ts/client';

export const NtcoreContext = createContext<NetworkTables | null>(null);

export type NtcoreProviderProps = {
  children: ReactNode;
} & ({ team: number; uri?: never; port?: number } | { uri: string; team?: never; port?: number });

const DEFAULT_PORT = 5810;

const INVALID_PORT_MESSAGE =
  'NtcoreProvider port must be a whole number between 1 and 65535 (e.g. 5810). Check your port value or environment variable.';

const MISSING_PROVIDER_MESSAGE = 'useNtcore must be used within NtcoreProvider';

function isValidPort(port: number): boolean {
  return Number.isFinite(port) && port === Math.floor(port) && port >= 1 && port <= 65535;
}

/** @internal */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function lookupNetworkTables(team: number | undefined, uri: string | undefined, port: number): NetworkTables {
  if (team != null) {
    return NetworkTables.getInstanceByTeam(team, port);
  }
  if (uri != null) {
    return NetworkTables.getInstanceByURI(uri, port);
  }
  throw new Error('NtcoreProvider requires either team or uri.');
}

/**
 * Provides a NetworkTables instance to the component tree. Must specify either
 * `team` (robot team number) or `uri` (e.g. "localhost" or "roborio-973-frc.local").
 * Use `useNtcore()` in descendants to access the instance.
 * Invalid port (NaN, non-integer, or outside 1–65535) throws so misconfiguration is caught early.
 *
 * Changing `team`, `uri`, or `port` switches to the corresponding NetworkTables singleton.
 * The previous instance is released (closed when no other provider still retains it).
 */
export function NtcoreProvider({ children, port = DEFAULT_PORT, ...rest }: NtcoreProviderProps) {
  const effectivePort = useMemo(() => {
    if (!isValidPort(port)) {
      throw new Error(INVALID_PORT_MESSAGE);
    }
    return port;
  }, [port]);

  const team = 'team' in rest ? rest.team : undefined;
  const uri = 'uri' in rest ? rest.uri : undefined;

  const [nt, setNt] = useState(() => lookupNetworkTables(team, uri, effectivePort));

  useEffect(() => {
    const instance = lookupNetworkTables(team, uri, effectivePort);
    instance.retain();
    setNt(instance);
    return () => instance.release();
  }, [team, uri, effectivePort]);

  return <NtcoreContext.Provider value={nt}>{children}</NtcoreContext.Provider>;
}

/**
 * Returns the NetworkTables instance from the nearest NtcoreProvider.
 * Throws when used outside a provider.
 */
export function useNtcore(): NetworkTables {
  const nt = useContext(NtcoreContext);
  if (nt === null) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return nt;
}
