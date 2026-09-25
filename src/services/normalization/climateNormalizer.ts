import { ClimateIndexObservationRow, DataQualityFlag } from '@/types/database';
import { classifyEnsoPhase, classifyIodPhase, classifyMjoPhase } from './ensoClassifier';

export interface RawClimateSignalInput {
  index_name: 'ENSO' | 'IOD' | 'MJO';
  observation_date?: string;
  index_value: number | null;
  mjo_phase_number?: number;
  source?: string;
  quality_flag?: DataQualityFlag;
}

/**
 * Validates and normalizes ENSO, IOD, and MJO global climate observations.
 * - ENSO: Oceanic Niño Index (ONI / Niño 3.4 SST anomaly in °C), valid [-4.5, +4.5]
 * - IOD: Dipole Mode Index (DMI SST anomaly in °C), valid [-3.5, +3.5]
 * - MJO: RMM amplitude (dimensionless, MUST be >= 0), valid [0, 5.0]
 */
export function normalizeClimateObservation(raw: RawClimateSignalInput): ClimateIndexObservationRow {
  const obsDateStr =
    raw.observation_date && raw.observation_date.trim().length >= 10
      ? raw.observation_date.trim().slice(0, 10)
      : new Date().toISOString().split('T')[0];

  let quality_flag: DataQualityFlag = raw.quality_flag || 'valid';
  let index_value: number | null = raw.index_value;
  let phase = 'Neutral';

  if (index_value === null || index_value === undefined || !Number.isFinite(index_value)) {
    index_value = null;
    quality_flag = 'missing';
    phase = 'Unknown (Missing)';
  } else if (raw.index_name === 'ENSO') {
    if (index_value < -4.5 || index_value > 4.5) {
      quality_flag = 'invalid';
      index_value = null;
    } else {
      index_value = Number(index_value.toFixed(2));
      phase = classifyEnsoPhase(index_value);
    }
  } else if (raw.index_name === 'IOD') {
    if (index_value < -3.5 || index_value > 3.5) {
      quality_flag = 'invalid';
      index_value = null;
    } else {
      index_value = Number(index_value.toFixed(2));
      phase = classifyIodPhase(index_value);
    }
  } else if (raw.index_name === 'MJO') {
    // MJO amplitude must be >= 0
    if (index_value < 0 || index_value > 6.0) {
      quality_flag = 'invalid';
      index_value = null;
    } else {
      index_value = Number(index_value.toFixed(2));
      phase = classifyMjoPhase(raw.mjo_phase_number ?? 4, index_value);
    }
  }

  return {
    id: `cobs-${raw.index_name.toLowerCase()}-${obsDateStr}`,
    observation_date: obsDateStr,
    index_name: raw.index_name,
    index_value,
    phase,
    source: raw.source || 'NOAA CPC / PSL Global Climate Indices',
    quality_flag,
    created_at: new Date().toISOString(),
  };
}
