/**
 * Configurable Prototype Risk Classification Thresholds & Composite Weights
 * (src/config/riskThresholds.ts)
 *
 * Prompt 7 Requirements 7, 8, 15, 27:
 * - Converts probabilities [0.00, 1.00] into transparent categories:
 *     0.00–0.30 -> LOW
 *     0.30–0.60 -> MODERATE
 *     0.60–0.80 -> HIGH
 *     0.80–1.00 -> VERY HIGH
 * - Defines explicit, configurable weights for "Overall Agricultural Risk"
 *   without claiming the weighting is scientifically optimal.
 */

export type GISRiskCategory = "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";

export interface RiskThresholdBand {
  category: GISRiskCategory;
  label: string;
  shortBadge: string;
  iconSymbol: string;
  minProbability: number; // inclusive [0, 1]
  maxProbability: number; // inclusive [0, 1]
  rangeText: string;
  hexColor: string;
  borderHex: string;
  tailwindBg: string;
  tailwindText: string;
  tailwindBorder: string;
}

export const PROTOTYPE_RISK_THRESHOLD_LABEL =
  "Prototype risk classification thresholds. Risk categories are prototype decision-support classifications and are not official government warnings.";

export const RISK_THRESHOLD_BANDS: RiskThresholdBand[] = [
  {
    category: "LOW",
    label: "Low Risk",
    shortBadge: "LOW",
    iconSymbol: "●",
    minProbability: 0.0,
    maxProbability: 0.3,
    rangeText: "0–30%",
    hexColor: "#16A34A",
    borderHex: "#14532D",
    tailwindBg: "bg-emerald-600",
    tailwindText: "text-white",
    tailwindBorder: "border-emerald-700",
  },
  {
    category: "MODERATE",
    label: "Moderate Risk",
    shortBadge: "MODERATE",
    iconSymbol: "▲",
    minProbability: 0.3,
    maxProbability: 0.6,
    rangeText: "30–60%",
    hexColor: "#EAB308",
    borderHex: "#713F12",
    tailwindBg: "bg-amber-400",
    tailwindText: "text-slate-950",
    tailwindBorder: "border-amber-600",
  },
  {
    category: "HIGH",
    label: "High Risk",
    shortBadge: "HIGH",
    iconSymbol: "◆",
    minProbability: 0.6,
    maxProbability: 0.8,
    rangeText: "60–80%",
    hexColor: "#F97316",
    borderHex: "#7C2D12",
    tailwindBg: "bg-orange-500",
    tailwindText: "text-white",
    tailwindBorder: "border-orange-700",
  },
  {
    category: "VERY HIGH",
    label: "Very High Risk",
    shortBadge: "VERY HIGH",
    iconSymbol: "■",
    minProbability: 0.8,
    maxProbability: 1.0,
    rangeText: "80–100%",
    hexColor: "#DC2626",
    borderHex: "#7F1D1D",
    tailwindBg: "bg-red-600",
    tailwindText: "text-white",
    tailwindBorder: "border-red-800",
  },
];

/**
 * Explicit, configurable weights for Overall Agricultural Risk (Requirement 7):
 *
 * Formula:
 *   overall_risk =
 *     w_delayed_onset * (1 - onset_probability) +
 *     w_false_onset   * false_onset_probability +
 *     w_dry_spell     * dry_spell_probability +
 *     w_heavy_rain    * heavy_rain_probability
 *
 * Note: For agricultural sowing and standing crops, a high probability of sustained
 * monsoon onset REDUCES onset delay risk (`onset_delay_risk = 1 - onset_probability`),
 * while false onset, prolonged dry spells, and extreme heavy downpours INCREASE risk.
 */
export const OVERALL_AGRICULTURAL_RISK_CONFIG = {
  weights: {
    onsetDelayRisk: 0.25, // (1 - onset_probability)
    falseOnsetRisk: 0.30, // false_onset_probability
    drySpellRisk: 0.30,   // dry_spell_probability
    heavyRainRisk: 0.15,  // heavy_rain_probability
  },
  formulaDisplay:
    "overall_risk = 0.25 × (1 − P_onset) + 0.30 × P_false_onset + 0.30 × P_dry_spell + 0.15 × P_heavy_rain",
  disclaimer:
    "Prototype composite weighting for decision-support visualization; weights are configurable and not claimed to be scientifically optimal.",
};

/**
 * Classifies a normalized probability in [0, 1] (or percentage [0, 100]) into a transparent RiskThresholdBand.
 */
export function classifyProbabilityToRiskBand(probOrPct: number): RiskThresholdBand {
  const normalized = probOrPct > 1.0 ? Math.min(1.0, Math.max(0.0, probOrPct / 100.0)) : Math.min(1.0, Math.max(0.0, probOrPct));
  if (normalized >= 0.8) return RISK_THRESHOLD_BANDS[3];
  if (normalized >= 0.6) return RISK_THRESHOLD_BANDS[2];
  if (normalized >= 0.3) return RISK_THRESHOLD_BANDS[1];
  return RISK_THRESHOLD_BANDS[0];
}

/**
 * Computes the explicit Overall Agricultural Risk probability in [0, 1].
 */
export function computeOverallAgriculturalRisk(params: {
  onsetProbability: number;      // [0, 1]
  falseOnsetProbability: number; // [0, 1]
  drySpellProbability: number;   // [0, 1]
  heavyRainProbability: number;  // [0, 1]
}): {
  overallRiskProbability: number;
  overallRiskPct: number;
  onsetDelayComponent: number;
  falseOnsetComponent: number;
  drySpellComponent: number;
  heavyRainComponent: number;
  band: RiskThresholdBand;
} {
  const { weights } = OVERALL_AGRICULTURAL_RISK_CONFIG;
  const pOnset = Math.min(1, Math.max(0, params.onsetProbability));
  const pFalse = Math.min(1, Math.max(0, params.falseOnsetProbability));
  const pDry = Math.min(1, Math.max(0, params.drySpellProbability));
  const pHeavy = Math.min(1, Math.max(0, params.heavyRainProbability));

  const onsetDelayComponent = weights.onsetDelayRisk * (1.0 - pOnset);
  const falseOnsetComponent = weights.falseOnsetRisk * pFalse;
  const drySpellComponent = weights.drySpellRisk * pDry;
  const heavyRainComponent = weights.heavyRainRisk * pHeavy;

  const overallRiskProbability = Number(
    Math.min(
      1.0,
      Math.max(
        0.0,
        onsetDelayComponent + falseOnsetComponent + drySpellComponent + heavyRainComponent
      )
    ).toFixed(4)
  );
  const overallRiskPct = Number((overallRiskProbability * 100).toFixed(1));
  const band = classifyProbabilityToRiskBand(overallRiskProbability);

  return {
    overallRiskProbability,
    overallRiskPct,
    onsetDelayComponent: Number(onsetDelayComponent.toFixed(4)),
    falseOnsetComponent: Number(falseOnsetComponent.toFixed(4)),
    drySpellComponent: Number(drySpellComponent.toFixed(4)),
    heavyRainComponent: Number(heavyRainComponent.toFixed(4)),
    band,
  };
}
