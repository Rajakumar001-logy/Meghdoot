"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Cpu,
  Gauge,
  Layers,
  Sprout,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import { buildForecastForBlock } from "@/data/mockData";
import { RainfallChart } from "@/components/charts/RainfallChart";
import { FalseOnsetWarning } from "@/components/intelligence/FalseOnsetWarning";
import { ForecastHorizon } from "@/types/monsoon";

const PIPELINE_STEPS = [
  {
    step: "01",
    title: "Global Climate Signals",
    detail: "ENSO (Niño 3.4), Indian Ocean Dipole (DMI), MJO Phase & Amplitude",
  },
  {
    step: "02",
    title: "Regional Atmospheric Data",
    detail: "850 hPa Low-Level Jet, Monsoon Trough Axis, Bay of Bengal SSTs",
  },
  {
    step: "03",
    title: "Historical Rainfall",
    detail: "30-year IMD 0.25° gridded rainfall & block station climatology",
  },
  {
    step: "04",
    title: "Soil Moisture",
    detail: "Root-zone moisture index (0–30 cm) & evapotranspiration deficit",
  },
  {
    step: "05",
    title: "AI Downscaling Model",
    detail: "Hybrid XGBoost + Bi-LSTM sub-seasonal block downscaler",
  },
  {
    step: "06",
    title: "Probabilistic Forecast",
    detail:
      "Calibrated 7D / 14D / 21D / 30D onset, dry spell & heavy rain probabilities",
  },
  {
    step: "07",
    title: "Agricultural Advisory",
    detail: "Actionable crop-stage sowing & supplemental irrigation decisions",
  },
];

const MODEL_CARDS = [
  {
    name: "XGBoost",
    role: "Climate feature modeling",
    description:
      "Gradient-boosted decision trees capturing non-linear interactions between teleconnection anomalies (ENSO, IOD, MJO), surface pressure gradients, and block soil characteristics.",
    metrics:
      "Feature Importance: MJO Amp (0.31), Soil Moisture (0.24), IOD (0.19)",
    icon: Layers,
    accent: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
  },
  {
    name: "LSTM",
    role: "Temporal rainfall patterns",
    description:
      "Recurrent sequence architecture modeling 30-day lag dependencies and intraseasonal oscillation (ISO) active/break phase transitions to detect post-shower dry spells.",
    metrics: "Sequence Window: 45-day lookback → 30-day multi-horizon rollout",
    icon: BrainCircuit,
    accent: "border-sky-200 bg-sky-50/50 text-sky-900",
  },
  {
    name: "Probabilistic Calibration",
    role: "Forecast confidence",
    description:
      "Isotonic & Platt scaling layer converting raw ensemble logits into reliable probabilities with horizon-scaled P10–P90 uncertainty bands.",
    metrics: "Brier Skill Score (Simulated Benchmark): 0.82 across UP Blocks",
    icon: Gauge,
    accent: "border-amber-200 bg-amber-50/50 text-amber-900",
  },
];

const HORIZON_LIST: { id: ForecastHorizon; label: string; window: string }[] = [
  { id: "7D", label: "7-Day Horizon", window: "12 Jun – 18 Jun" },
  { id: "14D", label: "14-Day Horizon", window: "12 Jun – 25 Jun" },
  { id: "21D", label: "21-Day Horizon", window: "12 Jun – 02 Jul" },
  { id: "30D", label: "30-Day Horizon", window: "12 Jun – 11 Jul" },
];

