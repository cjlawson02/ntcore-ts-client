import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NetworkTablesTypes } from '@ntcore/client';
import type { SubscribeOptions } from '@ntcore/client';
import { useNtcore } from './context';

/**
 * Last update from a prefix topic: value and announcement params (e.g. subtopic name).
 */
export type PrefixTopicUpdate = {
  name: string;
  value: NetworkTablesTypes | null;
};

type PrefixTopicUpdateCallback = (name: string, value: NetworkTablesTypes | null) => void;

/**
 * Shared subscription to a prefix topic. Calls onUpdate for each announcement; onReset when effect runs (e.g. prefix/nt change).
 * Callbacks are ref-backed so subscription is stable.
 */
function usePrefixTopicSubscription(
  prefix: string,
  subscribeOptions: Omit<SubscribeOptions, 'prefix'> | undefined,
  onUpdate: PrefixTopicUpdateCallback,
  onReset?: () => void
): void {
  const nt = useNtcore();
  const onUpdateRef = useRef(onUpdate);
  const onResetRef = useRef(onReset);
  const subscribeOptionsRef = useRef(subscribeOptions);

  useLayoutEffect(() => {
    onUpdateRef.current = onUpdate;
    onResetRef.current = onReset;
    subscribeOptionsRef.current = subscribeOptions;
  });

  useEffect(() => {
    if (!nt) return;
    onResetRef.current?.();
    const topic = nt.createPrefixTopic(prefix);
    const subuid = topic.subscribe(
      (value, params) => onUpdateRef.current(params.name, value),
      subscribeOptionsRef.current ?? undefined
    );
    return () => topic.unsubscribe(subuid);
  }, [nt, prefix]);
}

/**
 * Subscribes to all topics under a NetworkTables prefix and returns only the **latest** update.
 * Each new update replaces the previous one in state; rapid updates result in only the most
 * recent being visible. Use for "react to any change under prefix" or "show last activity."
 * For a full map of all topics under a prefix (e.g. to list or iterate), use `usePrefixTopicMap` instead.
 *
 * Unsubscribes on unmount. Prefix topics are subscribe-only.
 *
 * @param prefix - Topic prefix (e.g. "/SmartDashboard" or "/" for all).
 * @param subscribeOptions - Optional subscribe options (e.g. { periodic: 0.02 }).
 * @returns Latest update `{ name, value }` or null when outside provider or before first update.
 */
export function usePrefixTopic(
  prefix: string,
  subscribeOptions?: Omit<SubscribeOptions, 'prefix'>
): PrefixTopicUpdate | null {
  const [state, setState] = useState<PrefixTopicUpdate | null>(null);

  usePrefixTopicSubscription(
    prefix,
    subscribeOptions,
    (name, value) => setState({ name, value }),
    () => queueMicrotask(() => setState(null))
  );

  return state;
}

/**
 * Subscribes to all topics under a NetworkTables prefix and returns a map of every
 * topic name to its latest value. Updates are batched with requestAnimationFrame so
 * rapid announcements all appear. Use when you need to list or iterate over all topics
 * (e.g. an "all topics" table). For only the latest single update, use `usePrefixTopic` instead.
 *
 * Unsubscribes on unmount. Prefix topics are subscribe-only.
 *
 * @param prefix - Topic prefix (e.g. "/SmartDashboard" or "/" for all).
 * @param subscribeOptions - Optional subscribe options (e.g. { periodic: 0.02 }).
 * @returns Map of topic name to value, or null when outside provider. Empty object after first flush when no topics yet.
 */
export function usePrefixTopicMap(
  prefix: string,
  subscribeOptions?: Omit<SubscribeOptions, 'prefix'>
): Record<string, NetworkTablesTypes | null> | null {
  const [byName, setByName] = useState<Record<string, NetworkTablesTypes | null> | null>(null);
  const pendingRef = useRef<Record<string, NetworkTablesTypes | null>>({});
  const rafRef = useRef<number | null>(null);

  const flush = useRef(() => {
    rafRef.current = null;
    const next = pendingRef.current;
    if (Object.keys(next).length > 0) {
      pendingRef.current = {};
      setByName((prev) => ({ ...(prev ?? {}), ...next }));
    }
  }).current;

  usePrefixTopicSubscription(
    prefix,
    subscribeOptions,
    (name, value) => {
      pendingRef.current[name] = value;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRef.current = {};
      setByName({});
    }
  );

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return byName;
}
