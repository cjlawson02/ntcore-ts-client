import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { NetworkTables } from '@ntcore/client';

export const NtcoreContext = createContext<NetworkTables | null>(null);

export type NtcoreProviderProps = {
  children: ReactNode;
} & ({ team: number; uri?: never; port?: number } | { uri: string; team?: never; port?: number });

const DEFAULT_PORT = 5810;

/**
 * Provides a NetworkTables instance to the component tree. Must specify either
 * `team` (robot team number) or `uri` (e.g. "localhost" or "roborio-973-frc.local").
 * Use `useNtcore()` in descendants to access the instance.
 */
export function NtcoreProvider({ children, port = DEFAULT_PORT, ...rest }: NtcoreProviderProps) {
  const [nt] = useState<NetworkTables>(() => {
    if ('team' in rest && rest.team != null) {
      return NetworkTables.getInstanceByTeam(rest.team, port);
    }
    if ('uri' in rest && rest.uri != null) {
      return NetworkTables.getInstanceByURI(rest.uri, port);
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
