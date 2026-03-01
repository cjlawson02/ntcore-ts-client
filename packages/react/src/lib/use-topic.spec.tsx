import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkTablesTypeInfos } from '@ntcore/client';
import { NtcoreProvider } from './context';
import { useTopic } from './use-topic';

const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn((cb: (v: unknown) => void) => {
  setTimeout(() => cb(1.234), 0);
  return 99;
});
const mockTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  setValue: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
};

const mockNt = {
  createTopic: vi.fn(() => mockTopic),
  addRobotConnectionListener: vi.fn(() => vi.fn()),
};

vi.mock('@ntcore/client', () => ({
  NetworkTables: {
    getInstanceByTeam: vi.fn(() => mockNt),
    getInstanceByURI: vi.fn(() => mockNt),
  },
  NetworkTablesTypeInfos: { kDouble: [3, 'double'] as const },
}));

describe('useTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const kDouble = NetworkTablesTypeInfos.kDouble;

  it('returns { value: null, setValue: undefined, isReadyToWrite: false } outside provider', () => {
    const { result } = renderHook(() => useTopic('/test', kDouble));
    expect(result.current.value).toBeNull();
    expect(result.current.setValue).toBeUndefined();
    expect(result.current.isReadyToWrite).toBe(false);
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble), { wrapper });
    expect(mockNt.createTopic).toHaveBeenCalledWith('/MyTable/Gyro', [3, 'double'], undefined);
    expect(mockSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.value).toBe(1.234);
    expect(result.current.setValue).toBeUndefined(); // subscribe-only, no publish
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(99);
  });

  it('does not resubscribe when only subscribeOptions reference changes (inline object)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { rerender } = renderHook(
      () => useTopic<number>('/MyTable/Gyro', kDouble, { subscribeOptions: { periodic: 0.02 } }),
      { wrapper }
    );
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    rerender();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('publishes when publish: true and isReadyToWrite becomes true after resolve', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    expect(mockTopic.publish).toHaveBeenCalledWith({});
    expect(result.current.isReadyToWrite).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isReadyToWrite).toBe(true);
    expect(result.current.setValue).toBeDefined();
    act(() => {
      result.current.setValue!(42);
    });
    expect(mockTopic.setValue).toHaveBeenCalledWith(42);
  });

  it('publishes when publish: { retained: true } and isReadyToWrite becomes true after resolve', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: { retained: true } }), {
      wrapper,
    });
    expect(mockTopic.publish).toHaveBeenCalledWith({ retained: true });
    expect(result.current.isReadyToWrite).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isReadyToWrite).toBe(true);
    expect(result.current.setValue).toBeDefined();
  });
});
