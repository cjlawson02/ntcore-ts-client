import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NtcoreProvider } from './context';
import { usePrefixTopic, usePrefixTopicMap } from './use-prefix-topic';

const mockUnsubscribe = vi.fn();
let _subscribeCallback: ((v: unknown, params: { name: string }) => void) | null = null;
const defaultPrefixSubscribeImpl = (cb: (v: unknown, params: { name: string }) => void) => {
  _subscribeCallback = cb;
  setTimeout(() => cb(42, { name: '/foo/bar' }), 0);
  return 88;
};
const mockPrefixSubscribe = vi.fn(defaultPrefixSubscribeImpl);
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
    expect(_subscribeCallback).toBeInstanceOf(Function);
    await waitForUpdates();
    expect(result.current).toEqual({
      name: '/foo/bar',
      value: 42,
    });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });

  it('passes subscribeOptions to topic.subscribe', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    renderHook(() => usePrefixTopic('/SmartDashboard', { periodic: 0.02 }), { wrapper });
    expect(mockPrefixSubscribe).toHaveBeenCalledWith(expect.any(Function), { periodic: 0.02 });
  });

  it('handles null value in update (unannounce)', async () => {
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => cb(null, { name: '/foo/unannounced' }), 0);
      return 88;
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => usePrefixTopic('/SmartDashboard'), { wrapper });
    await waitForUpdates();
    expect(result.current).toEqual({
      name: '/foo/unannounced',
      value: null,
    });
  });

  it('resubscribes when prefix changes', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, rerender } = renderHook(({ prefix }) => usePrefixTopic(prefix), {
      wrapper,
      initialProps: { prefix: '/A' },
    });
    await waitForUpdates();
    expect(mockNt.createPrefixTopic).toHaveBeenCalledWith('/A');
    expect(result.current).toEqual({ name: '/foo/bar', value: 42 });

    rerender({ prefix: '/B' });
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
    expect(mockNt.createPrefixTopic).toHaveBeenCalledWith('/B');
    await waitForUpdates();
    expect(result.current).toEqual({ name: '/foo/bar', value: 42 });
  });
});

describe('usePrefixTopicMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _subscribeCallback = null;
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => cb(42, { name: '/foo/bar' }), 0);
      return 88;
    });
  });

  it('returns null outside provider', () => {
    const { result } = renderHook(() => usePrefixTopicMap('/SmartDashboard'));
    expect(result.current).toBeNull();
  });

  it('subscribes and unsubscribes when inside provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result, unmount } = renderHook(() => usePrefixTopicMap('/SmartDashboard'), { wrapper });
    expect(mockNt.createPrefixTopic).toHaveBeenCalledWith('/SmartDashboard');
    expect(mockPrefixSubscribe).toHaveBeenCalled();
    await waitForMapUpdates();
    expect(result.current).toEqual({ '/foo/bar': 42 });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith(88);
  });

  it('batches multiple updates into map', async () => {
    mockPrefixSubscribe.mockImplementation((cb: (v: unknown, params: { name: string }) => void) => {
      _subscribeCallback = cb;
      setTimeout(() => {
        cb(1, { name: '/a' });
        cb(2, { name: '/b' });
        cb(3, { name: '/c' });
      }, 0);
      return 88;
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NtcoreProvider uri="localhost">{children}</NtcoreProvider>
    );
    const { result } = renderHook(() => usePrefixTopicMap('/'), { wrapper });
    await waitForMapUpdates();
    expect(result.current).toEqual({ '/a': 1, '/b': 2, '/c': 3 });
  });

  it('passes subscribeOptions to topic.subscribe', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
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
