import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { usePrefixTopic, usePrefixTopicMap } from './use-prefix-topic';

const mockUnsubscribe = vi.fn();
let _subscribeCallback: ((v: unknown, params: { name: string; type: string }) => void) | null = null;
const defaultPrefixSubscribeImpl = (cb: (v: unknown, params: { name: string; type: string }) => void) => {
  _subscribeCallback = cb;
  setTimeout(() => cb(42, { name: '/foo/bar', type: 'double' }), 0);
  return 88;
};
const mockPrefixSubscribe = vi.fn(defaultPrefixSubscribeImpl);
const mockPrefixTopic = {
  subscribe: mockPrefixSubscribe,
  unsubscribe: mockUnsubscribe,
};

const mockNt = {
  getPrefixTopic: vi.fn(() => mockPrefixTopic),
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

const waitForUpdates = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

/** usePrefixTopicMap batches with requestAnimationFrame; wait for it to flush */
const waitForMapUpdates = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 5));
  });

describe('usePrefixTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _subscribeCallback = null;
    mockPrefixSubscribe.mockImplementation(defaultPrefixSubscribeImpl);
  });

  it('throws outside provider', () => {
    expect(() => renderHook(() => usePrefixTopic('/SmartDashboard'))).toThrow(
      'useNtcore must be used within NtcoreProvider'
    );
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => usePrefixTopic('/SmartDashboard'), { wrapper });
    expect(mockNt.getPrefixTopic).toHaveBeenCalledWith('/SmartDashboard');
    expect(mockPrefixSubscribe).toHaveBeenCalled();
    expect(_subscribeCallback).toBeInstanceOf(Function);
    await waitForUpdates();
    expect(result.current).toEqual({
      name: '/foo/bar',
      value: 42,
      type: 'double',
    });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });

  it('passes subscribeOptions to topic.subscribe', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    renderHook(() => usePrefixTopic('/SmartDashboard', { periodic: 0.02 }), { wrapper });
    expect(mockPrefixSubscribe).toHaveBeenCalledWith(expect.any(Function), { periodic: 0.02 });
  });

  it('handles null value in update (unannounce)', async () => {
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string; type: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => cb(null, { name: '/foo/unannounced', type: 'double' }), 0);
      return 88;
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => usePrefixTopic('/SmartDashboard'), { wrapper });
    await waitForUpdates();
    expect(result.current).toEqual({
      name: '/foo/unannounced',
      value: null,
      type: 'double',
    });
  });

  it('resubscribes when prefix changes', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, rerender } = renderHook(({ prefix }) => usePrefixTopic(prefix), {
      wrapper,
      initialProps: { prefix: '/A' },
    });
    await waitForUpdates();
    expect(mockNt.getPrefixTopic).toHaveBeenCalledWith('/A');
    expect(result.current).toEqual({ name: '/foo/bar', value: 42, type: 'double' });

    rerender({ prefix: '/B' });
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
    expect(mockNt.getPrefixTopic).toHaveBeenCalledWith('/B');
    await waitForUpdates();
    expect(result.current).toEqual({ name: '/foo/bar', value: 42, type: 'double' });
  });
});

describe('usePrefixTopicMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _subscribeCallback = null;
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string; type: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => cb(42, { name: '/SmartDashboard/foo', type: 'double' }), 0);
      return 88;
    });
  });

  it('throws outside provider', () => {
    expect(() => renderHook(() => usePrefixTopicMap('/SmartDashboard'))).toThrow(
      'useNtcore must be used within NtcoreProvider'
    );
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => usePrefixTopicMap('/SmartDashboard'), { wrapper });
    expect(mockNt.getPrefixTopic).toHaveBeenCalledWith('/SmartDashboard');
    expect(mockPrefixSubscribe).toHaveBeenCalled();
    await waitForMapUpdates();
    expect(result.current).toEqual({ '/SmartDashboard/foo': { value: 42, type: 'double' } });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });

  it('batches multiple updates into map', async () => {
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string; type: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => {
        cb(1, { name: '/a', type: 'double' });
        cb(2, { name: '/b', type: 'string' });
        cb(3, { name: '/c', type: 'boolean' });
      }, 0);
      return 88;
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => usePrefixTopicMap('/'), { wrapper });
    await waitForMapUpdates();
    expect(result.current).toEqual({
      '/a': { value: 1, type: 'double' },
      '/b': { value: 2, type: 'string' },
      '/c': { value: 3, type: 'boolean' },
    });
  });

  it('passes subscribeOptions to topic.subscribe', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    renderHook(() => usePrefixTopicMap('/SmartDashboard', { periodic: 0.01 }), { wrapper });
    expect(mockPrefixSubscribe).toHaveBeenCalledWith(expect.any(Function), { periodic: 0.01 });
  });

  it('cancels pending rAF when prefix changes before flush', async () => {
    const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined);
    let rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      rafId += 1;
      return rafId;
    });
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string; type: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => cb(42, { name: '/A/foo', type: 'double' }), 0);
      return 88;
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { rerender } = renderHook(({ prefix }) => usePrefixTopicMap(prefix), {
      wrapper,
      initialProps: { prefix: '/A' },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    rerender({ prefix: '/B' });
    expect(cancelSpy).toHaveBeenCalled();

    cancelSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
