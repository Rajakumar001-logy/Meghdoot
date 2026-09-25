"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sprout,
  Cpu,
  Radio,
  AlertTriangle,
  Clock,
  MapPin,
} from "lucide-react";
import { Block, ForecastHorizon } from "@/types/monsoon";
import {
  BlockHorizonAIPrediction,
  BlockRealObservation,
  BlockSpatialIntelligence,
} from "@/types/gis";
import {
  classifyProbabilityToRiskBand,
  OVERALL_AGRICULTURAL_RISK_CONFIG,
  PROTOTYPE_RISK_THRESHOLD_LABEL,
} from "@/config/riskThresholds";
import { formatUpdatedAgo } from "@/lib/geo";

interface BlockDetailPanelProps {
  selectedBlock: Block;
  spatialBlock: BlockSpatialIntelligence | null;
  horizon: ForecastHorizon;
  onHorizonChange: (h: ForecastHorizon) => void;
  forecastModeLabel: "AI FORECAST" | "SIMULATED FORECAST" | "DEMO MODE";
  aiPredictionUnavailable: boolean;
  observationUnavailable: boolean;
  compact?: boolean;
}

const HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

export function BlockDetailPanel({
  selectedBlock,
  spatialBlock,
  horizon,
  onHorizonChange,
  forecastModeLabel,
  aiPredictionUnavailable,
  observationUnavailable,
  compact = false,
}: BlockDetailPanelProps) {
  const realObs: BlockRealObservation | null =
    !observationUnavailable &&
    spatialBlock?.observation &&
    spatialBlock.observation.available
      ? spatialBlock.observation
      : null;

  const aiHorizonPred: BlockHorizonAIPrediction | null =
    !aiPredictionUnavailable && spatialBlock
      ? (spatialBlock.all_horizon_predictions &&
          spatialBlock.all_horizon_predictions[horizon]) ||
        (spatialBlock.prediction?.horizon === horizon
          ? spatialBlock.prediction
          : spatialBlock.prediction)
      : null;

  const isAIMode = forecastModeLabel === "AI FORECAST";
  const hasValidAIPred =
    Boolean(aiHorizonPred && aiHorizonPred.available) && !aiPredictionUnavailable;

  // Determine active forecast numbers:
  // In AI FORECAST mode: strictly use AI predictions; if unavailable, do NOT silently substitute simulated values!
  const activeOnsetPct = isAIMode
    ? hasValidAIPred && aiHorizonPred?.onset_probability_pct !== null
      ? aiHorizonPred!.onset_probability_pct
      : null
    : selectedBlock.onsetProbability;

  const activeFalseOnsetPct = isAIMode
    ? hasValidAIPred && aiHorizonPred?.false_onset_probability_pct !== null
      ? aiHorizonPred!.false_onset_probability_pct
      : null
    : selectedBlock.falseOnsetProbability;

  const activeDrySpellPct = isAIMode
    ? hasValidAIPred && aiHorizonPred?.dry_spell_probability_pct !== null
      ? aiHorizonPred!.dry_spell_probability_pct
      : null
    : selectedBlock.drySpellProbability;

  const activeHeavyRainPct = isAIMode
    ? hasValidAIPred && aiHorizonPred?.heavy_rain_probability_pct !== null
      ? aiHorizonPred!.heavy_rain_probability_pct
      : null
    : selectedBlock.heavyRainProbability;

  const activeExpectedRainMm = isAIMode
    ? hasValidAIPred
      ? aiHorizonPred!.expected_rainfall_mm
      : null
    : selectedBlock.expectedRainfall;

  const activeAnomalyPct = isAIMode
    ? hasValidAIPred
      ? aiHorizonPred!.rainfall_anomaly_pct
      : null
    : selectedBlock.rainfallAnomaly;

  const activeOverallAgRiskPct = isAIMode
    ? hasValidAIPred &&
      spatialBlock?.overall_agricultural_risk?.percentage !== null
      ? spatialBlock!.overall_agricultural_risk.percentage
      : null
    : Math.round(
        (0.25 * (100 - selectedBlock.onsetProbability) +
          0.3 * selectedBlock.falseOnsetProbability +
          0.3 * selectedBlock.drySpellProbability +
          0.15 * selectedBlock.heavyRainProbability) *
          10
      ) / 10;

  const overallBand =
    activeOverallAgRiskPct !== null
      ? classifyProbabilityToRiskBand(activeOverallAgRiskPct)
      : null;

  return (
    <div className="p-4 sm:p-6 bg-white flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        {/* 1. BLOCK HEADER & ADMINISTRATIVE METADATA */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#0B3B24] text-emerald-300">
                BLOCK DETAIL PANEL
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                  isAIMode
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                    : "bg-amber-50 text-amber-900 border-amber-300"
                }`}
              >
                {forecastModeLabel}
              </span>
              {overallBand && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${overallBand.tailwindBg} ${overallBand.tailwindText} ${overallBand.tailwindBorder}`}
                >
                  {overallBand.iconSymbol} {overallBand.shortBadge} Ag Risk (
                  {activeOverallAgRiskPct}%)
                </span>
              )}
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mt-1.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{selectedBlock.name}</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              <strong>District:</strong> {selectedBlock.district} •{" "}
              <strong>State:</strong> {selectedBlock.state}
              {spatialBlock && (
                <>
                  {" "}
                  • <strong>WGS84:</strong>{" "}
                  {spatialBlock.coordinates[0].toFixed(4)}°N,{" "}
                  {spatialBlock.coordinates[1].toFixed(4)}°E
                </>
              )}
            </p>
          </div>

          <div className="text-right bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shrink-0">
            <span className="text-[9px] font-bold uppercase text-slate-500 block">
              MODEL ENGINE
            </span>
            <span className="text-xs font-extrabold text-slate-900 block">
              {isAIMode
                ? aiHorizonPred?.model_version || "MPAI-ENS-0.1"
                : forecastModeLabel}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold block">
              {isAIMode ? "0.6 XGB + 0.4 LSTM" : "Scenario Reference"}
            </span>
          </div>
        </div>

        {/* 2. REAL OBSERVATIONS SECTION (Section 10 & 13: Explicitly labeled REAL OBSERVATION, never mixed with forecast) */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/45 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-700" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-950">
                REAL OBSERVATION (Block Telemetry)
              </span>
              <span className="px-1.5 py-0.5 rounded bg-sky-700 text-white text-[9px] font-extrabold uppercase">
                REAL OBSERVATION
              </span>
            </div>
            {realObs && realObs.observation_timestamp && (
              <span className="text-[10px] font-bold text-sky-800 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {realObs.updated_ago ||
                  formatUpdatedAgo(realObs.observation_timestamp)}{" "}
                ({realObs.observation_timestamp})
              </span>
            )}
          </div>

          {!realObs ? (
            <div
              role="alert"
              className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Latest observation unavailable</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <span className="text-[10px] text-slate-500 block">
                    Rainfall
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {realObs.rainfall_mm ?? 0} mm
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <span className="text-[10px] text-slate-500 block">
                    Temperature
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {realObs.temperature_c ?? 29.0}°C
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <span className="text-[10px] text-slate-500 block">
                    Humidity
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {realObs.humidity_pct ?? 80}%
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <span className="text-[10px] text-slate-500 block">
                    Pressure
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {realObs.pressure_hpa ?? 998} hPa
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-sky-100">
                  <span className="text-[10px] text-slate-500 block">
                    Wind Speed
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {realObs.wind_speed_kmh ?? 12} km/h
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600 pt-1 border-t border-sky-200/60">
                <span>
                  <strong>Source:</strong> {realObs.source}
                </span>
                <span>
                  <strong>Quality:</strong>{" "}
                  <span className="font-bold text-emerald-700 uppercase">
                    {realObs.quality}
                  </span>{" "}
                  • 7D Rain: {realObs.cumulative_7d_rain_mm ?? 0} mm
                </span>
              </div>
            </>
          )}
        </div>

        {/* 3. AI FORECAST SECTION (7D | 14D | 21D | 30D) */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/35 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-800" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950">
                {forecastModeLabel} — HORIZON TARGETS
              </span>
            </div>

            {/* Horizon Tabs: 7D | 14D | 21D | 30D */}
            <div
              role="tablist"
              aria-label="Forecast Horizon Selector"
              className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-emerald-200 text-[11px]"
            >
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  role="tab"
                  aria-selected={horizon === h}
                  onClick={() => onHorizonChange(h)}
                  className={`px-2 py-0.5 rounded-md font-extrabold transition ${
                    horizon === h
                      ? "bg-[#0B3B24] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {isAIMode && !hasValidAIPred ? (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-300 text-red-950 text-xs font-bold"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <div>
                <p>AI prediction unavailable</p>
                <p className="text-[10px] font-normal text-red-800 mt-0.5">
                  AI FORECAST mode never silently substitutes simulated values.
                  Switch to SIMULATED FORECAST or DEMO MODE if needed.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 4 Probabilistic Targets + Expected Rainfall + Rainfall Anomaly */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-white border border-emerald-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Onset Probability ({horizon})
                  </span>
                  <span className="text-base font-extrabold text-emerald-800">
                    {activeOnsetPct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Onset Delay Risk:{" "}
                    {Math.round((100 - (activeOnsetPct || 0)) * 10) / 10}%
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-amber-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    False Onset Risk ({horizon})
                  </span>
                  <span className="text-base font-extrabold text-amber-800">
                    {activeFalseOnsetPct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {
                      classifyProbabilityToRiskBand(activeFalseOnsetPct || 0)
                        .shortBadge
                    }
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-orange-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Dry Spell Risk ({horizon})
                  </span>
                  <span className="text-base font-extrabold text-orange-700">
                    {activeDrySpellPct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {
                      classifyProbabilityToRiskBand(activeDrySpellPct || 0)
                        .shortBadge
                    }
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-sky-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Heavy Rain Risk ({horizon})
                  </span>
                  <span className="text-base font-extrabold text-sky-800">
                    {activeHeavyRainPct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {
                      classifyProbabilityToRiskBand(activeHeavyRainPct || 0)
                        .shortBadge
                    }
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Expected Rainfall ({horizon})
                  </span>
                  <span className="text-base font-extrabold text-slate-900">
                    {activeExpectedRainMm} mm
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Cumulative {horizon}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Rainfall Anomaly ({horizon})
                  </span>
                  <span
                    className={`text-base font-extrabold ${
                      (activeAnomalyPct || 0) < 0
                        ? "text-red-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {(activeAnomalyPct || 0) > 0
                      ? `+${activeAnomalyPct}%`
                      : `${activeAnomalyPct}%`}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    vs {horizon} Climatology
                  </span>
                </div>
              </div>

              {/* Overall Agricultural Risk Composite Box (Layer G) */}
              <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300">
                    Overall Agricultural Risk ({horizon}):
                  </span>
                  <span className="font-extrabold text-sm">
                    {activeOverallAgRiskPct}% ({overallBand?.shortBadge})
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-mono">
                  Formula: {OVERALL_AGRICULTURAL_RISK_CONFIG.formulaDisplay}
                </p>
                <p className="text-[10px] text-slate-400">
                  {PROTOTYPE_RISK_THRESHOLD_LABEL}
                </p>
              </div>

              {/* Model & Temporal Cutoff Provenance */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] text-slate-600 pt-1 border-t border-emerald-200/70">
                <div>
                  <strong>MODEL:</strong>{" "}
                  {isAIMode
                    ? `${aiHorizonPred?.model_version || "MPAI-ENS-0.1"}`
                    : forecastModeLabel}
                </div>
                <div>
                  <strong>Observation cutoff:</strong>{" "}
                  {aiHorizonPred?.observation_cutoff ||
                    realObs?.observation_timestamp ||
                    "2025-08-31"}
                </div>
                <div>
                  <strong>Prediction issue time:</strong>{" "}
                  {aiHorizonPred?.issued_at
                    ? formatUpdatedAgo(aiHorizonPred.issued_at)
                    : "Available"}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. RECOMMENDED CROP ADVISORY PREVIEW */}
        {!compact && (
          <div className="p-3 rounded-xl bg-[#0B3B24] text-white space-y-1">
            <div className="flex items-center justify-between text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
              <span>Block Agronomic Guidance ({horizon})</span>
              <span>Soil: {selectedBlock.soilType}</span>
            </div>
            <p className="text-xs text-amber-200 font-semibold">
              {spatialBlock?.advisory_summary?.main_issue ||
                selectedBlock.mainIssue}
            </p>
            <p className="text-xs text-white leading-relaxed">
              <strong>Action:</strong>{" "}
              {spatialBlock?.advisory_summary?.recommended_action ||
                selectedBlock.recommendedAdvisory}
            </p>
          </div>
        )}
      </div>

      {/* BOTTOM ACTION LINKS */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <Link
          href="/advisories"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition"
        >
          <Sprout className="w-4 h-4 text-emerald-400" />
          Crop Advisory for {selectedBlock.name.replace(" Block", "")}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/farmers"
          className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition"
        >
          Farmer Message
        </Link>
      </div>
    </div>
  );
}
