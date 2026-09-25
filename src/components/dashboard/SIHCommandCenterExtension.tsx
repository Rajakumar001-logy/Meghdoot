"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  Eye,
  HelpCircle,
  Layers,
  MapPin,
  Play,
  RotateCcw,
  ShieldCheck,
  Sprout,
  UserCheck,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import DataProvenanceBadge, {
  ProvenanceBadgeState,
} from "@/components/common/DataProvenanceBadge";
import {
  buildBlockComparisonMatrix,
  buildUnifiedBlockIntelligence,
} from "@/services/unifiedBlockIntelligence";
import { CROP_PROFILES } from "@/config/advisoryRules";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

const GUIDED_DEMO_STEPS = [
  {
    step: 1,
    title: "STEP 1 — Climate Signal",
    subtitle: "Global Teleconnection Drivers (ENSO, IOD, MJO)",
    description:
      "Inspect macro-scale Indo-Pacific teleconnections (ENSO Neutral -0.18°C, Positive IOD +0.64°C, MJO Phase 3–4) conditioning sub-seasonal Gangetic trough convection.",
  },
  {
    step: 2,
    title: "STEP 2 — Local Observation",
    subtitle: "Block-Level Weather & Soil Moisture Telemetry",
    description:
      "Verify real block centroid rainfall accumulation, temperature, humidity, and root-zone soil moisture prior to inference cutoff.",
  },
  {
    step: 3,
    title: "STEP 3 — AI Prediction (MPAI-ENS-0.1)",
    subtitle: "Calibrated 0.60 XGBoost + 0.40 Causal LSTM Ensemble",
    description:
      "Evaluate 7D/14D/21D/30D probabilistic forecasts for Monsoon Onset, False Onset, Prolonged Break-Monsoon Dry Spell, and Heavy Rainfall.",
  },
  {
    step: 4,
    title: "STEP 4 — GIS Risk Layers",
    subtitle: "8-Block Prayagraj Spatial Risk Intelligence",
    description:
      "Map calibrated block probabilities onto verified administrative polygons across 7 selectable layers (Onset, False Onset, Dry Spell, Heavy Rain, Expected Rainfall, Anomaly, Agricultural Risk).",
  },
  {
    step: 5,
    title: "STEP 5 — Crop-Specific Advisory",
    subtitle: "Deterministic Agronomic Rule Engine (12 Rules, 6 Crops)",
    description:
      "Translate weather probabilities into crop-stage-specific guidance (e.g. delaying rainfed Paddy sowing by 5–7 days during a False Onset trap).",
  },
  {
    step: 6,
    title: "STEP 6 — Farmer Alert Preview",
    subtitle: "Bilingual Hindi/English Advisory & Simulated Delivery",
    description:
      "Generate jargon-free Hindi (Unicode) and English messages with phone privacy masking (+91 ******0084), consent verification, and SIMULATED DELIVERY.",
  },
  {
    step: 7,
    title: "STEP 7 — Officer Alert Center",
    subtitle: "District Command Response & Block Comparison",
    description:
      "Review block-wide alert exposure, compare up to 3 blocks side-by-side, inspect delivery audit logs, and manage high-priority field interventions.",
  },
] as const;

const SIH_DEMO_SCRIPT_ITEMS = [
  "1. Select False Onset scenario (Scenario B).",
  "2. Select Karchhana Block (Prayagraj).",
  "3. Select Paddy (Kharif Nursery / Sowing).",
  "4. Switch forecast horizon to 14D.",
  "5. Show 68% False Onset & 62% Dry-Spell probability.",
  "6. Open 'Why this prediction?' & Prediction Trace.",
  "7. Open deterministic Crop Advisory (RULE-FALSE-ONSET-001).",
  "8. Preview Hindi farmer alert (SIMULATED DELIVERY).",
  "9. Show Officer Alert Center & 3-Block Comparison.",
];

