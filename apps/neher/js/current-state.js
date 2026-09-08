/** Derived value: never use a previously displayed, rounded per-set current. */
export function currentPerSet(totalAmps, sets) {
  if (!Number.isFinite(totalAmps) || totalAmps <= 0 || !Number.isInteger(sets) || sets < 1) return NaN;
  return totalAmps / sets;
}
