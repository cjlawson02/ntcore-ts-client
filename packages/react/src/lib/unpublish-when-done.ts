import { toError } from './context';

/** Tracks whether an in-flight `publish()` has settled so unmount can unpublish immediately. */
export type TrackedPublish = {
  promise: Promise<unknown>;
  settled: boolean;
};

const publishOwnerTokens = new WeakMap<object, number>();

export function trackPublish(promise: Promise<unknown>): TrackedPublish {
  const tracked: TrackedPublish = { promise, settled: false };
  void promise.finally(() => {
    tracked.settled = true;
  });
  return tracked;
}

/** Marks this effect as the current publisher owner of a shared topic. */
export function claimPublishOwner(topic: object): number {
  const token = (publishOwnerTokens.get(topic) ?? 0) + 1;
  publishOwnerTokens.set(topic, token);
  return token;
}

/** Unpublish after an in-flight publish settles so unmount cannot leave a ghost publisher. */
export function unpublishWhenDone(
  topic: { unpublish: () => void; pubuid?: number | null },
  tracked: TrackedPublish | undefined,
  setError: (error: Error) => void,
  ownerToken: number
): void {
  const run = () => {
    if (publishOwnerTokens.get(topic) !== ownerToken) return;
    if (topic.pubuid == null) return;
    try {
      topic.unpublish();
    } catch (e) {
      setError(toError(e));
    }
  };
  if (!tracked || tracked.settled) {
    run();
    return;
  }
  void tracked.promise.finally(run);
}
