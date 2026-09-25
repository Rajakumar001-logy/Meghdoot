import { AlertPriorityLevel, CommunicationChannel } from "@/types/communication";

export interface AlertPriorityInput {
  /** Probability in 0..1 or 0..100 (normalized automatically) */
  falseOnsetRisk: number;
  /** Probability in 0..1 or 0..100 (normalized automatically) */
  drySpellRisk: number;
  /** Probability in 0..1 or 0..100 (normalized automatically) */
  heavyRainRisk: number;
  /** Soil moisture percentage (0..100) or explicit boolean flag */
  soilMoisturePct?: number;
  soilMoistureLow?: boolean;
}

export interface AlertPriorityEvaluation {
  severity: AlertPriorityLevel;
  triggeredCondition: string;
  normalizedMetrics: {
    false_onset_risk: number;
    dry_spell_risk: number;
    heavy_rain_risk: number;
    soil_moisture_low: boolean;
  };
}

/**
 * Normalizes a probability value into [0, 1].
 * Accepts either [0, 1] decimals (e.g. 0.75) or [0, 100] percentages (e.g. 75).
 */
export function normalizeRiskFraction(val: number): number {
  if (!Number.isFinite(val) || val < 0) return 0;
  if (val > 1) return Math.min(1, Number((val / 100).toFixed(4)));
  return Number(val.toFixed(4));
}

/**
 * Section 6: Transparent Alert Priority Engine.
 * Evaluates CRITICAL, HIGH, MODERATE, and LOW priority strictly from documented rules:
 *
 * CRITICAL:
 *   false_onset_risk >= 0.75 OR heavy_rain_risk >= 0.70 OR (dry_spell_risk >= 0.70 AND soil_moisture_low)
 * HIGH:
 *   false_onset_risk >= 0.60 OR dry_spell_risk >= 0.60 OR heavy_rain_risk >= 0.55
 * MODERATE:
 *   false_onset_risk >= 0.45 OR dry_spell_risk >= 0.45 OR heavy_rain_risk >= 0.40
 * LOW:
 *   all other cases
 */
export function evaluateAlertPriority(
  input: AlertPriorityInput
): AlertPriorityEvaluation {
  const falseOnset = normalizeRiskFraction(input.falseOnsetRisk);
  const drySpell = normalizeRiskFraction(input.drySpellRisk);
  const heavyRain = normalizeRiskFraction(input.heavyRainRisk);
  const soilMoistureLow =
    typeof input.soilMoistureLow === "boolean"
      ? input.soilMoistureLow
      : typeof input.soilMoisturePct === "number"
      ? input.soilMoisturePct < 32
      : false;

  const normalizedMetrics = {
    false_onset_risk: falseOnset,
    dry_spell_risk: drySpell,
    heavy_rain_risk: heavyRain,
    soil_moisture_low: soilMoistureLow,
  };

  // CRITICAL check
  if (
    falseOnset >= 0.75 ||
    heavyRain >= 0.7 ||
    (drySpell >= 0.7 && soilMoistureLow)
  ) {
    const reasons: string[] = [];
    if (falseOnset >= 0.75) {
      reasons.push(`false_onset_risk (${Math.round(falseOnset * 100)}%) >= 75%`);
    }
    if (heavyRain >= 0.7) {
      reasons.push(`heavy_rain_risk (${Math.round(heavyRain * 100)}%) >= 70%`);
    }
    if (drySpell >= 0.7 && soilMoistureLow) {
      reasons.push(
        `dry_spell_risk (${Math.round(drySpell * 100)}%) >= 70% AND soil_moisture_low`
      );
    }
    return {
      severity: "CRITICAL",
      triggeredCondition: reasons.join(" | "),
      normalizedMetrics,
    };
  }

  // HIGH check
  if (falseOnset >= 0.6 || drySpell >= 0.6 || heavyRain >= 0.55) {
    const reasons: string[] = [];
    if (falseOnset >= 0.6) {
      reasons.push(`false_onset_risk (${Math.round(falseOnset * 100)}%) >= 60%`);
    }
    if (drySpell >= 0.6) {
      reasons.push(`dry_spell_risk (${Math.round(drySpell * 100)}%) >= 60%`);
    }
    if (heavyRain >= 0.55) {
      reasons.push(`heavy_rain_risk (${Math.round(heavyRain * 100)}%) >= 55%`);
    }
    return {
      severity: "HIGH",
      triggeredCondition: reasons.join(" | "),
      normalizedMetrics,
    };
  }

  // MODERATE check
  if (falseOnset >= 0.45 || drySpell >= 0.45 || heavyRain >= 0.4) {
    const reasons: string[] = [];
    if (falseOnset >= 0.45) {
      reasons.push(`false_onset_risk (${Math.round(falseOnset * 100)}%) >= 45%`);
    }
    if (drySpell >= 0.45) {
      reasons.push(`dry_spell_risk (${Math.round(drySpell * 100)}%) >= 45%`);
    }
    if (heavyRain >= 0.4) {
      reasons.push(`heavy_rain_risk (${Math.round(heavyRain * 100)}%) >= 40%`);
    }
    return {
      severity: "MODERATE",
      triggeredCondition: reasons.join(" | "),
      normalizedMetrics,
    };
  }

  // LOW fallback
  return {
    severity: "LOW",
    triggeredCondition: "All risk probabilities below MODERATE thresholds",
    normalizedMetrics,
  };
}

