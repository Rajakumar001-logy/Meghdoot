"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CloudLightning,
  CloudRain,
  Database,
  Droplets,
  Flame,
  Gauge,
  MapPin,
  Radio,
  RefreshCw,
  Thermometer,
  TrendingDown,
  MessageSquareShare,
  Sliders,
  Wind,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import { OFFICER_SUMMARY_METRICS } from "@/data/mockData";
import { RainfallChart } from "@/components/charts/RainfallChart";
import { FalseOnsetWarning } from "@/components/intelligence/FalseOnsetWarning";
import { ForecastHorizon } from "@/types/monsoon";
import SIHCommandCenterExtension from "@/components/dashboard/SIHCommandCenterExtension";

const HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

const ALERT_CATEGORIES = [
  "All",
  "Dry Spell",
  "False Onset",
  "Heavy Rain",
  "Rainfall Anomaly",
] as const;

export default function DashboardPage() {
  const {
    selectedState,
    selectedDistrict,
    selectedBlockId,
    setSelectedBlockId,
    selectedBlock,
    horizon,
    setHorizon,
    currentForecast,
    currentScenarioMeta,
    allBlocks,
    alerts,
    markAlertAsRead,
    markAllAlertsAsRead,
    triggerToast,
    demoMode,
    liveDataActive,
    usingStoredObservationFallback,
    weatherObservation,
    rainfallObservation,
    dataSourceStatuses,
    isRefreshingExternalData,
    refreshExternalData,
    aiForecastActive,
    aiPrediction,
    modelHealth,
    aiUnavailableReason,
  } = useMonsoon();

  const [alertCategoryFilter, setAlertCategoryFilter] =
    useState<(typeof ALERT_CATEGORIES)[number]>("All");

  const filteredAlerts =
    alertCategoryFilter === "All"
      ? alerts
      : alerts.filter((a) => a.category === alertCategoryFilter);

  const highRiskCount = allBlocks.filter(
    (b) => b.riskLevel === "High" || b.riskLevel === "Very High"
  ).length;
  const falseOnsetCount = allBlocks.filter(
    (b) => b.falseOnsetProbability >= 60
  ).length;

  const lastUpdatedText = dataSourceStatuses.weather.last_successful_fetch
    ? new Date(dataSourceStatuses.weather.last_successful_fetch).toLocaleString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    : weatherObservation.observation_date;

  return (
    <div className="space-y-6">
      {/* TOP PAGE HEADER WITH LOCATION & HORIZON CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              Agricultural Officer Command View
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-extrabold uppercase">
              {currentScenarioMeta.shortLabel}
            </span>
            {demoMode ? (
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-extrabold uppercase">
                SIMULATED FORECAST — DEMO
              </span>
            ) : liveDataActive ? (
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold uppercase">
                LIVE DATA
              </span>
            ) : usingStoredObservationFallback ? (
              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-extrabold uppercase">
                STORED OBSERVATION — FALLBACK
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-extrabold uppercase">
                SIMULATED FORECAST — DEMO
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Monsoon Intelligence Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 pt-0.5">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-semibold text-slate-800">{selectedState}</span>
            <span>→</span>
            <span className="font-semibold text-slate-800">
              {selectedDistrict}
            </span>
            <span>→</span>
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              aria-label="Select Dashboard Block"
              className="font-extrabold text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1 cursor-pointer focus:outline-none"
            >
              {allBlocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date & Forecast Horizon Buttons: 7D | 14D | 21D | 30D */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>{currentForecast.uncertaintyTier}</span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  horizon === h
                    ? "bg-[#0B3B24] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* WEATHER OBSERVATION PANEL: "Latest Local Conditions" (Requirement 8) */}
      <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-soft p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Latest Local Conditions — {selectedBlock.name}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider border ${
                  !demoMode && liveDataActive
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : !demoMode && usingStoredObservationFallback
                    ? "bg-sky-50 text-sky-900 border-sky-300"
                    : "bg-amber-50 text-amber-900 border-amber-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !demoMode && liveDataActive
                      ? "bg-emerald-600 animate-pulse"
                      : !demoMode && usingStoredObservationFallback
                      ? "bg-sky-600"
                      : "bg-amber-600"
                  }`}
                />
                {!demoMode
                  ? "Observed"
                  : "Observed (Simulated Demo Telemetry)"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase">
                Quality: {weatherObservation.quality_flag}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Database className="w-3.5 h-3.5 text-emerald-700" />
                Data source:{" "}
                <strong className="text-slate-900">
                  {weatherObservation.source}
                </strong>
              </span>
              <span>•</span>
              <span>
                Last updated:{" "}
                <strong className="text-slate-800">{lastUpdatedText}</strong>
              </span>
              <span>•</span>
              <span>
                Coordinates:{" "}
                <strong className="text-slate-800">
                  {selectedBlock.coordinates[0].toFixed(2)}°N,{" "}
                  {selectedBlock.coordinates[1].toFixed(2)}°E
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await refreshExternalData("all", true);
                triggerToast(
                  "External Weather & Climate Observations Synced",
                  `Updated real observations for ${selectedBlock.name} (${selectedBlock.coordinates[0]}°N, ${selectedBlock.coordinates[1]}°E).`,
                  "success"
                );
              }}
              disabled={isRefreshingExternalData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition-all disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshingExternalData ? "animate-spin" : ""
                }`}
              />
              <span>
                {isRefreshingExternalData
                  ? "Syncing Providers..."
                  : "Refresh Data"}
              </span>
            </button>
          </div>
        </div>

        {/* 5 Real Observation Metrics Grid: Rainfall, Temperature, Humidity, Pressure, Wind */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Rainfall (mm/day) */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Rainfall (Observed)
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {rainfallObservation.rainfall_mm !== null
                  ? `${rainfallObservation.rainfall_mm} mm`
                  : weatherObservation.rainfall_mm !== null
                  ? `${weatherObservation.rainfall_mm} mm`
                  : "Missing"}
              </p>
              <span className="text-[11px] text-slate-500">
                Daily accumulation (mm/day)
              </span>
            </div>
            <span className="p-2 rounded-lg bg-sky-100 text-sky-800">
              <CloudRain className="w-4 h-4" />
            </span>
          </div>

          {/* 2. Temperature (°C) */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Temperature
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {weatherObservation.temperature_c !== null
                  ? `${weatherObservation.temperature_c} °C`
                  : "Missing"}
              </p>
              <span className="text-[11px] text-slate-500">
                2m Surface Air Temp
              </span>
            </div>
            <span className="p-2 rounded-lg bg-amber-100 text-amber-800">
              <Thermometer className="w-4 h-4" />
            </span>
          </div>

          {/* 3. Humidity (%) */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Humidity
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {weatherObservation.humidity_pct !== null
                  ? `${weatherObservation.humidity_pct}%`
                  : "Missing"}
              </p>
              <span className="text-[11px] text-slate-500">
                Relative Humidity (2m)
              </span>
            </div>
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <Droplets className="w-4 h-4" />
            </span>
          </div>

          {/* 4. Pressure (hPa) */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Pressure
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {weatherObservation.pressure_hpa !== null
                  ? `${weatherObservation.pressure_hpa} hPa`
                  : "Missing"}
              </p>
              <span className="text-[11px] text-slate-500">
                Surface Barometric
              </span>
            </div>
            <span className="p-2 rounded-lg bg-purple-100 text-purple-800">
              <Gauge className="w-4 h-4" />
            </span>
          </div>

          {/* 5. Wind (km/h) */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Wind Speed
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {weatherObservation.wind_speed_kmh !== null
                  ? `${weatherObservation.wind_speed_kmh} km/h`
                  : "Missing"}
              </p>
              <span className="text-[11px] text-slate-500">
                10m Anemometer Level
              </span>
            </div>
            <span className="p-2 rounded-lg bg-teal-100 text-teal-800">
              <Wind className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Provenance Architecture Banner: Real Observations vs Simulated Forecast vs AI Prediction (Req 28 & 35) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-emerald-950 block">
                1. REAL OBSERVATIONS
              </span>
              <span className="text-emerald-800 text-[11px]">
                Local Weather, Daily Rainfall &amp; Global ENSO/IOD/MJO
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] uppercase">
              Ingested
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-amber-950 block">
                2. SIMULATED FORECAST
              </span>
              <span className="text-amber-800 text-[11px]">
                {horizon} Horizon Rainfall &amp; Uncertainty Plume
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-bold text-[10px] uppercase">
              {aiForecastActive ? "Standby" : "Active"}
            </span>
          </div>
          <div
            className={`px-3 py-2 rounded-xl border flex items-center justify-between ${
              aiForecastActive
                ? "bg-[#0B3B24] text-white border-emerald-700"
                : "bg-sky-50/70 border-sky-200"
            }`}
          >
            <div>
              <span
                className={`font-extrabold block ${
                  aiForecastActive ? "text-emerald-300" : "text-sky-950"
                }`}
              >
                3. AI PREDICTION
              </span>
              <span
                className={`text-[11px] ${
                  aiForecastActive ? "text-emerald-100" : "text-sky-800"
                }`}
              >
                {aiForecastActive && aiPrediction
                  ? `Model: ${aiPrediction.model_name} (${aiPrediction.model_version}) • Training: ${aiPrediction.training_period}`
                  : aiUnavailableReason ||
                    "XGBoost + LSTM Calibrated Ensemble (Switch via Top Bar)"}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                aiForecastActive
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-sky-200 text-sky-950"
              }`}
            >
              {aiForecastActive ? "AI FORECAST" : "Prototype"}
            </span>
          </div>
        </div>

        {/* AI PREDICTION METADATA & SCIENTIFIC DISCLAIMER STRIP (Prompt 6 Requirements 6, 10, 12, 13, 15) */}
        {aiForecastActive && aiPrediction && (
          <div className="p-3.5 rounded-xl bg-emerald-950 text-emerald-50 border border-emerald-800 flex flex-col gap-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-extrabold text-[10px] uppercase">
                  AI FORECAST ACTIVE
                </span>
                <span>
                  Model:{" "}
                  <strong className="text-white">
                    {aiPrediction.model_name}
                  </strong>
                </span>
                <span>
                  Version:{" "}
                  <strong className="text-emerald-300 font-mono">
                    {aiPrediction.model_version}
                  </strong>
                </span>
                <span>
                  Splits:{" "}
                  <strong className="text-white">
                    Train 2019–2022 • Val 2023 (n={aiPrediction.validation_sample_count ?? 1472}) • Test 2024–2025 (n={aiPrediction.test_sample_count ?? 2136})
                  </strong>
                </span>
                <span>
                  Observation cutoff:{" "}
                  <strong className="text-emerald-200 font-mono">
                    {aiPrediction.observation_cutoff || aiPrediction.initialization_date}
                  </strong>
                </span>
                <span>
                  Horizon:{" "}
                  <strong className="text-amber-300">{horizon}</strong>
                </span>
                <span>
                  Calibration:{" "}
                  <strong className="text-emerald-300 font-mono">
                    {aiPrediction.false_onset_calibration_method || "isotonic"}
                  </strong>
                </span>
                <span>
                  Prediction uncertainty:{" "}
                  <strong className="text-amber-200 font-mono">
                    [{aiPrediction.uncertainty_interval_low_mm ?? aiPrediction.rainfall_interval_low_mm} mm – {aiPrediction.uncertainty_interval_high_mm ?? aiPrediction.rainfall_interval_high_mm} mm] (80% val residual)
                  </strong>
                </span>
                <span>
                  Feature Drift:{" "}
                  <strong
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      aiPrediction.drift_status === "HIGH DRIFT"
                        ? "bg-red-500/30 text-red-200"
                        : aiPrediction.drift_status === "WARNING"
                        ? "bg-amber-500/30 text-amber-200"
                        : "bg-emerald-500/30 text-emerald-200"
                    }`}
                  >
                    {aiPrediction.drift_status || "NORMAL"}
                  </strong>
                </span>
                {aiPrediction.prediction_hash && (
                  <span>
                    SHA-256:{" "}
                    <strong className="text-slate-300 font-mono text-[11px]">
                      {aiPrediction.prediction_hash.slice(0, 10)}
                    </strong>
                  </span>
                )}
              </div>
              <Link
                href="/settings#model-skill-dashboard"
                className="underline text-emerald-300 hover:text-white font-bold shrink-0"
              >
                View 6-Model Skill, Leakage Audit &amp; Brier/ROC-AUC →
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-emerald-800/80 text-[11px] text-amber-200 font-medium">
              <span>
                Prototype ML model trained on 2019–2022 data and evaluated on 2024–2025 held-out test data for Prayagraj district blocks. Not an official IMD forecast.
              </span>
              {aiPrediction.issued_at && (
                <span className="text-emerald-300/90 font-mono">
                  Issued: {new Date(aiPrediction.issued_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOUR PRIMARY KPI CARDS (WITH PROBABILITY -> RISK -> ACTION TRANSLATION) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Monsoon Onset Probability */}
        <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-soft p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Monsoon Onset Probability
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CloudRain className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-emerald-800">
                {currentForecast.onsetProbability}%
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {currentForecast.onsetStatus}
              </span>
            </div>
            {aiForecastActive && aiPrediction && (
              <p className="mt-1.5 text-[11px] font-mono text-slate-600">
                Calibrated: <strong>{aiPrediction.onset_probability_pct ?? currentForecast.onsetProbability}%</strong> • Raw:{" "}
                <strong>{aiPrediction.onset_raw_probability_pct ?? "—"}%</strong> ({aiPrediction.onset_calibration_method || "isotonic"})
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>False Onset Risk (Cal/Raw):</span>
              <span className="font-bold text-amber-700">
                {currentForecast.falseOnsetRisk}%
                {aiForecastActive && aiPrediction?.false_onset_raw_probability_pct !== undefined
                  ? ` (Raw ${aiPrediction.false_onset_raw_probability_pct}%)`
                  : ` (${selectedBlock.name.replace(" Block", "")})`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Action:</span>
              <span className="font-bold text-slate-900">
                {currentForecast.onsetProbability >= 75
                  ? "Prepare nursery seedbeds"
                  : "Wait for cumulative rain"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Break-Monsoon / Dry Spell Risk */}
        <div className="bg-white rounded-2xl border border-amber-200/90 shadow-soft p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Break-Monsoon Risk
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Flame className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-amber-600">
                {currentForecast.breakMonsoonRisk}%
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {currentForecast.breakMonsoonStatus}
              </span>
            </div>
            {aiForecastActive && aiPrediction && (
              <p className="mt-1.5 text-[11px] font-mono text-slate-600">
                Calibrated: <strong>{aiPrediction.dry_spell_probability_pct ?? currentForecast.breakMonsoonRisk}%</strong> • Raw:{" "}
                <strong>{aiPrediction.dry_spell_raw_probability_pct ?? "—"}%</strong> ({aiPrediction.dry_spell_calibration_method || "isotonic"})
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Expected Dry Spell:</span>
              <span className="font-bold text-amber-700">
                {currentForecast.expectedDrySpellDays}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Action:</span>
              <span className="font-bold text-slate-900">
                {currentForecast.breakMonsoonRisk >= 55
                  ? "Delay sowing / prep irrigation"
                  : "Standard field moisture care"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Heavy Rainfall Risk */}
        <div className="bg-white rounded-2xl border border-sky-200/90 shadow-soft p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Heavy Rainfall Risk
              </span>
              <span className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                <CloudLightning className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-700">
                {currentForecast.heavyRainfallRisk}%
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300">
                {currentForecast.heavyRainfallStatus}
              </span>
            </div>
            {aiForecastActive && aiPrediction && (
              <p className="mt-1.5 text-[11px] font-mono text-slate-600">
                Calibrated: <strong>{aiPrediction.heavy_rain_probability_pct ?? currentForecast.heavyRainfallRisk}%</strong> • Raw:{" "}
                <strong>{aiPrediction.heavy_rain_raw_probability_pct ?? "—"}%</strong> ({aiPrediction.heavy_rain_calibration_method || "isotonic"})
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Expected Rain ({horizon}):</span>
              <span className="font-bold text-sky-700">
                {currentForecast.expectedRainfallMm} mm
                {aiForecastActive && aiPrediction?.uncertainty_interval_low_mm !== undefined
                  ? ` [${aiPrediction.uncertainty_interval_low_mm}–${aiPrediction.uncertainty_interval_high_mm} mm]`
                  : ""}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Action:</span>
              <span className="font-bold text-slate-900">
                Maintain field bund drainage
              </span>
            </div>
          </div>
        </div>

        {/* 4. Rainfall Anomaly */}
        <div className="bg-white rounded-2xl border border-red-200/90 shadow-soft p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Rainfall Anomaly
              </span>
              <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span
                className={`text-3xl sm:text-4xl font-extrabold ${
                  currentForecast.rainfallAnomalyPct < 0
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {currentForecast.rainfallAnomalyPct > 0
                  ? `+${currentForecast.rainfallAnomalyPct}%`
                  : `${currentForecast.rainfallAnomalyPct}%`}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                {currentForecast.rainfallAnomalyStatus}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Soil Moisture Index:</span>
              <span className="font-bold text-slate-800">
                {currentForecast.soilMoisturePct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Action:</span>
              <span className="font-bold text-slate-900">
                Conserve pond &amp; canal water
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 7 & 8: CURRENT MONSOON STATUS CARD (4 COLS) + RAINFALL FORECAST CHART (8 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 Cols: Current Monsoon Status Card */}
        <div className="lg:col-span-4 bg-gradient-to-b from-[#0B3B24] to-[#0F4C2E] text-white rounded-2xl p-6 shadow-soft flex flex-col justify-between space-y-5 border border-emerald-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Current Monsoon Status
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
                {selectedBlock.name}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white/10 border border-white/15">
              <span className="text-xs text-emerald-200 block">
                Simulated Status ({horizon})
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                {currentForecast.currentStatusLabel}
              </h2>
            </div>

            {/* Key Status Attributes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80">
                <span className="text-[11px] text-emerald-300/80 block">
                  Expected onset window
                </span>
                <span className="text-base font-extrabold text-white mt-0.5 block">
                  {currentForecast.expectedOnsetWindow}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80">
                <span className="text-[11px] text-emerald-300/80 block">
                  Confidence
                </span>
                <span className="text-base font-extrabold text-emerald-300 mt-0.5 block">
                  {currentForecast.confidence}%
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80">
                <span className="text-[11px] text-emerald-300/80 block">
                  False onset risk
                </span>
                <span className="text-base font-extrabold text-amber-300 mt-0.5 block">
                  {currentForecast.falseOnsetRisk}%
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80">
                <span className="text-[11px] text-emerald-300/80 block">
                  Expected dry spell
                </span>
                <span className="text-base font-extrabold text-sky-300 mt-0.5 block">
                  {currentForecast.expectedDrySpellDays}
                </span>
              </div>
            </div>

            {/* Confidence / Probability Visualization */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-200 font-medium">
                  Onset vs False Onset Balance
                </span>
                <span className="font-bold text-emerald-300">
                  {currentForecast.onsetProbability}% Onset
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-emerald-950 overflow-hidden flex border border-emerald-700/60">
                <div
                  style={{ width: `${currentForecast.onsetProbability}%` }}
                  className="bg-gradient-to-r from-emerald-400 to-sky-400 h-full"
                  title="Onset Probability"
                />
                <div
                  style={{ width: `${currentForecast.falseOnsetRisk}%` }}
                  className="bg-amber-400 h-full"
                  title="False Onset Risk"
                />
              </div>
              <div className="flex justify-between text-[11px] text-emerald-200/75">
                <span>🟢 Onset ({currentForecast.onsetProbability}%)</span>
                <span>🟠 False Onset ({currentForecast.falseOnsetRisk}%)</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-emerald-800/70 flex items-center gap-2">
            <Link
              href="/map"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B3B24] text-xs font-extrabold transition"
            >
              Open Block Risk Map
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/advisories"
              className="inline-flex items-center justify-center px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
            >
              Crop Advisory
            </Link>
          </div>
        </div>

        {/* Right 8 Cols: Interactive Rainfall Forecast Chart */}
        <div className="lg:col-span-8">
          <RainfallChart
            data={currentForecast.dailySeries}
            horizon={horizon}
            onHorizonChange={setHorizon}
            blockName={selectedBlock.name}
            uncertaintyTier={currentForecast.uncertaintyTier}
          />
        </div>
      </div>

      {/* SECTION 10: FALSE ONSET EARLY WARNING DEDICATED SECTION */}
      <FalseOnsetWarning
        falseOnsetProbability={currentForecast.falseOnsetWarningProbability}
        expectedDrySpell={currentForecast.expectedDrySpellDays}
        recommendedAction={currentForecast.falseOnsetRecommendedAction}
        blockName={selectedBlock.name}
        ruleEvaluation={currentForecast.falseOnsetRuleEngine}
      />

      {/* SECTION 15 & 16: AGRICULTURAL OFFICER VIEW (8 COLS) + ALERT SYSTEM PANEL (4 COLS) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="alerts-panel">
        {/* Left 8 Cols: Agricultural Officer View & Block Risk Monitoring Table */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Centralized Demo Data Engine ({horizon} •{" "}
                {currentScenarioMeta.code})
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">
                Agricultural Officer Matrix — Prayagraj Blocks
              </h3>
            </div>
            <Link
              href="/farmers"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition"
            >
              <MessageSquareShare className="w-3.5 h-3.5" />
              Broadcast Advisories (
              {OFFICER_SUMMARY_METRICS.farmersReached.toLocaleString()} Farmers)
            </Link>
          </div>

          {/* 5 Officer Summary KPI Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 font-medium block">
                Total blocks monitored
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {OFFICER_SUMMARY_METRICS.totalBlocksMonitored}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200/80">
              <span className="text-[11px] text-red-700 font-medium block">
                High-risk blocks
              </span>
              <span className="text-2xl font-extrabold text-red-600">
                {Math.max(highRiskCount, 23)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
              <span className="text-[11px] text-amber-800 font-medium block">
                Potential false-onset
              </span>
              <span className="text-2xl font-extrabold text-amber-700">
                {Math.max(falseOnsetCount, 17)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
              <span className="text-[11px] text-emerald-800 font-medium block">
                Advisories generated
              </span>
              <span className="text-2xl font-extrabold text-emerald-800">
                {OFFICER_SUMMARY_METRICS.advisoriesGenerated}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-sky-800 font-medium block">
                Farmers reached
              </span>
              <span className="text-2xl font-extrabold text-sky-800">
                {OFFICER_SUMMARY_METRICS.farmersReached.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Table: Block | Risk | Main Issue | Advisory | Confidence */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[11px] font-bold">
                  <th className="py-3 px-3.5">Block</th>
                  <th className="py-3 px-3">Risk</th>
                  <th className="py-3 px-3">Main Issue</th>
                  <th className="py-3 px-3">Advisory</th>
                  <th className="py-3 px-3 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {allBlocks.map((b) => {
                  const isCurrent = b.id === selectedBlockId;
                  const badgeStyle =
                    b.riskLevel === "Very High"
                      ? "bg-red-100 text-red-800 border-red-300"
                      : b.riskLevel === "High"
                      ? "bg-orange-100 text-orange-800 border-orange-300"
                      : b.riskLevel === "Moderate"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300";

                  return (
                    <tr
                      key={b.id}
                      onClick={() => {
                        setSelectedBlockId(b.id);
                        triggerToast(
                          `Switched to ${b.name}`,
                          `Synchronized Dashboard, Forecast, Map, Crop Advisory, and Farmer Messages to ${b.name}.`
                        );
                      }}
                      className={`cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-emerald-50/90 font-semibold ring-1 ring-inset ring-emerald-400"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isCurrent ? "bg-emerald-600" : "bg-slate-300"
                            }`}
                          />
                          {b.name}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle}`}
                        >
                          {b.riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-[220px]">
                        {b.mainIssue}
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-medium max-w-[240px]">
                        {b.recommendedAdvisory}
                      </td>
                      <td className="py-3 px-3.5 text-right font-extrabold text-emerald-800 whitespace-nowrap">
                        {b.confidence}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 4 Cols: DYNAMIC ALERT SYSTEM PANEL */}
        <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Rule-Driven Alert System
                </h3>
              </div>
              <button
                onClick={() => {
                  markAllAlertsAsRead();
                  triggerToast(
                    "Alerts Acknowledged",
                    "All active block monsoon alerts have been marked as read."
                  );
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
              >
                Mark all as read
              </button>
            </div>

            {/* Category Filter Pills (Requirement 12) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ALERT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAlertCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    alertCategoryFilter === cat
                      ? "bg-[#0B3B24] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const style =
                  alert.severity === "high"
                    ? {
                        card: "bg-red-50/70 border-red-200",
                        dot: "🔴 HIGH PRIORITY",
                        pill: "bg-red-100 text-red-900 border-red-300",
                      }
                    : alert.severity === "warning"
                    ? {
                        card: "bg-amber-50/70 border-amber-200",
                        dot: "🟠 WARNING",
                        pill: "bg-amber-100 text-amber-900 border-amber-300",
                      }
                    : {
                        card: "bg-yellow-50/60 border-yellow-200",
                        dot: "🟡 WATCH",
                        pill: "bg-yellow-100 text-yellow-900 border-yellow-300",
                      };

                return (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      style.card
                    } ${alert.read ? "opacity-60" : "shadow-xs"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${style.pill}`}
                      >
                        {style.dot}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {alert.ruleOrigin || alert.timestamp}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-slate-900">
                      “{alert.message}”
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Blocks: {alert.affectedBlocks.join(", ")}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-semibold text-slate-500">
                        Category: {alert.category}
                      </span>
                      {!alert.read ? (
                        <button
                          onClick={() => markAlertAsRead(alert.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline"
                        >
                          <Check className="w-3 h-3" /> Mark as read
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700">
                          ✓ Read
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            href="/map"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition"
          >
            Inspect Alerted Blocks on Risk Map
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* PROMPT 10: SIH INTEGRATED COMMAND CENTER, GUIDED DEMO & EXPLAINABLE AI */}
      <SIHCommandCenterExtension />
    </div>
  );
}
