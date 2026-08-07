// src/engines/onboarding/capability-test-gate.ts
// Stage 6 — Confidence-scored Testing Gate.
// See FINAL-UPGRADE-DESIGN.md §2.2 for design rationale.
//
// Audit-aware upgrades baked in:
//  - 🚀-3 Bayesian: maintain a Beta(α=passCount+1, β=failCount+1) posterior;
//    promote when P(p > confidenceFloor | evidence) > promotionThreshold.
//    Replaces the frequentist `pass-rate × stability-of-shape` which is wildly
//    noisy at N=5 (a truly 90%-reliable capability has a 5.5% chance of
//    producing 0/5 or 1/5, which the frequentist would reject permanently).

import type { CapabilityBindingStoreContract } from '../../storage/contracts/onboarding/capability-binding-store.js'
import type { GateOptions, GovernorHandleLike, TestableCapability } from './types.js'
import { DEFAULT_GATE_OPTIONS } from './types.js'

export interface GateResult {
  promoted: boolean
  confidence: number
  /** Bayesian posterior P(p > confidenceFloor | evidence). */
  posterior: number
  passCount: number
  failCount: number
}

export class CapabilityTestGate {
  constructor(
    private readonly bindingStore: CapabilityBindingStoreContract,
    private readonly options: GateOptions = DEFAULT_GATE_OPTIONS,
  ) {}

  async run(handle: GovernorHandleLike, capability: TestableCapability): Promise<GateResult> {
    let passCount = 0
    const history: Array<{ stage: string; timestamp: string; passed: boolean }> = []

    for (let i = 0; i < this.options.sampleRuns; i++) {
      const { passed } = await capability.test(handle)
      if (passed) passCount++
      history.push({
        stage: capability.kind,
        timestamp: new Date().toISOString(),
        passed,
      })
    }

    const failCount = this.options.sampleRuns - passCount

    // 🚀-3 Bayesian posterior — P(p > confidenceFloor | evidence) computed via
    // the regularized incomplete beta function (one-sided credible interval).
    const posterior = betaPosteriorTail(
      this.options.confidenceFloor,
      passCount + 1, // α
      failCount + 1, // β
    )
    // Point estimate — posterior mean = α / (α + β).
    const confidence = (passCount + 1) / (this.options.sampleRuns + 2)
    const promoted = posterior > this.options.promotionThreshold

    await this.bindingStore.appendPromotionHistory(capability.providerId, capability.id, history)
    await this.bindingStore.setStatus(
      capability.providerId,
      capability.id,
      promoted ? 'active' : 'prospect',
      confidence,
    )

    return { promoted, confidence, posterior, passCount, failCount }
  }
}

/**
 * Regularized incomplete beta function I_x(α, β) — the CDF of the Beta(α, β)
 * distribution. Used to compute P(p > floor | α, β) = 1 - I_floor(α, β).
 *
 * Implementation: continued-fraction expansion (Lentz's algorithm). Reference:
 * Numerical Recipes §6.4. Converges to machine precision in <100 iterations
 * for the parameter ranges we care about (α, β ∈ [1, 100], x ∈ [0, 1]).
 */
function betaPosteriorTail(floor: number, alpha: number, beta: number): number {
  if (floor <= 0) return 1
  if (floor >= 1) return 0
  // I_x(α, β) — the regularized incomplete beta.
  const ix = regularizedIncompleteBeta(floor, alpha, beta)
  return Math.max(0, 1 - ix)
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  // Symmetry: I_x(a, b) = 1 - I_{1-x}(b, a) — use whichever converges faster.
  if (x < (a + 1) / (a + b + 2)) {
    return continuedFractionBeta(x, a, b) / Math.exp(logBeta(a, b))
  }
  return 1 - continuedFractionBeta(1 - x, b, a) / Math.exp(logBeta(b, a))
}

function continuedFractionBeta(x: number, a: number, b: number): number {
  // Lentz's algorithm — modified continued fraction for I_x(a, b).
  const tiny = 1e-30
  const fpmin = tiny
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < fpmin) d = fpmin
  d = 1 / d
  let h = d
  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  // h = I_x(a,b) * exp(logBeta(a,b)) / x^a / (1-x)^b
  return (h * x ** a * (1 - x) ** b) / a
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

// Lanczos approximation for log(Γ(z)).
function logGamma(zInput: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (zInput < 0.5) {
    // Reflection formula.
    return Math.log(Math.PI / Math.sin(Math.PI * zInput)) - logGamma(1 - zInput)
  }
  const z = zInput - 1
  let x = c[0]!
  for (let i = 1; i < g + 2; i++) x += c[i]! / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
