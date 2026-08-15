import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { NetworkTables } from '@ntcore-ts/client';

export const NtcoreContext = createContext<NetworkTables | null>(null);

export type NtcoreProviderProps = {
  children: ReactNode;
} & ({ team: number; uri?: never; port?: number } | { uri: string; team?: never; port?: number });

const DEFAULT_PORT = 5810;

const INVALID_PORT_MESSAGE =
  'NtcoreProvider port must be a whole number between 1 and 65535 (e.g. 5810). Check your port value or environment variable.';

function isValidPort(port: number): boolean {
  return Number.isFinite(port) && port === Math.floor(port) && port >= 1 && port <= 65535;
}

/**
 * Provides a NetworkTables instance to the component tree. Must specify either
 * `team` (robot team number) or `uri` (e.g. "localhost" or "roborio-973-frc.local").
 * Use `useNtcore()` in descendants to access the instance.
 * Invalid port (NaN, non-integer, or outside 1–65535) throws so misconfiguration is caught early.
 */
export function NtcoreProvider({ children, port = DEFAULT_PORT, ...rest }: NtcoreProviderProps) {
  const effectivePort = useMemo(() => {
    if (!isValidPort(port)) {
      throw new Error(INVALID_PORT_MESSAGE);
    }
    return port;
  }, [port]);

  const [nt] = useState<NetworkTables>(() => {
    if ('team' in rest && rest.team != null) {
      return NetworkTables.getInstanceByTeam(rest.team, effectivePort);
    }
    if ('uri' in rest && rest.uri != null) {
      return NetworkTables.getInstanceByURI(rest.uri, effectivePort);
    }
    throw new Error('NtcoreProvider requires either team or uri.');
  });

  const value = useMemo(() => nt, [nt]);
  return <NtcoreContext.Provider value={value}>{children}</NtcoreContext.Provider>;
}

/**
 * Returns the NetworkTables instance from the nearest NtcoreProvider.
 * Returns null when used outside a provider.
 */
export function useNtcore(): NetworkTables | null {
  return useContext(NtcoreContext);
}
