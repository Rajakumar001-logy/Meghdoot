"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Compass,
  Database,
  Globe,
  RefreshCw,
  Sliders,
  Waves,
  Wind,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import { DemoScenarioId } from "@/types/monsoon";

export default function ClimateIntelligencePage() {
  const {
    selectedBlock,
    climateIndices,
    climateObservations,
    dataSourceStatuses,
    demoMode,
    liveDataActive,
    usingStoredObservationFallback,
    isRefreshingExternalData,
    refreshExternalData,
    triggerToast,
    demoScenario,
    setDemoScenario,
    demoScenarios,
    currentScenarioMeta,
  } = useMonsoon();

  const climateLastUpdated = dataSourceStatuses.climate.last_successful_fetch
    ? new Date(dataSourceStatuses.climate.last_successful_fetch).toLocaleString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    : new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 text-sky-900">
              <Compass className="w-4 h-4" />
            </span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-extrabold uppercase">
              Global climate signals used as model inputs
            </span>
            {demoMode ? (
              <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase">
                SIMULATED FORECAST — DEMO
              </span>
            ) : liveDataActive ? (
              <span className="px-2.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold uppercase">
                LIVE DATA — OBSERVED
              </span>
            ) : usingStoredObservationFallback ? (
              <span className="px-2.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-extrabold uppercase">
                STORED SUPABASE OBSERVATION
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase">
                {currentScenarioMeta.shortLabel}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Climate Teleconnection Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Global climate signals used as model inputs (ENSO, IOD, MJO) coupled
            with local rainfall and agricultural risk in{" "}
            <strong>{selectedBlock.name}</strong>.
          </p>
        </div>

        {/* Interactive Demo Scenario Switcher & Live Climate Sync on Climate Page */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={async () => {
              await refreshExternalData("climate", true);
              triggerToast(
                "Global Climate Signals Synced",
                "Fetched latest ENSO (ONI), IOD (DMI), and MJO indices into Supabase.",
                "success"
              );
            }}
            disabled={isRefreshingExternalData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshingExternalData ? "animate-spin" : ""
              }`}
            />
            <span>Sync Climate Signals</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <Sliders className="w-3.5 h-3.5 text-emerald-700" />
            <span className="font-semibold text-slate-600">Scenario:</span>
            <select
              value={demoScenario}
              onChange={(e) =>
                setDemoScenario(e.target.value as DemoScenarioId)
              }
              className="font-extrabold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {demoScenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.label}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/forecast"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition"
          >
            View Downscaled Block Forecast
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* THREE MAJOR CLIMATE DRIVER CARDS: ENSO, IOD, MJO (Requirement 9) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {climateIndices.map((driver) => {
          const isMjo = driver.id === "MJO";
          const isIod = driver.id === "IOD";
          const obsRow = climateObservations.find(
            (o) => o.index_name === driver.id
          );

          const displayValue =
            !demoMode && obsRow && obsRow.index_value !== null
              ? driver.id === "MJO"
                ? `${obsRow.index_value.toFixed(2)} RMM Amp`
                : `${obsRow.index_value >= 0 ? "+" : ""}${obsRow.index_value.toFixed(2)} °C`
              : driver.amplitude !== undefined
              ? `${driver.amplitude}`
              : driver.indexValue;

          const displayPhase =
            !demoMode && obsRow ? obsRow.phase : driver.currentPhase;
          const displayObsDate =
            obsRow?.observation_date || new Date().toISOString().slice(0, 10);
          const displaySource =
            !demoMode && obsRow
              ? obsRow.source
              : "Simulated Climate Baseline (Demo)";

          return (
            <div
              key={driver.id}
              className={`bg-white rounded-2xl border shadow-soft p-6 flex flex-col justify-between space-y-5 ${
                isMjo
                  ? "border-emerald-300 ring-2 ring-emerald-500/15"
                  : "border-slate-200/90"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        isMjo
                          ? "bg-emerald-100 text-emerald-800"
                          : isIod
                          ? "bg-sky-100 text-sky-800"
                          : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {isMjo ? (
                        <Wind className="w-5 h-5" />
                      ) : isIod ? (
                        <Waves className="w-5 h-5" />
                      ) : (
                        <Globe className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold text-slate-900">
                          {driver.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold uppercase">
                          {!demoMode ? "Observed" : "Simulated"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {driver.fullName}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      driver.influence === "High"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-sky-100 text-sky-900 border-sky-300"
                    }`}
                  >
                    Influence: {driver.influence}
                  </span>
                </div>

                {/* Key Attributes Table: Value & Phase */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[11px] text-slate-500 block">
                      Phase
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {displayPhase}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                    <span className="text-[11px] text-emerald-800 block">
                      Value
                    </span>
                    <span className="text-base font-extrabold text-emerald-900">
                      {displayValue}
                    </span>
                  </div>
                </div>

                {/* Provenance Metadata: Observation date, Source, Last updated */}
                <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/70 space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">
                      Observation date:
                    </span>
                    <span className="font-bold text-slate-800">
                      {displayObsDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-500 shrink-0">
                      Source:
                    </span>
                    <span className="font-bold text-slate-800 text-right truncate">
                      {displaySource}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">
                      Last updated:
                    </span>
                    <span className="font-bold text-slate-800">
                      {climateLastUpdated}
                    </span>
                  </div>
                </div>

                {/* Regional Interpretation Highlight Banner */}
                <div className="p-3.5 rounded-xl bg-[#0B3B24] text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                    Regional interpretation ({selectedBlock.district})
                  </span>
                  <span className="text-base font-extrabold text-white mt-0.5 block">
                    {driver.impactOnRegion}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {driver.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 font-medium text-emerald-900">
                  <Database className="w-3 h-3 text-emerald-700" />
                  Global climate signals used as model inputs
                </span>
                <span className="font-bold text-emerald-800">
                  {driver.rainfallProbabilityDelta}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* VISUAL TELECONNECTION RELATIONSHIP PIPELINE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Simulated Teleconnection Cascade
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              ENSO + IOD + MJO → Regional Response → Local Rainfall ({selectedBlock.name})
            </h3>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            Simulated climate-index scenario
          </span>
        </div>

        <div className="max-w-3xl mx-auto space-y-2 py-2">
          {/* Stage 1 */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0B3B24] to-emerald-900 text-white border border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                Layer 01 • Global Ocean–Atmosphere Drivers
              </span>
              <h4 className="text-base font-extrabold mt-0.5">
                ENSO ({climateIndices[0].currentPhase}) + IOD (
                {climateIndices[1].currentPhase}) + MJO (
                {climateIndices[2].currentPhase}, Amp{" "}
                {climateIndices[2].amplitude})
              </h4>
            </div>
            <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-xs font-bold text-emerald-200 shrink-0">
              {currentScenarioMeta.code}
            </span>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-emerald-700" />
          </div>

          {/* Stage 2 */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                Layer 02 • Synoptic Scale Dynamics
              </span>
              <h4 className="text-base font-extrabold mt-0.5">
                Regional Atmospheric Response
              </h4>
              <p className="text-xs text-sky-800/90 mt-0.5">
                {currentScenarioMeta.description}
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-xs font-bold text-sky-800 shrink-0">
              850 hPa Vorticity Shift
            </span>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-sky-600" />
          </div>

          {/* Stage 3 */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Layer 03 • Block / Panchayat Downscaling
              </span>
              <h4 className="text-base font-extrabold mt-0.5">
                Local Rainfall ({selectedBlock.name})
              </h4>
              <p className="text-xs text-emerald-800/90 mt-0.5">
                Onset probability: {selectedBlock.onsetProbability}% • False
                onset risk: {selectedBlock.falseOnsetProbability}% • Expected
                dry spell: {selectedBlock.expectedDrySpellDays}.
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-900 shrink-0">
              {selectedBlock.expectedRainfall} mm Expected
            </span>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-amber-600" />
          </div>

          {/* Stage 4 */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                Layer 04 • Farm Decision Translation
              </span>
              <h4 className="text-base font-extrabold mt-0.5">
                Agricultural Risk &amp; Advisory
              </h4>
              <p className="text-xs text-amber-900/90 mt-0.5">
                {selectedBlock.recommendedAdvisory}
              </p>
            </div>
            <Link
              href="/advisories"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B3B24] text-white text-xs font-bold shrink-0"
            >
              Open Crop Advisory
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