/**
 * Section 18: Deterministic Deduplication Key Generator.
 * Key format: farmer_id + advisory_id + forecast_issue_time + channel
 */
export function buildAlertDedupKey(params: {
  farmerId: string;
  advisoryId: string;
  forecastIssueTime: string;
  channel: CommunicationChannel | string;
}): string {
  const cleanFarmer = (params.farmerId || "block_broadcast").trim().toLowerCase();
  const cleanAdvisory = (params.advisoryId || "adv_default").trim().toLowerCase();
  const cleanTime = (params.forecastIssueTime || "default_cycle")
    .trim()
    .replace(/\s+/g, "_");
  const cleanChannel = (params.channel || "In-App").trim().toLowerCase();
  return `${cleanFarmer}:${cleanAdvisory}:${cleanTime}:${cleanChannel}`;
}

/**
 * Section 19: Expiration & Stale Alert Protection.
 * Returns true if the advisory/alert validity timestamp is earlier than `now`.
 */
export function isAlertExpired(
  validUntilIso: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!validUntilIso) return false;
  const expiryTime =
    validUntilIso instanceof Date
      ? validUntilIso.getTime()
      : new Date(validUntilIso).getTime();
  if (Number.isNaN(expiryTime)) return false;
  return expiryTime < now.getTime();
}

/**
 * Section 25: Farmer Consent & Notification Preference Gate.
 * If farmer.notification_enabled === false, blocks external/alert dispatch and returns
 * "Notifications disabled by farmer."
 */
export function verifyFarmerConsent(farmer: {
  id: string;
  notification_enabled: boolean;
  active?: boolean;
}): {
  allowed: boolean;
  reason: string;
} {
  if (farmer.active === false) {
    return {
      allowed: false,
      reason: "Farmer profile is inactive.",
    };
  }
  if (!farmer.notification_enabled) {
    return {
      allowed: false,
      reason: "Notifications disabled by farmer.",
    };
  }
  return {
    allowed: true,
    reason: "Consent verified (notification_enabled = true).",
  };
}

/**
 * Section 26: Phone Number Privacy Masking.
 * Always masks subscriber numbers to format: `+91 ******1234`
 * Never exposes full 10-digit mobile numbers in UI views or logs.
 */
export function maskPhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return "+91 ******0000";
  const digits = rawPhone.replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, "0");
  return `+91 ******${last4}`;
}

// In-memory rate-limiting tracker for anti-spam protection (Section 28)
const farmerSendWindowMap = new Map<string, number[]>();
let bulkJobTimestamps: number[] = [];

/**
 * Section 28: Rate Limiting & Anti-Spam Protection.
 * Prevents accidental rapid duplicate dispatches to the same farmer or repeated bulk loops.
 */
export function checkDispatchRateLimit(params: {
  farmerId?: string;
  isBulkJob?: boolean;
  nowMs?: number;
  maxPerFarmerPer10Min?: number;
  maxBulkJobsPerMin?: number;
}): {
  allowed: boolean;
  reason: string;
} {
  const now = params.nowMs ?? Date.now();
  const maxPerFarmer = params.maxPerFarmerPer10Min ?? 5;
  const maxBulk = params.maxBulkJobsPerMin ?? 5;

  if (params.isBulkJob) {
    bulkJobTimestamps = bulkJobTimestamps.filter((ts) => now - ts < 60_000);
    if (bulkJobTimestamps.length >= maxBulk) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: maximum ${maxBulk} bulk alert jobs per minute allowed.`,
      };
    }
    bulkJobTimestamps.push(now);
  }

  if (params.farmerId) {
    const windowMs = 10 * 60_000;
    const prev = (farmerSendWindowMap.get(params.farmerId) || []).filter(
      (ts) => now - ts < windowMs
    );
    if (prev.length >= maxPerFarmer) {
      return {
        allowed: false,
        reason: `Rate limit exceeded for farmer ${params.farmerId}: maximum ${maxPerFarmer} alerts per 10 minutes allowed.`,
      };
    }
    prev.push(now);
    farmerSendWindowMap.set(params.farmerId, prev);
  }

  return {
    allowed: true,
    reason: "Within rate limit window.",
  };
}

export function resetRateLimitStateForTests(): void {
  farmerSendWindowMap.clear();
  bulkJobTimestamps = [];
}
