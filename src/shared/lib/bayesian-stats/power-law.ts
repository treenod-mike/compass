export type PowerLawFit = { a: number; b: number }

export class NonDecreasingCurveError extends Error {
  constructor(public readonly slope: number) {
    super(`Power-law fit produced non-decreasing curve: b=${slope.toFixed(4)} (expected b > 0)`)
    this.name = "NonDecreasingCurveError"
  }
}

/**
 * Fit r(t) = a × t^(-b) via log-log least-squares regression.
 * Requires ≥ 2 points with day > 0 and value > 0.
 */
export function fitPowerLaw(points: Array<{ day: number; value: number }>): PowerLawFit {
  if (points.length < 2) {
    throw new Error(`fitPowerLaw requires at least 2 points, got ${points.length}`)
  }
  for (const p of points) {
    if (!(p.day > 0)) throw new Error(`fitPowerLaw: day must be > 0, got ${p.day}`)
    if (!(p.value > 0)) throw new Error(`fitPowerLaw: value must be > 0, got ${p.value}`)
  }
  const n = points.length
  const xs = points.map((p) => Math.log(p.day))
  const ys = points.map((p) => Math.log(p.value))
  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - xMean) * (ys[i]! - yMean)
    den += (xs[i]! - xMean) ** 2
  }
  if (den === 0) throw new Error(`fitPowerLaw: zero variance in log(day)`)
  const slope = num / den // = -b
  const b = -slope
  if (!(b > 0)) throw new NonDecreasingCurveError(b)
  const intercept = yMean - slope * xMean // = log a
  const a = Math.exp(intercept)
  return { a, b }
}
