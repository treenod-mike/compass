/** Prior strength cap policy: min of (non-null sample count, 100). */
export const PRIOR_EFFECTIVE_N_MAX = 100

export function computeEffectiveN(nonNullCount: number): number {
  if (nonNullCount < 0) return 0
  return Math.min(nonNullCount, PRIOR_EFFECTIVE_N_MAX)
}
