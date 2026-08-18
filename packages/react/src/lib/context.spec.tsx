import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider, useNtcore } from './context';
import type { NtcoreProviderProps } from './context';

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
  close: vi.fn(),
  retain: vi.fn(),
  release: vi.fn(),
};

const mockGetInstanceByTeam = vi.fn((_team: number, _port?: number, _platform?: string) => mockNt);
const mockGetInstanceByURI = vi.fn((_uri: string, _port?: number) => mockNt);

vi.mock('@ntcore-ts/client', () => ({
  NetworkTables: {
    getInstanceByTeam: (...args: [number, number?, string?]) => mockGetInstanceByTeam(...args),
    getInstanceByURI: (uri: string, port?: number) => mockGetInstanceByURI(uri, port),
  },
  NetworkTablesTypeInfos: {},
}));

describe('NtcoreProvider and useNtcore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstanceByTeam.mockImplementation((_team: number, _port?: number) => mockNt);
    mockGetInstanceByURI.mockImplementation((_uri: string, _port?: number) => mockNt);
  });

  it('useNtcore throws outside provider', () => {
    expect(() => renderHook(() => useNtcore())).toThrow('useNtcore must be used within NtcoreProvider');
  });

  it('useNtcore returns instance when wrapped with NtcoreProvider (team)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <NtcoreProvider team={973}>{children}</NtcoreProvider>;
    const { result } = renderHook(() => useNtcore(), { wrapper });
    expect(result.current).toBe(mockNt);
    expect(mockGetInstanceByTeam).toHaveBeenCalledWith(973, 5810);
  });

  it('useNtcore returns instance when wrapped with NtcoreProvider (team, systemcore)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider team={973} platform="systemcore">
        {children}
      </NtcoreProvider>
    );
    const { result } = renderHook(() => useNtcore(), { wrapper });
    expect(result.current).toBe(mockNt);
    expect(mockGetInstanceByTeam).toHaveBeenCalledWith(973, 5810, 'systemcore');
  });

  it('useNtcore returns instance when wrapped with NtcoreProvider (uri)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useNtcore(), { wrapper });
    expect(result.current).toBe(mockNt);
    expect(mockGetInstanceByURI).toHaveBeenCalledWith('localhost', 5810);
  });

  it('switches instance when uri changes and releases the previous one', () => {
    const first = { ...mockNt, close: vi.fn(), retain: vi.fn(), release: vi.fn() };
    const second = { ...mockNt, close: vi.fn(), retain: vi.fn(), release: vi.fn() };
    mockGetInstanceByURI.mockImplementation((uri: string) => (uri === 'localhost' ? first : second));
    const uriRef = { current: 'localhost' };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri={uriRef.current}>{children}</NtcoreProvider>
    );
    const { rerender } = renderHook(() => useNtcore(), { wrapper });
    expect(mockGetInstanceByURI).toHaveBeenCalledWith('localhost', 5810);
    expect(first.retain).toHaveBeenCalled();
    mockGetInstanceByURI.mockClear();
    uriRef.current = '192.168.1.1';
    rerender();
    expect(mockGetInstanceByURI).toHaveBeenCalledWith('192.168.1.1', 5810);
    expect(first.release).toHaveBeenCalledTimes(1);
    expect(second.retain).toHaveBeenCalled();
    expect(second.release).not.toHaveBeenCalled();
  });

  it('releases the NetworkTables instance when the provider unmounts', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(() => useNtcore(), { wrapper });
    expect(mockNt.release).not.toHaveBeenCalled();
    unmount();
    expect(mockNt.release).toHaveBeenCalledTimes(1);
  });

  it('throws when neither team nor uri is provided', () => {
    expect(() =>
      renderHook(() => useNtcore(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <NtcoreProvider {...({} as NtcoreProviderProps)}>{children}</NtcoreProvider>
        ),
      })
    ).toThrow('NtcoreProvider requires either team or uri.');
  });

  it('throws when port is invalid (e.g. NaN)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost" port={Number.NaN}>
        {children}
      </NtcoreProvider>
    );
    expect(() => renderHook(() => useNtcore(), { wrapper })).toThrow(
      'NtcoreProvider port must be a whole number between 1 and 65535 (e.g. 5810). Check your port value or environment variable.'
    );
  });
});
