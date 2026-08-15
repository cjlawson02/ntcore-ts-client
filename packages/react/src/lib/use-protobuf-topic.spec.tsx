import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { useProtobufTopic } from './use-protobuf-topic';

const mockUnsubscribe = vi.fn();
const mockUnpublish = vi.fn();
const mockSubscribe = vi.fn((cb: (v: unknown) => void) => {
  setTimeout(() => cb(1.234), 0);
  return 99;
});
const mockProtobufTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  unpublish: mockUnpublish,
  setValue: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  pubuid: 1,
};

const mockNt = {
  getProtobufTopic: vi.fn(() => mockProtobufTopic),
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
  NetworkTablesTypeInfos: {},
}));

describe('useProtobufTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProtobufTopic.publish.mockResolvedValue(undefined);
  });

  it('throws outside provider', () => {
    expect(() => renderHook(() => useProtobufTopic<{ x: number }>('/proto/pose'))).toThrow(
      'useNtcore must be used within NtcoreProvider'
    );
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => useProtobufTopic<Record<string, unknown>>('/proto/test'), { wrapper });
    expect(mockNt.getProtobufTopic).toHaveBeenCalledWith('/proto/test', undefined);
    expect(mockSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.value).toBe(1.234);
    expect(result.current.setValue).toBeUndefined();
    expect(result.current.isReadyToWrite).toBe(false);
    expect(result.current.error).toBeNull();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(99);
  });

  it('passes options to getProtobufTopic', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    renderHook(
      () =>
        useProtobufTopic<{ value: number }>('/proto/opts', {
          defaultValue: { value: 0 },
          protoFilePath: '/path/to.proto',
        }),
      { wrapper }
    );
    expect(mockNt.getProtobufTopic).toHaveBeenCalledWith('/proto/opts', {
      defaultValue: { value: 0 },
      protoFilePath: '/path/to.proto',
    });
  });

  it('publishes when publish: true and isReadyToWrite becomes true after resolve', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => useProtobufTopic<{ x: number }>('/proto/pub', { publish: true }), { wrapper });
    expect(mockProtobufTopic.publish).toHaveBeenCalledWith({});
    expect(result.current.isReadyToWrite).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isReadyToWrite).toBe(true);
    const setValue = result.current.setValue;
    expect(setValue).toBeDefined();
    act(() => {
      setValue?.({ x: 5 });
    });
    expect(mockProtobufTopic.setValue).toHaveBeenCalledWith({ x: 5 });
  });

  it('unpublishes on unmount when publish is set', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(() => useProtobufTopic<{ x: number }>('/proto/pub', { publish: true }), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    unmount();
    expect(mockUnpublish).toHaveBeenCalled();
  });

  it('unpublishes after an in-flight publish resolves on unmount', async () => {
    let resolvePublish!: () => void;
    mockProtobufTopic.publish.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePublish = resolve;
      })
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(() => useProtobufTopic<{ x: number }>('/proto/pub', { publish: true }), { wrapper });
    unmount();
    expect(mockUnpublish).not.toHaveBeenCalled();
    await act(async () => {
      resolvePublish();
    });
    expect(mockUnpublish).toHaveBeenCalled();
  });
});