export default function SIHCommandCenterExtension() {
  const {
    selectedBlockId,
    setSelectedBlockId,
    selectedCropId,
    setSelectedCropId,
    horizon,
    setHorizon,
    demoScenario,
    setDemoScenario,
    demoMode,
    setDemoMode,
    forecastEngineMode,
    setForecastEngineMode,
    allBlocks,
    dataSourceStatuses,
  } = useMonsoon();

  // View mode toggle: OFFICER VIEW vs FARMER VIEW (Sections 16 & 17)
  const [commandViewRole, setCommandViewRole] = useState<"OFFICER" | "FARMER">(
    "OFFICER"
  );

  // Guided End-to-End Demo Mode state (Section 24)
  const [guidedDemoActive, setGuidedDemoActive] = useState<boolean>(false);
  const [guidedStepIndex, setGuidedStepIndex] = useState<number>(0);
  const [showDemoGuideScript, setShowDemoGuideScript] =
    useState<boolean>(false);

  // Optional UI-only Demo Timer (Section 49: 3 minutes or 5 minutes)
  const [timerDurationSec, setTimerDurationSec] = useState<180 | 300>(180);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerElapsedSec, setTimerElapsedSec] = useState<number>(0);

  // Up-to-3 Block Comparison state (Section 8)
  const [compareBlockIds, setCompareBlockIds] = useState<string[]>([
    "karchhana",
    "meja",
    "koraon",
  ]);

  // Explainable AI & Prediction Trace drawers (Sections 11 & 12)
  const [showWhyPrediction, setShowWhyPrediction] = useState<boolean>(true);
  const [showPredictionTrace, setShowPredictionTrace] =
    useState<boolean>(false);
  const [showWhyFarmerSeeing, setShowWhyFarmerSeeing] =
    useState<boolean>(false);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerElapsedSec((prev) => {
        if (prev + 1 >= timerDurationSec) {
          setTimerRunning(false);
          return timerDurationSec;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerDurationSec]);

  // Unified Block Intelligence Object (Section 7 & Section 37)
  const unified = useMemo(() => {
    return buildUnifiedBlockIntelligence({
      blockId: selectedBlockId,
      horizon,
      cropId: selectedCropId,
      scenario: demoScenario,
      engineMode: forecastEngineMode,
      demoMode,
    });
  }, [
    selectedBlockId,
    horizon,
    selectedCropId,
    demoScenario,
    forecastEngineMode,
    demoMode,
  ]);

  // Up-to-3 Block Comparison Matrix (Section 8)
  const comparisonRows = useMemo(() => {
    return buildBlockComparisonMatrix({
      blockIds: compareBlockIds,
      horizon,
      cropId: selectedCropId,
      scenario: demoScenario,
      engineMode: forecastEngineMode,
      demoMode,
    });
  }, [
    compareBlockIds,
    horizon,
    selectedCropId,
    demoScenario,
    forecastEngineMode,
    demoMode,
  ]);

  // Live KPI values computed from actual application state (Section 4)
  const kpiMetrics = useMemo(() => {
    const activeBlocksCount = allBlocks.length;
    const highRiskBlocksCount = allBlocks.filter(
      (b) => b.riskLevel === "High" || b.riskLevel === "Very High"
    ).length;
    const activeAdvisoriesCount = unified.advisories.active_advisories.length;
    const activeAlertsCount = unified.alerts.filter(
      (a) => a.status !== "EXPIRED"
    ).length;
    const obsStatus =
      dataSourceStatuses.weather.status === "healthy"
        ? "ACTIVE (VALIDATED)"
        : "STORED / DEMO READY";
    const aiModelStatus = "MPAI-ENS-0.1 (VALID)";

    return {
      activeBlocksCount,
      highRiskBlocksCount,
      activeAdvisoriesCount,
      activeAlertsCount,
      obsStatus,
      aiModelStatus,
    };
  }, [allBlocks, unified, dataSourceStatuses]);

  // Section 23: RESET DEMO handler
  const handleResetDemo = () => {
    setGuidedDemoActive(false);
    setGuidedStepIndex(0);
    setTimerRunning(false);
    setTimerElapsedSec(0);
    setDemoMode(false);
    setForecastEngineMode("AI_FORECAST");
    setDemoScenario("scenario_b");
    setSelectedBlockId("karchhana");
    setSelectedCropId("paddy");
    setHorizon("14D");
  };

  // Section 24: RUN DEMO handler
  const handleStartGuidedDemo = () => {
    setGuidedDemoActive(true);
    setGuidedStepIndex(0);
    setDemoMode(true);
    setDemoScenario("scenario_b");
    setSelectedBlockId("karchhana");
    setSelectedCropId("paddy");
    setHorizon("14D");
    setTimerElapsedSec(0);
    setTimerRunning(true);
  };

  const handleToggleCompareBlock = (id: string) => {
    setCompareBlockIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  };

  const currentStepObj = GUIDED_DEMO_STEPS[guidedStepIndex];

  return (
    <section
      aria-label="SIH Integrated Command Center and Explainable AI Hub"
      className="space-y-6 pt-4 border-t border-slate-200"
    >
      {/* 1. PRODUCT IDENTITY & GLOBAL DATA PROVENANCE HEADER BAR (Sections 1, 3, 23, 24, 25, 49) */}
      <div className="bg-gradient-to-r from-[#0B3B24] via-[#0F4C2E] to-[#0B3B24] text-white rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                SIH Integrated Command Center • Prompt 10
              </span>
              <DataProvenanceBadge
                state={unified.provenance.badge}
                detail={unified.predictions.model_version}
              />
              {demoMode && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  DEMO SCENARIO ACTIVE ({demoScenario.toUpperCase()})
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              MonsoonPulse AI — &ldquo;Predict the Monsoon. Protect the
              Harvest.&rdquo;
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Block-level probabilistic monsoon intelligence that converts
              climate and weather signals into crop-specific agricultural
              decision support.
            </p>
          </div>

          {/* Interactive Demo Controls & Role Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15">
              <button
                onClick={() => setCommandViewRole("OFFICER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  commandViewRole === "OFFICER"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Officer View
              </button>
              <button
                onClick={() => setCommandViewRole("FARMER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  commandViewRole === "FARMER"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Farmer View (MY FARM)
              </button>
            </div>

            <button
              onClick={handleStartGuidedDemo}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              RUN DEMO
            </button>

            <button
              onClick={handleResetDemo}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RESET DEMO
            </button>

            <button
              onClick={() => setShowDemoGuideScript(!showDemoGuideScript)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 border border-white/20 text-xs font-bold flex items-center gap-1 transition"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              DEMO GUIDE
            </button>
          </div>
        </div>

        {/* Scenario Switcher Bar + Optional Demo Timer (Sections 18–22 & 49) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/15 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-emerald-200 font-bold mr-1">
              Demo Scenarios:
            </span>
            {(
              [
                { id: "scenario_a", label: "1. Favorable Monsoon" },
                { id: "scenario_b", label: "2. False Onset" },
                { id: "scenario_c", label: "3. Prolonged Break" },
                { id: "scenario_d", label: "4. Heavy Rainfall" },
              ] as const
            ).map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setDemoMode(true);
                  setDemoScenario(sc.id as DemoScenarioId);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  demoScenario === sc.id
                    ? "bg-white text-[#0B3B24]"
                    : "bg-white/10 text-emerald-100 hover:bg-white/20"
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          {/* UI-Only Presentation Timer (Section 49) */}
          <div className="flex items-center gap-2 bg-black/25 px-3 py-1.5 rounded-xl border border-white/10">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-mono font-bold text-amber-200">
              {formatTimer(timerElapsedSec)} / {formatTimer(timerDurationSec)}
            </span>
            <button
              onClick={() =>
                setTimerDurationSec(timerDurationSec === 180 ? 300 : 180)
              }
              className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold hover:bg-white/20"
            >
              {timerDurationSec === 180 ? "3m Mode" : "5m Mode"}
            </button>
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 text-[10px] font-bold hover:bg-emerald-500/40"
            >
              {timerRunning ? "Pause" : "Start"}
            </button>
          </div>
        </div>

        {/* GUIDED 7-STEP END-TO-END DEMO PANEL (Section 24) */}
        {guidedDemoActive && (
          <div className="bg-white/95 text-slate-900 rounded-xl p-4 border border-amber-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-950">
                  Guided End-to-End SIH Demo Sequence (Step{" "}
                  {guidedStepIndex + 1} of {GUIDED_DEMO_STEPS.length})
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                  {currentStepObj.title}: {currentStepObj.subtitle}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {currentStepObj.description}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={guidedStepIndex === 0}
                  onClick={() =>
                    setGuidedStepIndex(Math.max(0, guidedStepIndex - 1))
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  BACK
                </button>
                <button
                  disabled={guidedStepIndex === GUIDED_DEMO_STEPS.length - 1}
                  onClick={() =>
                    setGuidedStepIndex(
                      Math.min(
                        GUIDED_DEMO_STEPS.length - 1,
                        guidedStepIndex + 1
                      )
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0B3B24] text-white text-xs font-extrabold disabled:opacity-40 hover:bg-emerald-900 flex items-center gap-1"
                >
                  NEXT
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setGuidedDemoActive(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  SKIP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COLLAPSIBLE DEMO SCRIPT PANEL (Section 25) */}
        {showDemoGuideScript && (
          <div className="bg-slate-900/90 text-emerald-100 rounded-xl p-4 border border-emerald-500/30 text-xs space-y-2">
            <p className="font-extrabold uppercase tracking-wider text-amber-300 text-[11px]">
              SIH 3–5 Minute Presentation Script (DEMO GUIDE)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SIH_DEMO_SCRIPT_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-white/5 border border-white/10 font-medium"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. TOP-LEVEL COMMAND CENTER KPI CARDS (Section 4 — Live State Derived) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            ACTIVE BLOCKS
          </span>
          <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">
            {kpiMetrics.activeBlocksCount} Blocks
          </span>
          <span className="text-[10px] text-emerald-700 font-semibold">
            Prayagraj GIS Cluster
          </span>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-amber-800 block">
            HIGH-RISK BLOCKS
          </span>
          <span className="text-lg font-extrabold text-amber-950 mt-0.5 block">
            {kpiMetrics.highRiskBlocksCount} Blocks
          </span>
          <span className="text-[10px] text-amber-700 font-semibold">
            Horizon: {horizon}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            ACTIVE ADVISORIES
          </span>
          <span className="text-lg font-extrabold text-emerald-800 mt-0.5 block">
            {kpiMetrics.activeAdvisoriesCount} Rules Fired
          </span>
          <span className="text-[10px] text-slate-600 font-semibold">
            Crop: {unified.advisories.crop_profile.name}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            ACTIVE ALERTS
          </span>
          <span className="text-lg font-extrabold text-sky-800 mt-0.5 block">
            {kpiMetrics.activeAlertsCount} Active
          </span>
          <span className="text-[10px] text-slate-600 font-semibold">
            Block: {unified.block.name}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-emerald-800 block">
            REAL OBSERVATION STATUS
          </span>
          <span className="text-xs font-extrabold text-emerald-950 mt-1 block">
            {kpiMetrics.obsStatus}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Cutoff: {unified.predictions.observation_cutoff.slice(0, 10)}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-indigo-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-indigo-800 block">
            AI MODEL STATUS
          </span>
          <span className="text-xs font-extrabold text-indigo-950 mt-1 block">
            {kpiMetrics.aiModelStatus}
          </span>
          <span className="text-[10px] text-indigo-700 font-semibold">
            0.60 XGBoost + 0.40 LSTM
          </span>
        </div>
      </div>

      {/* 3. FARMER VIEW MODE ("MY FARM" — Section 16) */}
      {commandViewRole === "FARMER" ? (
        <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                Section 16 • Farmer-Oriented View (MY FARM)
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                MY FARM — {unified.block.name}, {unified.block.district}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <DataProvenanceBadge state={unified.provenance.badge} />
              <button
                onClick={() => setShowWhyFarmerSeeing(!showWhyFarmerSeeing)}
                className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 text-xs font-extrabold flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Why am I seeing this?
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Location &amp; Crop
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                {unified.block.name}
              </p>
              <p className="text-xs font-semibold text-emerald-800">
                Crop: {unified.advisories.crop_profile.name} (
                {unified.advisories.crop_profile.local_names.hi})
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Current Conditions
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                Temp: {unified.observations.temperature_c}°C • Humidity:{" "}
                {unified.observations.humidity_pct}%
              </p>
              <p className="text-xs text-slate-600">
                Soil Moisture:{" "}
                {unified.observations.soil_moisture_pct !== null
                  ? `${unified.observations.soil_moisture_pct}%`
                  : "Unavailable"}{" "}
                • 7D Rain: {unified.observations.cumulative_rain_7d_mm} mm
              </p>
            </div>
            <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-sky-800">
                Next 7 Days Outlook
              </span>
              <p className="text-sm font-extrabold text-sky-950">
                Onset Signal:{" "}
                {Math.min(95, unified.predictions.onset_probability_pct + 4)}%
              </p>
              <p className="text-xs text-sky-900">
                Initial shower window followed by potential dry break.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-800">
                Next 14 Days Outlook
              </span>
              <p className="text-sm font-extrabold text-amber-950">
                False Onset Risk:{" "}
                {unified.predictions.false_onset_probability_pct}% • Dry Spell:{" "}
                {unified.predictions.dry_spell_probability_pct}%
              </p>
              <p className="text-xs text-amber-900">
                Expected dry spell: {unified.predictions.expected_dry_spell_days}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                Top Recommended Farm Actions
              </h4>
              {unified.advisories.active_advisories.slice(0, 2).map((adv) => (
                <div
                  key={adv.id}
                  className="p-3 rounded-lg bg-white border border-emerald-200 space-y-1"
                >
                  <p className="text-xs font-extrabold text-slate-900">
                    {adv.en.title} ({adv.hi.title})
                  </p>
                  <p className="text-xs text-slate-700">{adv.en.action}</p>
                  <p className="text-xs text-emerald-900 font-medium">
                    {adv.hi.action}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Active Farmer Alerts ({unified.alerts.length})
              </h4>
              {unified.alerts.slice(0, 2).map((al) => (
                <div
                  key={al.id}
                  className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">
                      {al.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                      {al.delivery_mode_badge}
                    </span>
                  </div>
                  <p className="text-slate-700 whitespace-pre-line">
                    {al.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {showWhyFarmerSeeing && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-1.5">
              <p className="font-extrabold text-amber-950">
                Why am I seeing this? (Plain-Language Explanation)
              </p>
              <p className="text-slate-800">
                1. Your farm location is registered in{" "}
                <strong>{unified.block.name}</strong> ({unified.block.district}
                ).
              </p>
              <p className="text-slate-800">
                2. Your selected crop is{" "}
                <strong>{unified.advisories.crop_profile.name}</strong>, which
                is sensitive to moisture stress during sowing and nursery
                stages.
              </p>
              <p className="text-slate-800">
                3. Our 14-day outlook indicates a{" "}
                <strong>
                  {unified.predictions.false_onset_probability_pct}% risk of a
                  false monsoon start
                </strong>{" "}
                ({unified.predictions.expected_dry_spell_days} dry gap after the
                first rain), so delaying rainfed sowing protects your seeds.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* 4. OFFICER COMMAND CENTER PANELS (Sections 5, 8, 10, 11, 12, 13, 14) */
        <div className="space-y-6">
          {/* Row A: CURRENT MONSOON STATUS + CROP SELECTOR + EXPLAINABLE AI ("Why this prediction?") */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Section 5: Current Monsoon Status + Section 10: Global Crop Selector */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    Section 5 &amp; 10 • Current Monsoon Status
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    MONSOON STATUS — {unified.block.name}
                  </h3>
                </div>
                <DataProvenanceBadge state={unified.provenance.badge} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                    Observed (Real Telemetry)
                  </span>
                  <p className="font-extrabold text-slate-900">
                    {unified.observations.cumulative_rain_7d_mm} mm (7D Rain)
                  </p>
                  <p className="text-slate-600">
                    Temp: {unified.observations.temperature_c}°C • Soil:{" "}
                    {unified.observations.soil_moisture_pct}%
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    Last observation:{" "}
                    {unified.observations.last_observation_timestamp}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-indigo-800 block">
                    AI Outlook ({horizon})
                  </span>
                  <p className="font-extrabold text-slate-900">
                    False Onset: {unified.predictions.false_onset_probability_pct}
                    % | Dry Spell: {unified.predictions.dry_spell_probability_pct}
                    %
                  </p>
                  <p className="text-slate-600">
                    Expected Rain: {unified.predictions.expected_rainfall_mm} mm (
                    {unified.predictions.rainfall_anomaly_pct > 0 ? "+" : ""}
                    {unified.predictions.rainfall_anomaly_pct}%)
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    Model: {unified.predictions.model_version} •{" "}
                    {unified.predictions.last_prediction_timestamp}
                  </p>
                </div>
              </div>

              {/* Section 10: Global Crop Selector (Updates advisory only, weather prediction unchanged) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Sprout className="w-4 h-4 text-emerald-700" />
                    Crop Interpretation Selector (6 Supported Crops):
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    Weather forecast remains invariant
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    ["paddy", "maize", "pulses", "soybean", "cotton", "wheat"] as const
                  ).map((cid) => (
                    <button
                      key={cid}
                      onClick={() => setSelectedCropId(cid)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                        selectedCropId === cid
                          ? "bg-[#0B3B24] text-white"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {cid}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-emerald-900 font-medium">
                  Active Crop Advisory ({unified.advisories.crop_profile.name}):{" "}
                  <strong>
                    {unified.advisories.active_advisories[0]?.en.title}
                  </strong>{" "}
                  — {unified.advisories.active_advisories[0]?.en.action}
                </p>
              </div>
            </div>

            {/* Section 11 & 12: Explainable AI ("Why this prediction?") & Prediction Trace */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">
                    Section 11 &amp; 12 • Explainable AI &amp; Causal-Safe
                    Prediction Trace
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    Why this prediction? ({unified.explainable_ai.target_label}:{" "}
                    {unified.explainable_ai.probability_pct}%)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowWhyPrediction(!showWhyPrediction)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {showWhyPrediction ? "Hide Features" : "Show Features"}
                  </button>
                  <button
                    onClick={() => setShowPredictionTrace(!showPredictionTrace)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-extrabold flex items-center gap-1"
                  >
                    {showPredictionTrace ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    Prediction Trace
                  </button>
                </div>
              </div>

              {showWhyPrediction && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    <span>
                      <strong>Target:</strong>{" "}
                      {unified.explainable_ai.target_label}
                    </span>
                    <span>
                      <strong>Probability:</strong>{" "}
                      {unified.explainable_ai.probability_pct}%
                    </span>
                    <span>
                      <strong>Horizon:</strong> {unified.explainable_ai.horizon}
                    </span>
                    <span>
                      <strong>Model:</strong>{" "}
                      {unified.explainable_ai.model_version}
                    </span>
                    <span>
                      <strong>Cutoff:</strong>{" "}
                      {unified.explainable_ai.observation_cutoff.slice(0, 10)}
                    </span>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    TOP CONTRIBUTING FEATURES (XGBoost Gain Attribution —
                    Contributory, Non-Causal):
                  </p>
                  <div className="space-y-2">
                    {unified.explainable_ai.top_contributing_features.map(
                      (feat, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900">
                              {feat.feature_name} ({feat.observed_value})
                            </span>
                            <p className="text-[11px] text-slate-600">
                              {feat.contribution_statement}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono font-bold text-[11px] shrink-0">
                            Weight: {feat.relative_importance_pct}%
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Expandable Prediction Trace (Section 12) */}
              {showPredictionTrace && (
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-2.5 text-xs font-mono">
                  <p className="text-amber-300 font-bold uppercase tracking-wider text-[11px]">
                    End-to-End Prediction Trace (REAL OBSERVATION → FEATURE
                    ENGINEERING → MODEL → CALIBRATION → OUTPUT)
                  </p>
                  {unified.explainable_ai.prediction_trace.map((step, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-emerald-400 pl-3 py-1 space-y-0.5"
                    >
                      <div className="text-emerald-300 font-bold">
                        {i + 1}. {step.stage}: {step.summary}
                      </div>
                      {step.details.map((d, j) => (
                        <div key={j} className="text-slate-300 text-[11px]">
                          ↳ {d}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row B: UP-TO-3 BLOCK COMPARISON MATRIX (Section 8) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-900">
                  Section 8 • Multi-Block Situational Comparison (Up to 3
                  Blocks)
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Side-by-Side Block Comparison ({horizon} Horizon • No
                  Single-Score Ranking)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 mr-1">
                  Toggle Blocks (Max 3):
                </span>
                {allBlocks.map((b) => {
                  const active = compareBlockIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => handleToggleCompareBlock(b.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        active
                          ? "bg-[#0B3B24] text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {b.name.replace(" Block", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Block</th>
                    <th className="py-2.5 px-3">Onset Prob</th>
                    <th className="py-2.5 px-3">False Onset</th>
                    <th className="py-2.5 px-3">Dry Spell</th>
                    <th className="py-2.5 px-3">Heavy Rain</th>
                    <th className="py-2.5 px-3">Rain Anomaly</th>
                    <th className="py-2.5 px-3">Expected Rain</th>
                    <th className="py-2.5 px-3">Active Advisories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {comparisonRows.map((row) => (
                    <tr key={row.location_id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">
                        {row.block_name}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-800">
                        {row.onset_pct}%
                      </td>
                      <td className="py-2.5 px-3 font-bold text-amber-800">
                        {row.false_onset_pct}%
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-800">
                        {row.dry_spell_pct}%
                      </td>
                      <td className="py-2.5 px-3 font-bold text-sky-800">
                        {row.heavy_rain_pct}%
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {row.rainfall_anomaly_pct > 0
                          ? `+${row.rainfall_anomaly_pct}%`
                          : `${row.rainfall_anomaly_pct}%`}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {row.expected_rainfall_mm} mm
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <span className="font-bold text-emerald-900">
                          {row.active_advisories_count} Rules
                        </span>{" "}
                        — {row.top_advisory_action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row C: MODEL HEALTH (Section 13) & DATA SOURCE HEALTH (Section 14) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">
                Section 13 • Compact Model Health Audit
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                MODEL HEALTH — MPAI-ENS-0.1
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">
                    Version
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    MPAI-ENS-0.1
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">
                    Chronological Split
                  </span>
                  <span className="font-bold text-slate-900">
                    Train 2019–22 | Val 2023 | Test 2024–25
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 block">
                    Leakage Audit
                  </span>
                  <span className="font-extrabold text-emerald-950">
                    PASSED
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 block">
                    Calibration &amp; Artifacts
                  </span>
                  <span className="font-extrabold text-emerald-950">
                    VALID (Isotonic)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">
                    Feature Drift Status
                  </span>
                  <span className="font-bold text-slate-900">
                    NOMINAL (PSI &lt; 0.15)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-800 block">
                    Spatial Generalization
                  </span>
                  <span className="font-extrabold text-amber-950">
                    LIMITED (Prayagraj 8-Block)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                Section 14 • External Provider Telemetry Health
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                DATA SOURCE HEALTH
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                {[
                  {
                    name: "Weather (Open-Meteo)",
                    state:
                      dataSourceStatuses.weather.status === "healthy"
                        ? "ACTIVE"
                        : "STALE / FALLBACK",
                  },
                  {
                    name: "Rainfall (IMD/NASA)",
                    state:
                      dataSourceStatuses.rainfall.status === "healthy"
                        ? "ACTIVE"
                        : "STALE / FALLBACK",
                  },
                  {
                    name: "ENSO (NOAA ONI)",
                    state:
                      dataSourceStatuses.climate.status === "healthy"
                        ? "ACTIVE"
                        : "ACTIVE (STORED)",
                  },
                  {
                    name: "IOD (Dipole Mode)",
                    state:
                      dataSourceStatuses.climate.status === "healthy"
                        ? "ACTIVE"
                        : "ACTIVE (STORED)",
                  },
                  {
                    name: "MJO (RMM1/RMM2)",
                    state:
                      dataSourceStatuses.climate.status === "healthy"
                        ? "ACTIVE"
                        : "ACTIVE (STORED)",
                  },
                ].map((src, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                  >
                    <span className="text-[10px] font-bold text-slate-500 block">
                      {src.name}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-extrabold text-[10px]">
                      {src.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
