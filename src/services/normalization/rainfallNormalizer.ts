import { DataQualityFlag, RainfallObservationRow } from '@/types/database';

export interface RawRainfallInput {
  location_id: string;
  observation_date?: string | Date;
  rainfall_mm?: number | null;
  normal_rainfall_mm?: number | null;
  source?: string;
}

/**
 * Validates and normalizes daily rainfall observations into mm/day.
 * Ensures precipitation >= 0, treats -999 (NASA POWER fill value) or null as 'missing'
 * rather than silently coercing to 0 mm.
 */
export function normalizeRainfallObservation(raw: RawRainfallInput): RainfallObservationRow {
  let quality_flag: DataQualityFlag = 'valid';

  let obsDateStr: string;
  if (raw.observation_date instanceof Date) {
    obsDateStr = raw.observation_date.toISOString().split('T')[0];
  } else if (typeof raw.observation_date === 'string' && raw.observation_date.trim().length >= 10) {
    obsDateStr = raw.observation_date.trim().slice(0, 10);
  } else {
    obsDateStr = new Date().toISOString().split('T')[0];
    quality_flag = 'estimated';
  }

  let rainfall_mm: number | null = null;
  if (raw.rainfall_mm === null || raw.rainfall_mm === undefined || raw.rainfall_mm === -999) {
    quality_flag = 'missing';
  } else if (!Number.isFinite(raw.rainfall_mm) || raw.rainfall_mm < 0 || raw.rainfall_mm > 1200) {
    quality_flag = 'invalid';
  } else {
    rainfall_mm = Number(raw.rainfall_mm.toFixed(1));
  }

  const normal_rainfall_mm =
    raw.normal_rainfall_mm !== null &&
    raw.normal_rainfall_mm !== undefined &&
    Number.isFinite(raw.normal_rainfall_mm) &&
    raw.normal_rainfall_mm >= 0
      ? Number(raw.normal_rainfall_mm.toFixed(1))
      : 8.5; // Prayagraj monsoon climatological daily mean (mm/day)

  let anomaly_percent: number | null = null;
  if (rainfall_mm !== null && normal_rainfall_mm > 0) {
    anomaly_percent = Number((((rainfall_mm - normal_rainfall_mm) / normal_rainfall_mm) * 100).toFixed(1));
  }

  return {
    id: `robs-${raw.location_id}-${obsDateStr}`,
    location_id: raw.location_id,
    observation_date: obsDateStr,
    rainfall_mm,
    normal_rainfall_mm,
    anomaly_percent,
    source: raw.source || 'NASA POWER / Open-Meteo Precipitation',
    quality_flag,
    created_at: new Date().toISOString(),
  };
}