export default function ForecastPage() {
  const {
    selectedBlock,
    horizon,
    setHorizon,
    demoScenario,
    currentForecast,
    currentScenarioMeta,
  } = useMonsoon();

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase">
              Prototype Simulation
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase">
              {currentScenarioMeta.shortLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Monsoon Forecast &amp; AI Prediction Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Active Block: <strong>{selectedBlock.name}</strong> (
            {selectedBlock.district}, {selectedBlock.state}) • Horizon:{" "}
            <strong>{horizon}</strong> ({currentForecast.uncertaintyTier})
          </p>
        </div>

        <Link
          href="/advisories"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition self-start sm:self-auto"
        >
          <Sprout className="w-4 h-4 text-emerald-400" />
          Convert Forecast to Crop Advisory
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 4 DYNAMIC HORIZON SELECTOR CARDS (7D / 14D / 21D / 30D) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {HORIZON_LIST.map((hItem) => {
          const active = horizon === hItem.id;
          const hForecast = buildForecastForBlock(
            selectedBlock.id,
            hItem.id,
            demoScenario
          );
          return (
            <button
              key={hItem.id}
              onClick={() => setHorizon(hItem.id)}
              className={`text-left p-4 rounded-2xl border transition-all ${
                active
                  ? "bg-[#0B3B24] text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30"
                  : "bg-white text-slate-900 border-slate-200 hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                    active
                      ? "bg-emerald-400 text-[#0B3B24]"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {hItem.id}
                </span>
                <span
                  className={`text-xs font-medium ${
                    active ? "text-emerald-200" : "text-slate-500"
                  }`}
                >
                  {hItem.window}
                </span>
              </div>
              <h3 className="text-base font-extrabold mt-2">{hItem.label}</h3>
              <div className="mt-2.5 pt-2.5 border-t border-current/10 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="opacity-70 block text-[10px]">
                    Expected Rain
                  </span>
                  <span className="font-bold">
                    {hForecast.expectedRainfallMm} mm
                  </span>
                </div>
                <div>
                  <span className="opacity-70 block text-[10px]">
                    Break Risk
                  </span>
                  <span className="font-bold">
                    {hForecast.breakMonsoonRisk}% ({hForecast.breakMonsoonStatus})
                  </span>
                </div>
              </div>
              <p
                className={`text-[11px] mt-2 font-semibold ${
                  active ? "text-amber-300" : "text-slate-600"
                }`}
              >
                {hForecast.uncertaintyTier}
              </p>
            </button>
          );
        })}
      </div>

      {/* INTERACTIVE RAINFALL CHART */}
      <RainfallChart
        data={currentForecast.dailySeries}
        horizon={horizon}
        onHorizonChange={setHorizon}
        blockName={selectedBlock.name}
        uncertaintyTier={currentForecast.uncertaintyTier}
      />

      {/* FALSE ONSET EARLY WARNING */}
      <FalseOnsetWarning
        falseOnsetProbability={currentForecast.falseOnsetWarningProbability}
        expectedDrySpell={currentForecast.expectedDrySpellDays}
        recommendedAction={currentForecast.falseOnsetRecommendedAction}
        blockName={selectedBlock.name}
        ruleEvaluation={currentForecast.falseOnsetRuleEngine}
      />

      {/* SECTION 12: AI PREDICTION ENGINE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-700" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                AI Prediction Engine Architecture
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase">
                Prototype Simulation
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Conceptual multi-stage ML downscaling pipeline designed for
              seamless Python FastAPI backend integration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-200/80 p-5 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              End-to-End Downscaling Flow
            </p>
            {PIPELINE_STEPS.map((item, index) => (
              <React.Fragment key={item.step}>
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-start gap-3 shadow-2xs">
                  <span className="w-6 h-6 rounded-lg bg-[#0B3B24] text-emerald-300 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {item.detail}
                    </p>
                  </div>
                </div>
                {index < PIPELINE_STEPS.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ensemble Architecture Components
              </p>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                Simulated Forecast — Demo
              </span>
            </div>

            <div className="space-y-3.5">
              {MODEL_CARDS.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.name}
                    className={`p-5 rounded-2xl border ${m.accent} space-y-2.5`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-white border border-current/15">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold">{m.name}</h3>
                          <p className="text-xs font-semibold opacity-80">
                            {m.role}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/80 border border-current/20">
                        Prototype Simulation
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">
                      {m.description}
                    </p>
                    <div className="pt-2 border-t border-current/10 text-[11px] font-mono font-semibold">
                      {m.metrics}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
