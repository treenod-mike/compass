/**
 * Regularized incomplete beta inverse.
 * Port of Numerical Recipes in C, 3rd ed., §6.4 (betaincinv).
 * Returns x such that I_x(a,b) = p, where I is the regularized incomplete beta.
 *
 * scipy.stats.beta.ppf 참조 구현. 1e-6 수렴, 최대 20 Newton-Raphson iter.
 */
export function betaQuantile(a: number, b: number, p: number): number {
  if (!(a > 0)) throw new Error(`betaQuantile: a must be > 0, got ${a}`)
  if (!(b > 0)) throw new Error(`betaQuantile: b must be > 0, got ${b}`)
  if (!(p >= 0 && p <= 1)) throw new Error(`betaQuantile: p must be in [0,1], got ${p}`)
  if (p === 0) return 0
  if (p === 1) return 1

  // Initial guess via Cornish-Fisher approximation on arcsine-transformed normal
  const EPS = 1e-8
  const a1 = a - 1
  const b1 = b - 1
  let x: number
  if (a >= 1 && b >= 1) {
    const pp = p < 0.5 ? p : 1 - p
    const t = Math.sqrt(-2 * Math.log(pp))
    let xApprox = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t
    if (p < 0.5) xApprox = -xApprox
    const al = (xApprox * xApprox - 3) / 6
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1))
    const w = (xApprox * Math.sqrt(al + h)) / h - (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h))
    x = a / (a + b * Math.exp(2 * w))
  } else {
    const lna = Math.log(a / (a + b))
    const lnb = Math.log(b / (a + b))
    const t = Math.exp(a * lna) / a
    const u = Math.exp(b * lnb) / b
    const w = t + u
    x = p < t / w ? Math.pow(a * w * p, 1 / a) : 1 - Math.pow(b * w * (1 - p), 1 / b)
  }

  // Newton-Raphson refinement
  const afac = -lnGamma(a) - lnGamma(b) + lnGamma(a + b)
  for (let j = 0; j < 20; j++) {
    if (x === 0 || x === 1) return x
    const err = regularizedIncompleteBeta(a, b, x) - p
    let t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac)
    const u2 = err / t
    t = u2 / (1 - 0.5 * Math.min(1, u2 * (a1 / x - b1 / (1 - x))))
    x -= t
    if (x <= 0) x = 0.5 * (x + t)
    if (x >= 1) x = 0.5 * (x + t + 1)
    if (Math.abs(t) < EPS * x && j > 0) break
  }
  return x
}

/** ln(Gamma(x)) via Lanczos approximation (NR §6.1) */
function lnGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j] / y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Regularized incomplete beta I_x(a,b) (NR §6.4) */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0
  if (x === 1) return 1
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 200
  const EPS = 3e-7
  const FPMIN = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) return h
  }
  throw new Error("betaContinuedFraction did not converge")
}
