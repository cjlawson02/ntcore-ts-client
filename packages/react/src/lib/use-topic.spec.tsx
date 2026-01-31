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

  it('returns [null, undefined, false] outside provider', () => {
    const { result } = renderHook(() => useTopic('/test', kDouble));
    expect(result.current[0]).toBeNull();
    expect(result.current[1]).toBeUndefined();
    expect(result.current[2]).toBe(false);
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
    expect(result.current[0]).toBe(1.234);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(99);
  });

  it('does not resubscribe when only subscribeOptions reference changes (inline object)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { rerender } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, undefined, { periodic: 0.02 }), {
      wrapper,
    });
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    rerender();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('publishes when publishOptions provided and canPublish becomes true after resolve', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(
      () => useTopic<number>('/MyTable/Gyro', kDouble, undefined, undefined, { retained: true }),
      { wrapper }
    );
    expect(mockTopic.publish).toHaveBeenCalledWith({ retained: true });
    expect(result.current[2]).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current[2]).toBe(true);
  });
});
