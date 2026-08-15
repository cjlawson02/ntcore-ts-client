import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { useConnectionStatus } from './use-connection-status';

const mockRemoveConnectionListener = vi.fn();
const mockNt = {
  addRobotConnectionListener: vi.fn((cb: (v: boolean) => void, immediate?: boolean) => {
    if (immediate) cb(true);
    return mockRemoveConnectionListener;
  }),
  getRttMs: vi.fn(() => 12),
};

vi.mock('@ntcore-ts/client', () => ({
  NetworkTables: {
    getInstanceByTeam: vi.fn(() => mockNt),
    getInstanceByURI: vi.fn(() => mockNt),
  },
  NetworkTablesTypeInfos: {},
}));

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns connected: false and rtt: -1 outside provider', () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.connected).toBe(false);
    expect(result.current.rtt).toBe(-1);
  });

  it('returns connected: true and rtt when provider has connection and immediateNotify', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });
    expect(result.current.connected).toBe(true);
    expect(mockNt.addRobotConnectionListener).toHaveBeenCalledWith(expect.any(Function), true);
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.rtt).toBe(12);
  });
});
