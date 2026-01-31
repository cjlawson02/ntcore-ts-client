import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider, useNtcore } from './context';

const mockRemoveConnectionListener = vi.fn();
const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn(() => 42);

const mockTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  setValue: vi.fn(),
};

const mockNt = {
  createTopic: vi.fn(() => mockTopic),
  addRobotConnectionListener: vi.fn((cb: (v: boolean) => void, immediate?: boolean) => {
    if (immediate) cb(true);
    return mockRemoveConnectionListener;
  }),
};

vi.mock('@ntcore/client', () => ({
  NetworkTables: {
    getInstanceByTeam: vi.fn(() => mockNt),
    getInstanceByURI: vi.fn(() => mockNt),
  },
  NetworkTablesTypeInfos: {},
}));

describe('NtcoreProvider and useNtcore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useNtcore returns null outside provider', () => {
    const { result } = renderHook(() => useNtcore());
    expect(result.current).toBeNull();
  });

  it('useNtcore returns instance when wrapped with NtcoreProvider (team)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider team={973}>{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useNtcore(), { wrapper });
    expect(result.current).toBe(mockNt);
  });

  it('useNtcore returns instance when wrapped with NtcoreProvider (uri)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useNtcore(), { wrapper });
    expect(result.current).toBe(mockNt);
  });
});
