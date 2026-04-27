export type PowerLawFit = { a: number; b: number }

export class NonDecreasingCurveError extends Error {
  constructor(public readonly b: number) {
    super(`Power-law fit produced non-decreasing curve: b=${b.toFixed(4)} (expected b > 0)`)
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
    if (!Number.isFinite(p.day) || !(p.day > 0)) {
      throw new Error(`fitPowerLaw: day must be a positive finite number, got ${p.day}`)
    }
    if (!Number.isFinite(p.value) || !(p.value > 0)) {
      throw new Error(`fitPowerLaw: value must be a positive finite number, got ${p.value}`)
    }
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

export class MaxDayOutOfRangeError extends Error {
  constructor(public readonly maxDay: number) {
    super(`maxDay must be in (0, 1095], got ${maxDay}`)
    this.name = "MaxDayOutOfRangeError"
  }
}

const MAX_FORECAST_DAYS = 1095

export function extrapolatePowerLawCurve(args: {
  fit: PowerLawFit
  maxDay: number
  floor: number
}): number[] {
  const { fit, maxDay, floor } = args
  if (!Number.isInteger(maxDay) || !(maxDay > 0) || maxDay > MAX_FORECAST_DAYS) {
    throw new MaxDayOutOfRangeError(maxDay)
  }
  if (!Number.isFinite(fit.a) || !Number.isFinite(fit.b)) {
    throw new Error(`extrapolatePowerLawCurve: fit must be finite, got a=${fit.a} b=${fit.b}`)
  }
  if (!Number.isFinite(floor) || !(floor >= 0)) {
    throw new Error(`floor must be a finite number ≥ 0, got ${floor}`)
  }
  const out = new Array<number>(maxDay)
  for (let i = 0; i < maxDay; i++) {
    const day = i + 1
    const raw = fit.a * Math.pow(day, -fit.b)
    out[i] = Math.max(raw, floor)
  }
  return out
}
