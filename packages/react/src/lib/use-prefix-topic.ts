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

/**
 * Subscribes to all topics under a NetworkTables prefix and returns the latest update.
 * Unsubscribes on unmount. Each update includes the value and announcement params (e.g. subtopic name).
 * Prefix topics are subscribe-only.
 *
 * Subscription is re-created only when `nt` or `prefix` change. Optional `subscribeOptions`
 * is read at subscribe time.
 *
 * @param prefix - Topic prefix (e.g. "/SmartDashboard" or "/" for all).
 * @param subscribeOptions - Optional subscribe options (e.g. { periodic: 0.02 }).
 * @returns Last update or null when outside provider or before first update.
 */
export function usePrefixTopic(
  prefix: string,
  subscribeOptions?: Omit<SubscribeOptions, 'prefix'>
): PrefixTopicUpdate | null {
  const nt = useNtcore();
  const [state, setState] = useState<PrefixTopicUpdate | null>(null);
  const subscribeOptionsRef = useRef(subscribeOptions);

  useLayoutEffect(() => {
    subscribeOptionsRef.current = subscribeOptions;
  });

  useEffect(() => {
    if (!nt) return;
    queueMicrotask(() => setState(null));
    const topic = nt.createPrefixTopic(prefix);
    const subuid = topic.subscribe(
      (value, params) => setState({ name: params.name, value }),
      subscribeOptionsRef.current ?? undefined
    );
    return () => topic.unsubscribe(subuid);
  }, [nt, prefix]);

  return state;
}
