import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { useStructTopic } from './use-struct-topic';

const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn((cb: (v: unknown) => void) => {
  setTimeout(() => cb({ x: 1, y: 2 }), 0);
  return 88;
});
const mockStructTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  setValue: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
};

const mockNt = {
  createStructTopic: vi.fn(() => mockStructTopic),
  addRobotConnectionListener: vi.fn(() => vi.fn()),
};

vi.mock('@ntcore/client', () => ({
  NetworkTables: {
    getInstanceByTeam: vi.fn(() => mockNt),
    getInstanceByURI: vi.fn(() => mockNt),
  },
  NetworkTablesTypeInfos: {},
}));

describe('useStructTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns value, setValue, isReadyToWrite', () => {
    const { result } = renderHook(() => useStructTopic<{ x: number; y: number }>('/struct/pose'));
    expect(result.current.value).toBeNull();
    expect(result.current.setValue).toBeUndefined();
    expect(result.current.isReadyToWrite).toBe(false);
  });

  it('subscribes on mount, unsubscribes on unmount', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(
      () => useStructTopic<{ x: number; y: number }>('/struct/t', { typeName: 'Translation2d' }),
      { wrapper }
    );
    expect(mockNt.createStructTopic).toHaveBeenCalledWith('/struct/t', { typeName: 'Translation2d' });
    expect(mockSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.value).toEqual({ x: 1, y: 2 });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });

  it('setValue only when isReadyToWrite (publish path)', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(
      () => useStructTopic<{ x: number; y: number }>('/struct/t', { typeName: 'Translation2d', publish: true }),
      { wrapper }
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isReadyToWrite).toBe(true);
    const setValue = result.current.setValue;
    expect(setValue).toBeDefined();
    act(() => {
      if (setValue) setValue({ x: 3, y: 4 });
    });
    expect(mockStructTopic.setValue).toHaveBeenCalledWith({ x: 3, y: 4 });
  });
});
