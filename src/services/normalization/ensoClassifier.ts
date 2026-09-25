/**
 * ENSO, IOD, and MJO Phase Classification Utilities
 * Isolates climate index thresholds from UI and provider layers.
 */

export type EnsoPhase = 'El Niño' | 'La Niña' | 'Neutral';
export type IodPhase = 'Positive' | 'Negative' | 'Neutral';

/**
 * Classifies Oceanic Niño Index (ONI / Niño 3.4 SST anomaly in °C)
 * Standard NOAA CPC threshold:
 *   >= +0.5 °C -> El Niño
 *   <= -0.5 °C -> La Niña
 *   (-0.5, +0.5) -> Neutral
 */
export function classifyEnsoPhase(oniValue: number): EnsoPhase {
  if (!Number.isFinite(oniValue)) return 'Neutral';
  if (oniValue >= 0.5) return 'El Niño';
  if (oniValue <= -0.5) return 'La Niña';
  return 'Neutral';
}

/**
 * Classifies Indian Ocean Dipole (IOD) Dipole Mode Index (DMI in °C)
 * Standard BOM/NOAA threshold:
 *   >= +0.4 °C -> Positive IOD
 *   <= -0.4 °C -> Negative IOD
 *   (-0.4, +0.4) -> Neutral
 */
export function classifyIodPhase(dmiValue: number): IodPhase {
  if (!Number.isFinite(dmiValue)) return 'Neutral';
  if (dmiValue >= 0.4) return 'Positive';
  if (dmiValue <= -0.4) return 'Negative';
  return 'Neutral';
}

/**
 * Formats MJO phase and amplitude into an atmospheric phase label
 */
export function classifyMjoPhase(phaseNumber: number, amplitude: number): string {
  if (!Number.isFinite(amplitude) || amplitude < 1.0) {
    return `Inactive (Phase ${phaseNumber || 1}, Amp ${Number.isFinite(amplitude) ? amplitude.toFixed(2) : '0.00'})`;
  }
  const regionMap: Record<number, string> = {
    1: 'Western Hemisphere / Africa',
    2: 'Western Indian Ocean',
    3: 'Eastern Indian Ocean',
    4: 'Maritime Continent (Enhanced Monsoon)',
    5: 'Maritime Continent / West Pacific',
    6: 'Western Pacific',
    7: 'Western Hemisphere',
    8: 'Africa / Western Indian Ocean',
  };
  const clampedPhase = Math.min(8, Math.max(1, Math.round(phaseNumber)));
  return `Phase ${clampedPhase} — ${regionMap[clampedPhase] || 'Indian Ocean'}`;
}
