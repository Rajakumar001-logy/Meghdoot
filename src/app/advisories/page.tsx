"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  Cpu,
  Droplets,
  Flame,
  Info,
  MessageSquareShare,
  RefreshCw,
  ShieldAlert,
  Sprout,
  Filter,
  Clock,
  Layers,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import {
  computeOfficerDistrictOverview,
  evaluateCropAdvisories,
} from "@/services/advisoryEngine";
import { CROP_PROFILES } from "@/config/advisoryRules";
import {
  AdvisoryEngineResult,
  AdvisorySourceMode,
  SupportedCropId,
} from "@/types/advisory";
import { fetchGISBlockIntelligence } from "@/services/gisService";
import { BlockSpatialIntelligence } from "@/types/gis";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";

const HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

type OfficerFilterType =
  | "all"
  | "high_dry_spell"
  | "high_false_onset"
  | "high_heavy_rain"
  | "high_onset_uncertainty";

export default function CropAdvisoryPage() {
  const {
    selectedState,
    setSelectedState,
    selectedDistrict,
    setSelectedDistrict,
    selectedBlockId,
    setSelectedBlockId,
    selectedBlock,
    selectedCropId,
    setSelectedCropId,
    selectedCrop,
    selectedStage,
    setSelectedStage,
    selectedLanguage,
    setSelectedLanguage,
    horizon,
    setHorizon,
    demoScenario,
    forecastEngineMode,
    setForecastEngineMode,
    allBlocks,
    allCrops,
    stateDistricts,
    triggerBriefLoading,
    triggerToast,
  } = useMonsoon();

  const [spatialBlocksMap, setSpatialBlocksMap] = useState<
    Record<string, BlockSpatialIntelligence>
  >({});
  const [stageUnspecified, setStageUnspecified] = useState<boolean>(false);
  const [simulateExpiredPrediction, setSimulateExpiredPrediction] =
    useState<boolean>(false);
  const [officerFilter, setOfficerFilter] = useState<OfficerFilterType>("all");
  const [officerSortBy, setOfficerSortBy] = useState<
    "dry_spell" | "false_onset" | "heavy_rain" | "advisory_count"
  >("dry_spell");

  const advisoryMode: AdvisorySourceMode =
    forecastEngineMode === "AI_FORECAST"
      ? "AI"
      : forecastEngineMode === "SIMULATED"
      ? "SIMULATED"
      : "DEMO";

  // Load spatial intelligence (real observations + MPAI-ENS-0.1 multi-horizon forecasts)
  useEffect(() => {
    let mounted = true;
    fetchGISBlockIntelligence({
      horizon,
      engineMode: forecastEngineMode,
      scenario: demoScenario,
    }).then((res) => {
      if (!mounted || !res?.blocks) return;
      const map: Record<string, BlockSpatialIntelligence> = {};
      for (const b of res.blocks) {
        map[b.block_id] = b;
      }
      setSpatialBlocksMap(map);
    });
    return () => {
      mounted = false;
    };
  }, [horizon, forecastEngineMode, demoScenario]);

  const activeSpatialBlock = spatialBlocksMap[selectedBlockId] || null;
  const cropIdTyped = (
    CROP_PROFILES[selectedCropId as SupportedCropId] ? selectedCropId : "paddy"
  ) as SupportedCropId;
  const cropProfile = CROP_PROFILES[cropIdTyped];
  const horizonDays = (parseInt(horizon.replace("D", ""), 10) || 14) as
    | 7
    | 14
    | 21
    | 30;

  // Compute deterministic block + crop advisory bundle
  const advisoryBundle: AdvisoryEngineResult = useMemo(() => {
    const pred = activeSpatialBlock?.prediction;
    const obs = activeSpatialBlock?.observation;

    // In AI mode, real observations from ERA5/Open-Meteo do not include in-situ soil moisture sensors.
    // Section 3: Do NOT fabricate soil moisture -> pass null so it displays "Soil moisture unavailable"
    const soilMoistureInput =
      advisoryMode === "AI" ? null : selectedBlock.soilMoisture;

    const onsetProb =
      advisoryMode === "AI" &&
      pred?.onset_probability !== null &&
      pred?.onset_probability !== undefined
        ? pred.onset_probability
        : selectedBlock.onsetProbability / 100.0;

    const falseOnsetProb =
      advisoryMode === "AI" &&
      pred?.false_onset_probability !== null &&
      pred?.false_onset_probability !== undefined
        ? pred.false_onset_probability
        : selectedBlock.falseOnsetProbability / 100.0;

    const drySpellProb =
      advisoryMode === "AI" &&
      pred?.dry_spell_probability !== null &&
      pred?.dry_spell_probability !== undefined
        ? pred.dry_spell_probability
        : selectedBlock.drySpellProbability / 100.0;

    const heavyRainProb =
      advisoryMode === "AI" &&
      pred?.heavy_rain_probability !== null &&
      pred?.heavy_rain_probability !== undefined
        ? pred.heavy_rain_probability
        : selectedBlock.heavyRainProbability / 100.0;

    const expectedRain =
      advisoryMode === "AI" &&
      pred?.expected_rainfall_mm !== null &&
      pred?.expected_rainfall_mm !== undefined
        ? pred.expected_rainfall_mm
        : selectedBlock.expectedRainfall;

    const anomalyPct =
      advisoryMode === "AI" &&
      pred?.rainfall_anomaly_pct !== null &&
      pred?.rainfall_anomaly_pct !== undefined
        ? pred.rainfall_anomaly_pct
        : selectedBlock.rainfallAnomaly;

    const nowIso = "2026-06-15T10:00:00Z";
    const validUntilIso = simulateExpiredPrediction
      ? "2026-06-10T10:00:00Z" // Past timestamp to trigger EXPIRED status
      : "2026-06-29T10:00:00Z";

    return evaluateCropAdvisories({
      location_id: selectedBlockId,
      block_name: selectedBlock.name,
      district: selectedDistrict,
      state: selectedState,
      crop_id: cropIdTyped,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      crop_stage: stageUnspecified ? null : selectedStage,
      current_rainfall: obs?.rainfall_mm ?? 21.4,
      recent_rainfall: obs?.cumulative_7d_rain_mm ?? 58.2,
      rainfall_anomaly: anomalyPct,
      temperature: obs?.temperature_c ?? 29.8,
      humidity: obs?.humidity_pct ?? 84.0,
      soil_moisture: soilMoistureInput,
      onset_probability: onsetProb,
      false_onset_probability: falseOnsetProb,
      dry_spell_probability: drySpellProb,
      heavy_rain_probability: heavyRainProb,
      expected_rainfall: expectedRain,
      model_version:
        advisoryMode === "AI"
          ? pred?.model_version || "MPAI-ENS-0.1"
          : advisoryMode === "SIMULATED"
          ? "SIM-PROTO-v1"
          : "DEMO-SCENARIO-v1",
      observation_cutoff:
        pred?.observation_cutoff || obs?.observation_timestamp || "2025-08-31",
      prediction_issued_at: "2026-06-15T06:00:00Z",
      prediction_valid_until: validUntilIso,
      reference_timestamp: nowIso,
      evaluation_month: 6,
      source_mode: advisoryMode,
    });
  }, [
    activeSpatialBlock,
    advisoryMode,
    selectedBlockId,
    selectedBlock,
    selectedDistrict,
    selectedState,
    cropIdTyped,
    horizon,
    horizonDays,
    stageUnspecified,
    selectedStage,
    simulateExpiredPrediction,
  ]);

  // Compute District-Wide Officer Triage View (Section 20)
  const officerOverviewRows = useMemo(() => {
    const aiMap: Record<string, any> = {};
    Object.values(spatialBlocksMap).forEach((sb) => {
      aiMap[sb.block_id] = {
        onset_probability: sb.prediction?.onset_probability,
        false_onset_probability: sb.prediction?.false_onset_probability,
        dry_spell_probability: sb.prediction?.dry_spell_probability,
        heavy_rain_probability: sb.prediction?.heavy_rain_probability,
        expected_rainfall_mm: sb.prediction?.expected_rainfall_mm,
        rainfall_anomaly_pct: sb.prediction?.rainfall_anomaly_pct,
        current_rainfall_mm: sb.observation?.rainfall_mm,
        recent_7d_rainfall_mm: sb.observation?.cumulative_7d_rain_mm,
        temperature_c: sb.observation?.temperature_c,
        humidity_pct: sb.observation?.humidity_pct,
        observation_cutoff: sb.prediction?.observation_cutoff || "2025-08-31",
        model_version: sb.prediction?.model_version || "MPAI-ENS-0.1",
      };
    });

    const rows = computeOfficerDistrictOverview({
      horizon,
      mode: advisoryMode,
      cropId: cropIdTyped,
      scenario: demoScenario,
      aiBlockMap: aiMap,
    });

    const filtered = rows.filter((r) => {
      if (officerFilter === "high_dry_spell")
        return r.dry_spell_probability_pct >= 30;
      if (officerFilter === "high_false_onset")
        return r.false_onset_probability_pct >= 30;
      if (officerFilter === "high_heavy_rain")
        return r.heavy_rain_probability_pct >= 30;
      if (officerFilter === "high_onset_uncertainty")
        return r.onset_uncertainty_high;
      return true;
    });

    return filtered.sort((a, b) => {
      if (officerSortBy === "dry_spell")
        return b.dry_spell_probability_pct - a.dry_spell_probability_pct;
      if (officerSortBy === "false_onset")
        return b.false_onset_probability_pct - a.false_onset_probability_pct;
      if (officerSortBy === "heavy_rain")
        return b.heavy_rain_probability_pct - a.heavy_rain_probability_pct;
      return b.active_advisory_count - a.active_advisory_count;
    });
  }, [
    spatialBlocksMap,
    horizon,
    advisoryMode,
    cropIdTyped,
    demoScenario,
    officerFilter,
    officerSortBy,
  ]);

  const isHindi = selectedLanguage === "Hindi";
  const topAdvisory = advisoryBundle.active_advisories[0] || null;

  return (
    <div className="space-y-6">
      {/* 1. SCIENTIFIC LIMITATION BANNER (Section 27 & 28) */}
      <div className="bg-amber-950 text-amber-100 rounded-2xl border border-amber-700/80 px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-amber-300">
              {isHindi
                ? advisoryBundle.prototype_rule_disclaimer_hi
                : advisoryBundle.prototype_rule_disclaimer_en}
            </p>
            <p className="text-[11px] text-amber-100/90 mt-0.5">
              {isHindi
                ? advisoryBundle.scientific_disclaimer_hi
                : advisoryBundle.scientific_disclaimer_en}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-amber-900/90 border border-amber-600 text-[10px] font-extrabold uppercase shrink-0">
          SOURCE: {advisoryBundle.source_mode} ({advisoryBundle.model_version})
        </span>
      </div>

      {/* 2. PAGE HEADER & MODE / LANGUAGE CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900">
              <Sprout className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Deterministic Crop-Specific AI Decision Engine
            </span>
            <span className="px-2.5 py-0.5 rounded bg-[#0B3B24] text-emerald-300 text-[10px] font-extrabold uppercase">
              Mode: {advisoryBundle.source_mode} • Model:{" "}
              {advisoryBundle.model_version}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {isHindi
              ? `फसल-विशिष्ट कृषि निर्णय एवं परामर्श केंद्र (${selectedBlock.name})`
              : `Crop-Specific AI Advisory & Decision Engine (${selectedBlock.name})`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Combines <strong>REAL OBSERVATIONS</strong> +{" "}
            <strong>{advisoryBundle.source_mode} FORECAST ({horizon})</strong> +{" "}
            <strong>CROP PROFILE ({cropProfile.name})</strong> into traceable{" "}
            <code>WHAT / WHY / WHEN / ACTION</code> advisories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source Mode Separation Switcher (Section 23: AI | SIMULATED | DEMO) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setForecastEngineMode("AI_FORECAST")}
              className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                forecastEngineMode === "AI_FORECAST"
                  ? "bg-[#0B3B24] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              AI (MPAI-ENS-0.1)
            </button>
            <button
              onClick={() => setForecastEngineMode("SIMULATED")}
              className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                forecastEngineMode === "SIMULATED"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              SIMULATED
            </button>
            <button
              onClick={() => setForecastEngineMode("DEMO")}
              className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                forecastEngineMode === "DEMO"
                  ? "bg-emerald-700 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              DEMO
            </button>
          </div>

          {/* Bilingual Selector (Section 14: English | Hindi) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {(["English", "Hindi"] as FarmerLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                  selectedLanguage === lang
                    ? "bg-[#0B3B24] text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lang === "Hindi" ? "हिन्दी (Hindi)" : "English"}
              </button>
            ))}
          </div>

          <Link
            href="/farmers"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition"
          >
            <MessageSquareShare className="w-4 h-4 text-emerald-400" />
            Farmer Outlook &amp; Dispatch
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. FILTER BAR: STATE | DISTRICT | BLOCK | CROP | GROWTH STAGE | HORIZON */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              State
            </label>
            <select
              value={selectedState}
              onChange={(e) => {
                const st = e.target.value;
                setSelectedState(st);
                setSelectedDistrict((stateDistricts[st] || ["Prayagraj"])[0]);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
            >
              {Object.keys(stateDistricts).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
            >
              {(stateDistricts[selectedState] || ["Prayagraj"]).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              GIS Block (location_id)
            </label>
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="w-full rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs font-extrabold text-emerald-950"
            >
              {allBlocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Crop (crop_id)
            </label>
            <select
              value={selectedCropId}
              onChange={(e) => setSelectedCropId(e.target.value)}
              className="w-full rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs font-extrabold text-emerald-950"
            >
              {allCrops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({CROP_PROFILES[c.id as SupportedCropId]?.season})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Growth Stage (Section 10)
            </label>
            <select
              value={stageUnspecified ? "__UNSPECIFIED__" : selectedStage}
              onChange={(e) => {
                if (e.target.value === "__UNSPECIFIED__") {
                  setStageUnspecified(true);
                } else {
                  setStageUnspecified(false);
                  setSelectedStage(e.target.value);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
            >
              <option value="__UNSPECIFIED__">
                Not Specified (Stage-Independent)
              </option>
              {selectedCrop.stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Forecast Horizon
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`py-1 rounded-lg text-xs font-extrabold transition ${
                    horizon === h
                      ? "bg-[#0B3B24] text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Crop Metadata Profile Strip (Section 1) + Expiration Test Toggle (Section 22) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-extrabold text-emerald-950">
              {cropProfile.name} (<em>{cropProfile.scientific_name}</em>) •{" "}
              {cropProfile.local_names.hi}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
              Season: <strong>{cropProfile.season}</strong> (
              {cropProfile.sowing_window.label_en})
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
              Water Req: <strong>{cropProfile.water_requirement}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 font-semibold">
              Sensitivities: Dry Spell{" "}
              <strong>{cropProfile.dry_spell_sensitivity}</strong> |
              Waterlogging{" "}
              <strong>{cropProfile.waterlogging_sensitivity}</strong> | Excess
              Rain <strong>{cropProfile.excess_rain_sensitivity}</strong>
            </span>
          </div>

          <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={simulateExpiredPrediction}
              onChange={(e) => setSimulateExpiredPrediction(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Test Expired Prediction State (Section 22)</span>
          </label>
        </div>
      </div>

      {/* 4. BLOCK-SPECIFIC ADVISORY & EXPLANATION GRID (Section 18) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 8 COLS: BLOCK + CROP + CURRENT CONDITIONS + AI OUTLOOK + DETERMINISTIC ADVISORIES */}
        <div className="lg:col-span-8 space-y-5">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft overflow-hidden">
            <div className="bg-gradient-to-r from-[#0B3B24] to-emerald-900 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-emerald-400 text-[#0B3B24] text-[10px] font-extrabold uppercase">
                    BLOCK: {advisoryBundle.block_name}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-white/15 text-emerald-200 text-[10px] font-extrabold uppercase">
                    CROP: {cropProfile.name} ({cropProfile.season})
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-bold">
                    {isHindi
                      ? advisoryBundle.crop_stage_status_hi
                      : advisoryBundle.crop_stage_status_en}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold mt-1">
                  {topAdvisory
                    ? isHindi
                      ? topAdvisory.hi.title
                      : topAdvisory.en.title
                    : isHindi
                    ? "पूर्वानुमान की समय-सीमा समाप्त (EXPIRED)"
                    : "Prediction Expired — No Active Advisories Displayed"}
                </h2>
                <p className="text-xs text-emerald-100/90">
                  Soil Moisture:{" "}
                  <strong>
                    {isHindi
                      ? advisoryBundle.soil_moisture_status_hi
                      : advisoryBundle.soil_moisture_status_en}
                  </strong>{" "}
                  • Observation Cutoff:{" "}
                  <strong>{advisoryBundle.observation_cutoff}</strong> • Valid
                  Until:{" "}
                  <strong>{advisoryBundle.valid_until.slice(0, 10)}</strong>
                </p>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                  Evidence Basis (Section 12)
                </span>
                <span className="text-sm font-extrabold text-white block">
                  {advisoryBundle.active_advisories.length} Active Rules Matched
                </span>
                <span className="text-[10px] text-emerald-200 block">
                  Model: {advisoryBundle.model_version} ({advisoryBundle.source_mode})
                </span>
              </div>
            </div>

            {/* CURRENT CONDITIONS + AI OUTLOOK METRICS (Section 18) */}
            <div className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Conditions (Real Observations) */}
                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-950">
                      1. CURRENT CONDITIONS (REAL OBSERVATION)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-700 text-white text-[9px] font-extrabold">
                      OBSERVED
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-sky-100">
                      <span className="text-[10px] text-slate-500 block">
                        Latest Rain
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {activeSpatialBlock?.observation?.rainfall_mm ?? 23.1} mm
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-sky-100">
                      <span className="text-[10px] text-slate-500 block">
                        7D Rain
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {activeSpatialBlock?.observation?.cumulative_7d_rain_mm ??
                          71.4}{" "}
                        mm
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-sky-100">
                      <span className="text-[10px] text-slate-500 block">
                        Soil Moisture
                      </span>
                      <span className="font-extrabold text-amber-900 text-[11px]">
                        {advisoryBundle.soil_moisture_status_en}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Outlook (Horizon Probabilities) */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950">
                      2. {advisoryBundle.source_mode} OUTLOOK ({horizon} HORIZON)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#0B3B24] text-emerald-300 text-[9px] font-extrabold">
                      {advisoryBundle.model_version}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-slate-500 block">
                        Onset
                      </span>
                      <span className="font-extrabold text-emerald-800">
                        {activeSpatialBlock?.prediction?.onset_probability_pct ??
                          selectedBlock.onsetProbability}
                        %
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-amber-100">
                      <span className="text-[10px] text-slate-500 block">
                        False Onset
                      </span>
                      <span className="font-extrabold text-amber-800">
                        {activeSpatialBlock?.prediction
                          ?.false_onset_probability_pct ??
                          selectedBlock.falseOnsetProbability}
                        %
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-orange-100">
                      <span className="text-[10px] text-slate-500 block">
                        Dry Spell
                      </span>
                      <span className="font-extrabold text-orange-700">
                        {activeSpatialBlock?.prediction
                          ?.dry_spell_probability_pct ??
                          selectedBlock.drySpellProbability}
                        %
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-sky-100">
                      <span className="text-[10px] text-slate-500 block">
                        Heavy Rain
                      </span>
                      <span className="font-extrabold text-sky-800">
                        {activeSpatialBlock?.prediction
                          ?.heavy_rain_probability_pct ??
                          selectedBlock.heavyRainProbability}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* EXPIRED PREDICTION WARNING IF TRIGGERED (Section 22) */}
              {advisoryBundle.is_prediction_expired ? (
                <div
                  role="alert"
                  className="p-5 rounded-2xl bg-red-50 border-2 border-red-300 text-red-950 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-red-700 text-white text-xs font-extrabold uppercase">
                      STATUS: EXPIRED
                    </span>
                    <span className="text-xs font-mono">
                      valid_until: {advisoryBundle.valid_until}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold">
                    Underlying Forecast Expired — Active Advisories Suppressed
                  </h3>
                  <p className="text-xs text-red-900">
                    Per Section 22, when the underlying prediction{" "}
                    <code>valid_until</code> timestamp has passed, all generated
                    advisories ({advisoryBundle.expired_advisories.length} rules)
                    are marked <code>EXPIRED</code> and hidden from active
                    decision cards. Uncheck &quot;Test Expired Prediction
                    State&quot; above to view active advisories.
                  </p>
                </div>
              ) : (
                /* ACTIVE DETERMINISTIC ADVISORIES LIST (Sections 4, 11, 13, 16, 17, 21) */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-700" />
                      <span>
                        3. PRIORITIZED CROP ADVISORIES (
                        {advisoryBundle.active_advisories.length} Applicable
                        Rules)
                      </span>
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Ordered by Severity → Horizon → Crop Sensitivity →
                      Evidence Basis
                    </span>
                  </div>

                  {advisoryBundle.active_advisories.map((adv) => {
                    const loc = isHindi ? adv.hi : adv.en;
                    const sevBadge =
                      adv.severity === "CRITICAL"
                        ? "bg-red-700 text-white"
                        : adv.severity === "HIGH"
                        ? "bg-orange-600 text-white"
                        : adv.severity === "MODERATE"
                        ? "bg-amber-400 text-slate-950"
                        : "bg-emerald-600 text-white";

                    return (
                      <div
                        key={adv.id}
                        className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 space-y-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-300 text-[10px] font-mono font-extrabold">
                              Priority #{adv.priority_rank} • Category{" "}
                              {adv.decision_code}: {adv.decision_category}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${sevBadge}`}
                            >
                              Severity: {adv.severity}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-mono font-bold">
                              Rule: {adv.rule_id}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Valid until: {adv.valid_until.slice(0, 10)} (
                            {adv.status})
                          </span>
                        </div>

                        <h4 className="text-base sm:text-lg font-extrabold text-slate-950">
                          {loc.title}
                        </h4>

                        {/* Structured WHAT / WHY / WHEN / ACTION Grid (Section 13) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                              WHAT (क्या जोखिम/स्थिति है)
                            </span>
                            <p className="font-bold text-slate-900 mt-0.5">
                              {loc.what}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                              WHY (क्यों — साक्ष्य एवं कारण)
                            </span>
                            <p className="font-bold text-slate-900 mt-0.5">
                              {loc.why}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                              WHEN (कब — समय सीमा)
                            </span>
                            <p className="font-bold text-slate-900 mt-0.5">
                              {loc.when}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300">
                            <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">
                              ACTION (अनुशंसित कृषि कार्य)
                            </span>
                            <p className="font-extrabold text-emerald-950 mt-0.5">
                              {loc.action}
                            </p>
                          </div>
                        </div>

                        {/* Traceability Footer: Why am I seeing this? (Section 12 & 17) */}
                        <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-emerald-400">
                              Why this advisory?{" "}
                            </span>
                            <span>
                              Rule <code>{adv.rule_id}</code> •{" "}
                              {isHindi
                                ? adv.evidence.summary_hi
                                : adv.evidence.summary_en}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            Model: {adv.model_version}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 4 COLS: "WHY THIS ADVICE?", EVIDENCE BASIS & PROVENANCE (Sections 12, 17, 18, 21) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Evidence Basis Card (Section 12: Never called "AI accuracy") */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Section 12 &amp; 17 Traceability
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                Why This Advice? (Evidence Basis)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Recommendations are traced to explicit meteorological evidence
                and rule conditions (never labeled &quot;AI accuracy&quot;).
              </p>
            </div>

            {topAdvisory ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 text-white space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 font-bold">
                      Primary Triggered Rule:
                    </span>
                    <code className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                      {topAdvisory.rule_id}
                    </code>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {topAdvisory.priority_explanation}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                    Evidence Basis Metrics:
                  </span>
                  {topAdvisory.evidence.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80"
                    >
                      <span className="text-slate-600 font-medium">
                        {isHindi ? m.label_hi : m.label_en}
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-900 block">
                    Matched Rule Conditions:
                  </span>
                  <ul className="list-disc list-inside text-[11px] font-mono text-emerald-950 space-y-0.5">
                    {topAdvisory.evidence.triggered_conditions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No active advisory evidence to display because the underlying
                forecast is marked EXPIRED.
              </p>
            )}

            {/* Priority Ordering Explanation (Section 21) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-extrabold text-slate-900 block">
                Priority Ordering Logic (Section 21):
              </span>
              <p>{advisoryBundle.priority_ordering_explanation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. AGRICULTURAL / WEATHER OFFICER DISTRICT TRIAGE VIEW (Section 20) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#0B3B24] text-emerald-300 text-[10px] font-extrabold uppercase">
                SECTION 20 • OFFICER VIEW
              </span>
              <span className="text-xs font-bold text-slate-500">
                Prototype Decision Support — Not Official Warnings
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
              Prayagraj District Block Risk &amp; Crop Exposure Triage (
              {horizon} • {cropProfile.name})
            </h2>
          </div>

          {/* Officer Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-slate-500 font-semibold">Filter:</span>
              <select
                value={officerFilter}
                onChange={(e) =>
                  setOfficerFilter(e.target.value as OfficerFilterType)
                }
                className="font-bold text-slate-900 bg-transparent focus:outline-none"
              >
                <option value="all">All 8 Prayagraj Blocks</option>
                <option value="high_dry_spell">
                  Elevated Dry Spell Risk (&gt;=30%)
                </option>
                <option value="high_false_onset">
                  Elevated False Onset Risk (&gt;=30%)
                </option>
                <option value="high_heavy_rain">
                  Elevated Heavy Rain Risk (&gt;=30%)
                </option>
                <option value="high_onset_uncertainty">
                  High Onset Uncertainty (35%–65%)
                </option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-semibold">Sort by:</span>
              <select
                value={officerSortBy}
                onChange={(e) => setOfficerSortBy(e.target.value as any)}
                className="font-bold text-slate-900 bg-transparent focus:outline-none"
              >
                <option value="dry_spell">Dry Spell Risk (Desc)</option>
                <option value="false_onset">False Onset Risk (Desc)</option>
                <option value="heavy_rain">Heavy Rain Risk (Desc)</option>
                <option value="advisory_count">Advisory Count (Desc)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Officer Triage Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-extrabold uppercase">
                <th className="py-3 px-3.5">Block</th>
                <th className="py-3 px-3.5">Onset &amp; Uncertainty</th>
                <th className="py-3 px-3.5">False Onset Risk</th>
                <th className="py-3 px-3.5">Dry Spell Risk</th>
                <th className="py-3 px-3.5">Heavy Rain Risk</th>
                <th className="py-3 px-3.5">Crop Exposure</th>
                <th className="py-3 px-3.5">Advisory Count</th>
                <th className="py-3 px-3.5">Top Triggered Rules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {officerOverviewRows.map((row) => {
                const isSelected = row.block_id === selectedBlockId;
                return (
                  <tr
                    key={row.block_id}
                    onClick={() => setSelectedBlockId(row.block_id)}
                    className={`cursor-pointer transition ${
                      isSelected ? "bg-emerald-50/80" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-3 px-3.5 font-extrabold text-slate-900">
                      {row.block_name}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-bold text-emerald-800">
                        {row.onset_probability_pct}%
                      </span>{" "}
                      {row.onset_uncertainty_high && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                          Uncertain
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-amber-800">
                      {row.false_onset_probability_pct}%
                    </td>
                    <td className="py-3 px-3.5 font-bold text-orange-700">
                      {row.dry_spell_probability_pct}%
                    </td>
                    <td className="py-3 px-3.5 font-bold text-sky-800">
                      {row.heavy_rain_probability_pct}%
                    </td>
                    <td className="py-3 px-3.5 text-slate-700">
                      {row.exposed_crops.join(", ")}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-extrabold text-[11px]">
                        {row.active_advisory_count} rules ({row.highest_severity}
                        )
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px] text-emerald-900">
                      {row.top_rule_ids.join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
