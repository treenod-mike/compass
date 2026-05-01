import type { VcSimResult } from "@/shared/api/vc-simulation"

export type GreenlightStatus = "pass" | "conditional" | "fail"

export type GreenlightResult = {
  status: GreenlightStatus
  irrPass: boolean
  paybackPass: boolean
}

/** Company-policy target — hardcoded v1; future: settings UI */
const TARGET_PAYBACK_MONTHS = 12

/**
 * Map VC simulation result to a binary company-policy verdict.
 *
 * Pass:        IRR ≥ hurdle  AND  Payback ≤ 12mo
 * Conditional: exactly one of the above passes
 * Fail:        neither passes
 *
 * hurdleRate is a fraction (0.15 = 15%), same scale as p50Irr.
 */
export function evaluateGreenlight(result: VcSimResult): GreenlightResult {
  const { baselineB, offer } = result

  const irrPass =
    Number.isFinite(baselineB.p50Irr) && baselineB.p50Irr >= offer.hurdleRate

  const paybackPass =
    baselineB.paybackMonths != null &&
    baselineB.paybackMonths <= TARGET_PAYBACK_MONTHS

  let status: GreenlightStatus
  if (irrPass && paybackPass) status = "pass"
  else if (irrPass || paybackPass) status = "conditional"
  else status = "fail"

  return { status, irrPass, paybackPass }
}
