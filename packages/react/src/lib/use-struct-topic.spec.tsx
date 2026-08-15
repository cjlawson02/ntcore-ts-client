import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { useStructTopic } from './use-struct-topic';

const mockUnsubscribe = vi.fn();
const mockUnpublish = vi.fn();
const mockSubscribe = vi.fn((cb: (v: unknown) => void) => {
  setTimeout(() => cb({ x: 1, y: 2 }), 0);
  return 88;
});
const mockStructTopic = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  unpublish: mockUnpublish,
  setValue: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  pubuid: 1,
};

const mockNt = {
  getStructTopic: vi.fn(() => mockStructTopic),
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
  isStructTypeDescriptor: (value: unknown) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { typeName?: unknown }).typeName === 'string' &&
    typeof (value as { schema?: { parse?: unknown } }).schema?.parse === 'function',
}));

describe('useStructTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStructTopic.publish.mockResolvedValue(undefined);
  });

  it('throws outside provider', () => {
    expect(() => renderHook(() => useStructTopic<{ x: number; y: number }>('/struct/pose'))).toThrow(
      'useNtcore must be used within NtcoreProvider'
    );
  });

  it('subscribes on mount, unsubscribes on unmount', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(
      () => useStructTopic<{ x: number; y: number }>('/struct/t', { typeName: 'Translation2d' }),
      { wrapper }
    );
    expect(mockNt.getStructTopic).toHaveBeenCalledWith('/struct/t', { typeName: 'Translation2d' });
    expect(mockSubscribe).toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.value).toEqual({ x: 1, y: 2 });
    expect(result.current.error).toBeNull();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });

  it('setValue only when isReadyToWrite (publish path)', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
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

  it('unpublishes on unmount when publish is set', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(
      () => useStructTopic<{ x: number; y: number }>('/struct/t', { typeName: 'Translation2d', publish: true }),
      { wrapper }
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    unmount();
    expect(mockUnpublish).toHaveBeenCalled();
  });

  it('unpublishes after an in-flight publish resolves on unmount', async () => {
    let resolvePublish!: () => void;
    mockStructTopic.publish.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePublish = resolve;
      })
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { unmount } = renderHook(
      () => useStructTopic<{ x: number; y: number }>('/struct/t', { typeName: 'Translation2d', publish: true }),
      { wrapper }
    );
    unmount();
    expect(mockUnpublish).not.toHaveBeenCalled();
    await act(async () => {
      resolvePublish();
    });
    expect(mockUnpublish).toHaveBeenCalled();
  });

  it('supports array-of-struct type (Translation2d[]) without cast', () => {
    type Translation2d = { x: number; y: number };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(
      () => useStructTopic<Translation2d[]>('/struct/arr', { typeName: 'Translation2d[]' }),
      { wrapper }
    );
    expect(result.current.value).toBeNull();
    expect(mockNt.getStructTopic).toHaveBeenCalledWith('/struct/arr', { typeName: 'Translation2d[]' });
  });

  it('accepts a WPILib-style type descriptor as the second argument', () => {
    const Pose2d = { typeName: 'Pose2d', schema: { parse: (x: unknown) => x } };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    renderHook(() => useStructTopic('/struct/pose', Pose2d as never), { wrapper });
    expect(mockNt.getStructTopic).toHaveBeenCalledWith('/struct/pose', Pose2d, undefined);
  });
});
