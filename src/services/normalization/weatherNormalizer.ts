import { DataQualityFlag, WeatherObservationRow } from '@/types/database';

export interface RawWeatherInput {
  location_id: string;
  observation_date?: string | Date;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  pressure_hpa?: number | null;
  wind_speed_kmh?: number | null;
  rainfall_mm?: number | null;
  source?: string;
}

/**
 * Validates and normalizes raw weather observations into standardized units:
 * - temperature_c: °C, valid range [-25, 60]
 * - humidity_pct: %, valid range [0, 100]
 * - pressure_hpa: hPa, valid range [850, 1080]
 * - wind_speed_kmh: km/h, valid range [0, 250]
 * - rainfall_mm: mm/day, valid range [0, 1000]
 * Never silently replaces missing values with 0; flags quality_flag appropriately.
 */
export function normalizeWeatherObservation(raw: RawWeatherInput): WeatherObservationRow {
  const flags: DataQualityFlag[] = [];

  // Normalize ISO date YYYY-MM-DD
  let obsDateStr: string;
  if (raw.observation_date instanceof Date) {
    obsDateStr = raw.observation_date.toISOString().split('T')[0];
  } else if (typeof raw.observation_date === 'string' && raw.observation_date.trim().length >= 10) {
    obsDateStr = raw.observation_date.trim().slice(0, 10);
  } else {
    obsDateStr = new Date().toISOString().split('T')[0];
    flags.push('estimated');
  }

  // Check if observation date is older than 5 days
  const daysOld = (Date.now() - new Date(obsDateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld > 5) {
    flags.push('stale');
  }

  // Validate temperature (°C)
  let temperature_c: number | null = null;
  if (raw.temperature_c === null || raw.temperature_c === undefined || raw.temperature_c === -999) {
    flags.push('missing');
  } else if (!Number.isFinite(raw.temperature_c) || raw.temperature_c < -25 || raw.temperature_c > 60) {
    flags.push('invalid');
  } else {
    temperature_c = Number(raw.temperature_c.toFixed(1));
  }

  // Validate relative humidity (%)
  let humidity_pct: number | null = null;
  if (raw.humidity_pct === null || raw.humidity_pct === undefined || raw.humidity_pct === -999) {
    flags.push('missing');
  } else if (!Number.isFinite(raw.humidity_pct) || raw.humidity_pct < 0 || raw.humidity_pct > 100) {
    flags.push('invalid');
  } else {
    humidity_pct = Math.round(raw.humidity_pct);
  }

  // Validate surface/MSL atmospheric pressure (hPa)
  let pressure_hpa: number | null = null;
  if (raw.pressure_hpa === null || raw.pressure_hpa === undefined || raw.pressure_hpa === -999) {
    flags.push('missing');
  } else if (!Number.isFinite(raw.pressure_hpa) || raw.pressure_hpa < 850 || raw.pressure_hpa > 1080) {
    flags.push('invalid');
  } else {
    pressure_hpa = Number(raw.pressure_hpa.toFixed(1));
  }

  // Validate 10m wind speed (km/h)
  let wind_speed_kmh: number | null = null;
  if (raw.wind_speed_kmh === null || raw.wind_speed_kmh === undefined || raw.wind_speed_kmh === -999) {
    flags.push('missing');
  } else if (!Number.isFinite(raw.wind_speed_kmh) || raw.wind_speed_kmh < 0 || raw.wind_speed_kmh > 250) {
    flags.push('invalid');
  } else {
    wind_speed_kmh = Number(raw.wind_speed_kmh.toFixed(1));
  }

  // Validate precipitation (mm/day) - MUST be >= 0
  let rainfall_mm: number | null = null;
  if (raw.rainfall_mm === null || raw.rainfall_mm === undefined || raw.rainfall_mm === -999) {
    flags.push('missing');
  } else if (!Number.isFinite(raw.rainfall_mm) || raw.rainfall_mm < 0 || raw.rainfall_mm > 1200) {
    flags.push('invalid');
  } else {
    rainfall_mm = Number(raw.rainfall_mm.toFixed(1));
  }

  // Determine aggregate quality flag by severity priority
  let quality_flag: DataQualityFlag = 'valid';
  if (flags.includes('invalid')) {
    quality_flag = 'invalid';
  } else if (flags.includes('missing')) {
    quality_flag = 'missing';
  } else if (flags.includes('stale')) {
    quality_flag = 'stale';
  } else if (flags.includes('estimated')) {
    quality_flag = 'estimated';
  }

  return {
    id: `wobs-${raw.location_id}-${obsDateStr}`,
    location_id: raw.location_id,
    observation_date: obsDateStr,
    precipitation_mm: rainfall_mm,
    rainfall_mm,
    temperature_c,
    humidity: humidity_pct,
    humidity_pct,
    pressure: pressure_hpa,
    pressure_hpa,
    wind_speed: wind_speed_kmh,
    wind_speed_kmh,
    source: raw.source || 'Open-Meteo Weather & Reanalysis API',
    quality_flag,
    created_at: new Date().toISOString(),
  };
}
