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
  isRobotConnecting: vi.fn(() => false),
  close: vi.fn(),
  retain: vi.fn(),
  release: vi.fn(),
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
    mockNt.isRobotConnecting.mockReturnValue(false);
  });

  it('throws outside provider', () => {
    expect(() => renderHook(() => useConnectionStatus())).toThrow('useNtcore must be used within NtcoreProvider');
  });

  it('returns connected: true, connecting: false, and rtt when provider has connection and immediateNotify', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });
    expect(result.current.connected).toBe(true);
    expect(result.current.connecting).toBe(false);
    expect(mockNt.addRobotConnectionListener).toHaveBeenCalledWith(expect.any(Function), true);
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.rtt).toBe(12);
  });

  it('polls isRobotConnecting when disconnected', async () => {
    mockNt.addRobotConnectionListener.mockImplementation((cb: (v: boolean) => void) => {
      cb(false);
      return mockRemoveConnectionListener;
    });
    mockNt.isRobotConnecting.mockReturnValue(true);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(true);
    expect(result.current.rtt).toBe(-1);
  });
});
