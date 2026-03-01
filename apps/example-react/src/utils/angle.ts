import { useRef } from 'react';

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
  const prevRef = useRef<number | null>(null);
  if (normalizedDegreesOrNull == null) {
    prevRef.current = null;
    return 0;
  }
  const display =
    prevRef.current === null ? normalizedDegreesOrNull : shortestPathDegrees(prevRef.current, normalizedDegreesOrNull);
  prevRef.current = display;
  return display;
}
