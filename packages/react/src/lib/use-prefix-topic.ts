import { useEffect, useRef, useState } from 'react';
import type { NetworkTablesTypes } from '@ntcore-ts/client';
import type { SubscribeOptions } from '@ntcore-ts/client';
import { useNtcore } from './context';
import { useLatestRef } from './use-latest-ref';

/**
 * Last update from a prefix topic: value, NT type string, and subtopic name.
 */
export type PrefixTopicUpdate = {
  name: string;
  value: NetworkTablesTypes | null;
  type: string;
};

export type PrefixTopicMapEntry = {
  value: NetworkTablesTypes | null;
  type: string;
};

type PrefixTopicUpdateCallback = (name: string, value: NetworkTablesTypes | null, type: string) => void;

/**
 * Shared subscription to a prefix topic. Calls onUpdate for each announcement.
 * Callbacks and subscribe options are ref-backed so the subscription stays stable.
 */
function usePrefixTopicSubscription(
  prefix: string,
  subscribeOptions: Omit<SubscribeOptions, 'prefix'> | undefined,
  onUpdate: PrefixTopicUpdateCallback
): void {
  const nt = useNtcore();
  const onUpdateRef = useLatestRef(onUpdate);
  const subscribeOptionsRef = useLatestRef(subscribeOptions);

  useEffect(() => {
    const topic = nt.getPrefixTopic(prefix);
    const subuid = topic.subscribe((value, params) => {
      try {
        onUpdateRef.current(params.name, value, params.type);
      } catch {
        /* consumer callback threw */
      }
    }, subscribeOptionsRef.current ?? undefined);
    return () => topic.unsubscribe(subuid);
  }, [nt, prefix, onUpdateRef, subscribeOptionsRef]);
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
 * @returns Latest update `{ name, value, type }` or null before first update.
 */
export function usePrefixTopic(
  prefix: string,
  subscribeOptions?: Omit<SubscribeOptions, 'prefix'>
): PrefixTopicUpdate | null {
  const nt = useNtcore();
  const [state, setState] = useState<PrefixTopicUpdate | null>(null);
  const [identity, setIdentity] = useState({ nt, prefix });

  if (nt !== identity.nt || prefix !== identity.prefix) {
    setIdentity({ nt, prefix });
    setState(null);
  }

  usePrefixTopicSubscription(prefix, subscribeOptions, (name, value, type) => setState({ name, value, type }));

  return state;
}

/**
 * Subscribes to all topics under a NetworkTables prefix and returns a map of every
 * topic name to its latest value and NT type. Updates are batched with requestAnimationFrame so
 * rapid announcements all appear. Use when you need to list or iterate over all topics
 * (e.g. an "all topics" table). For only the latest single update, use `usePrefixTopic` instead.
 *
 * Unsubscribes on unmount. Prefix topics are subscribe-only.
 *
 * @param prefix - Topic prefix (e.g. "/SmartDashboard" or "/" for all).
 * @param subscribeOptions - Optional subscribe options (e.g. { periodic: 0.02 }).
 * @returns Map of topic name to `{ value, type }`. Empty object after first flush when no topics yet.
 */
export function usePrefixTopicMap(
  prefix: string,
  subscribeOptions?: Omit<SubscribeOptions, 'prefix'>
): Record<string, PrefixTopicMapEntry> {
  const nt = useNtcore();
  const [byName, setByName] = useState<Record<string, PrefixTopicMapEntry>>({});
  const [identity, setIdentity] = useState({ nt, prefix });
  const pendingRef = useRef<Record<string, PrefixTopicMapEntry>>({});
  const rafRef = useRef<number | null>(null);
  const [mapGeneration, setMapGeneration] = useState(0);
  const mapGenerationRef = useLatestRef(mapGeneration);

  if (nt !== identity.nt || prefix !== identity.prefix) {
    setIdentity({ nt, prefix });
    setByName({});
    setMapGeneration((g) => g + 1);
  }

  const flush = useRef(() => {
    rafRef.current = null;
    const next = pendingRef.current;
    if (Object.keys(next).length > 0) {
      pendingRef.current = {};
      setByName((prev) => ({ ...prev, ...next }));
    }
  }).current;

  useEffect(() => {
    pendingRef.current = {};
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRef.current = {};
    };
  }, [nt, prefix]);

  usePrefixTopicSubscription(prefix, subscribeOptions, (name, value, type) => {
    if (!name.startsWith(prefix)) return;
    pendingRef.current[name] = { value, type };
    if (rafRef.current == null) {
      const scheduledFor = mapGenerationRef.current;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (mapGenerationRef.current !== scheduledFor) return;
        flush();
      });
    }
  });

  return byName;
}
