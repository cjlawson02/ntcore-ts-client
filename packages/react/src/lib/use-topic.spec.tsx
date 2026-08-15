import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkTablesTypeInfos } from '@ntcore-ts/client';
import { NtcoreProvider } from './context';
import { useTopic } from './use-topic';

const mockUnsubscribe = vi.fn();
const mockUnpublish = vi.fn();
const mockSubscribe = vi.fn((cb: (v: unknown) => void) => {
  setTimeout(() => cb(1.234), 0);
  return 99;
});
const mockTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  unpublish: mockUnpublish,
  setValue: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  pubuid: 1,
};

const mockNt = {
  createTopic: vi.fn(() => mockTopic),
  getJsonTopic: vi.fn(() => mockTopic),
  addRobotConnectionListener: vi.fn(() => vi.fn()),
  close: vi.fn(),
  retain: vi.fn(),
  release: vi.fn(),
};

vi.mock('@ntcore-ts/client', () => ({
  NetworkTables: {
    getInstanceByTeam: vi.fn(() => mockNt),
    getInstanceByURI: vi.fn(() => mockNt),
  },
  NetworkTablesTypeInfos: { kDouble: [3, 'double'] as const, kJson: [4, 'json'] as const },
}));

describe('useTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopic.publish.mockResolvedValue(undefined);
  });

  const kDouble = NetworkTablesTypeInfos.kDouble;

  it('throws outside provider', () => {
    expect(() => renderHook(() => useTopic('/test', kDouble))).toThrow('useNtcore must be used within NtcoreProvider');
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble), { wrapper });
    expect(mockNt.createTopic).toHaveBeenCalledWith('/MyTable/Gyro', [3, 'double'], undefined);
    expect(mockSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.value).toBe(1.234);
    expect(result.current.setValue).toBeUndefined();
    expect(result.current.error).toBeNull();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(99);
  });

  it('does not resubscribe when only subscribeOptions reference changes (inline object)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
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
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    expect(mockTopic.publish).toHaveBeenCalledWith({});
    expect(result.current.isReadyToWrite).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isReadyToWrite).toBe(true);
    const setValue = result.current.setValue;
    expect(setValue).toBeDefined();
    act(() => {
      setValue?.(42);
    });
    expect(mockTopic.setValue).toHaveBeenCalledWith(42);
  });

  it('unpublishes on unmount when publish is set', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    unmount();
    expect(mockUnpublish).toHaveBeenCalled();
  });

  it('does not unpublish a remounted publisher when the first publish is still in flight', async () => {
    let resolvePublish!: () => void;
    mockTopic.publish.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePublish = resolve;
      })
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const first = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    first.unmount();
    const second = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    await act(async () => {
      resolvePublish();
    });
    expect(mockUnpublish).not.toHaveBeenCalled();
    second.unmount();
    expect(mockUnpublish).toHaveBeenCalled();
  });

  it('unpublishes after an in-flight publish resolves on unmount', async () => {
    let resolvePublish!: () => void;
    mockTopic.publish.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePublish = resolve;
      })
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    unmount();
    expect(mockUnpublish).not.toHaveBeenCalled();
    await act(async () => {
      resolvePublish();
    });
    expect(mockUnpublish).toHaveBeenCalled();
  });

  it('does not unpublish on unmount when unpublishOnUnmount is false', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(
      () => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true, unpublishOnUnmount: false }),
      { wrapper }
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    unmount();
    expect(mockUnpublish).not.toHaveBeenCalled();
  });

  it('sets error when publish rejects', async () => {
    mockTopic.publish.mockRejectedValueOnce(new Error('publish failed'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.error?.message).toBe('publish failed');
    expect(result.current.isReadyToWrite).toBe(false);
  });

  it('sets error when setValue throws', async () => {
    mockTopic.setValue.mockImplementationOnce(() => {
      throw new Error('not publisher');
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useTopic<number>('/MyTable/Gyro', kDouble, { publish: true }), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    act(() => {
      result.current.setValue?.(42);
    });
    expect(result.current.error?.message).toBe('not publisher');
  });

  it('uses getJsonTopic for kJson', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    renderHook(() => useTopic<{ a: number }>('/json', NetworkTablesTypeInfos.kJson, { defaultValue: { a: 1 } }), {
      wrapper,
    });
    expect(mockNt.getJsonTopic).toHaveBeenCalledWith('/json', { a: 1 });
  });

  it('publishes when publish: { retained: true } and isReadyToWrite becomes true after resolve', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
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
