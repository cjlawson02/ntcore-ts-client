import { useState } from 'react';

/** Normalize angle to [0, 360). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Convert WPILib/math angle to display (compass) angle.
 * Math: 0° = +X, CCW positive. Display: 0° = up (North), CW positive.
 * Use for needle, cardinal, and pose triangle so they match robot orientation.
 */
export function mathDegreesToDisplayDegrees(mathDegrees: number): number {
  return 90 - mathDegrees;
}

/**
 * Shortest-path angle from prev to the equivalent of normalized (mod 360).
 * Returns an angle equivalent to normalized that minimizes |result - prev|,
 * for smooth display (e.g. needle/pose rotation without spinning the long way).
 */
export function shortestPathDegrees(prev: number, normalized: number): number {
  const prevRep = normalizeDegrees(prev);
  let delta = normalized - prevRep;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return prev + delta;
}

/**
 * Returns a display angle that animates smoothly when normalized (0–360 or null) changes.
 * Use for needles/rotation UI; when input is null returns 0 and clears internal state.
 */
export function useShortestPathDisplay(normalizedDegreesOrNull: number | null): number {
  const [prevNormalized, setPrevNormalized] = useState<number | null>(null);
  const [display, setDisplay] = useState(0);

  if (normalizedDegreesOrNull == null) {
    if (prevNormalized !== null) {
      setPrevNormalized(null);
      setDisplay(0);
    }
    return 0;
  }

  if (prevNormalized === null) {
    setPrevNormalized(normalizedDegreesOrNull);
    setDisplay(normalizedDegreesOrNull);
    return normalizedDegreesOrNull;
  }

  if (normalizedDegreesOrNull !== prevNormalized) {
    const next = shortestPathDegrees(display, normalizedDegreesOrNull);
    setPrevNormalized(normalizedDegreesOrNull);
    setDisplay(next);
    return next;
  }

  return display;
}
