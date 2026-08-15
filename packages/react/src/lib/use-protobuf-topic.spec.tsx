import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { useProtobufTopic } from './use-protobuf-topic';

const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn((cb: (v: unknown) => void) => {
  setTimeout(() => cb(1.234), 0);
  return 99;
});
const mockProtobufTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  setValue: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
};

const mockNt = {
  createProtobufTopic: vi.fn(() => mockProtobufTopic),
  addRobotConnectionListener: vi.fn(() => vi.fn()),
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
  });

  it('returns { value: null, setValue: undefined, isReadyToWrite: false } outside provider', () => {
    const { result } = renderHook(() => useProtobufTopic<{ x: number }>('/proto/pose'));
    expect(result.current.value).toBeNull();
    expect(result.current.setValue).toBeUndefined();
    expect(result.current.isReadyToWrite).toBe(false);
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => useProtobufTopic<Record<string, unknown>>('/proto/test'), { wrapper });
    expect(mockNt.createProtobufTopic).toHaveBeenCalledWith('/proto/test', undefined);
    expect(mockSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.value).toBe(1.234);
    expect(result.current.setValue).toBeUndefined(); // subscribe-only, no publish
    expect(result.current.isReadyToWrite).toBe(false);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(99);
  });

  it('passes options to createProtobufTopic', () => {
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
    expect(mockNt.createProtobufTopic).toHaveBeenCalledWith('/proto/opts', {
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
});
