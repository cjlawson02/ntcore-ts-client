import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { usePrefixTopic } from './use-prefix-topic';

const mockUnsubscribe = vi.fn();
const mockPrefixSubscribe = vi.fn((cb: (v: unknown, params: unknown) => void) => {
  setTimeout(() => cb(42, { name: '/foo/bar', id: 1, type: 'double', properties: {} }), 0);
  return 88;
});
const mockPrefixTopic = {
  subscribe: mockPrefixSubscribe,
  unsubscribe: mockUnsubscribe,
};

const mockNt = {
  createPrefixTopic: vi.fn(() => mockPrefixTopic),
  addRobotConnectionListener: vi.fn(() => vi.fn()),
};

vi.mock('@ntcore/client', () => ({
  NetworkTables: {
    getInstanceByTeam: vi.fn(() => mockNt),
    getInstanceByURI: vi.fn(() => mockNt),
  },
  NetworkTablesTypeInfos: {},
}));

describe('usePrefixTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null outside provider', () => {
    const { result } = renderHook(() => usePrefixTopic('/SmartDashboard'));
    expect(result.current).toBeNull();
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => usePrefixTopic('/SmartDashboard'), { wrapper });
    expect(mockNt.createPrefixTopic).toHaveBeenCalledWith('/SmartDashboard');
    expect(mockPrefixSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current).toEqual({
      name: '/foo/bar',
      value: 42,
    });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });
});
