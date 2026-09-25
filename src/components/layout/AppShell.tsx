"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudRain,
  Compass,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquareShare,
  Menu,
  Radio,
  Settings,
  Sprout,
  Sparkles,
  CheckCircle2,
  X,
  MapPin,
  ChevronRight,
  Bell,
  Sliders,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    badge: "Officer",
  },
  {
    label: "Monsoon Forecast",
    href: "/forecast",
    icon: CloudRain,
  },
  {
    label: "Risk Map",
    href: "/map",
    icon: MapIcon,
    badge: "GIS",
  },
  {
    label: "Climate Intelligence",
    href: "/climate-intelligence",
    icon: Compass,
  },
  {
    label: "Crop Advisories",
    href: "/advisories",
    icon: Sprout,
  },
  {
    label: "Farmer Communication",
    href: "/farmers",
    icon: MessageSquareShare,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

const HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    selectedState,
    setSelectedState,
    selectedDistrict,
    setSelectedDistrict,
    selectedBlockId,
    setSelectedBlockId,
    selectedBlock,
    horizon,
    setHorizon,
    demoScenario,
    setDemoScenario,
    demoScenarios,
    demoMode,
    setDemoMode,
    allBlocks,
    stateDistricts,
    alerts,
    loadingMessage,
    simulatedError,
    retryLoadData,
    toasts,
    dismissToast,
    liveDataActive,
    usingStoredObservationFallback,
    forecastEngineMode,
    setForecastEngineMode,
    aiForecastActive,
    modelHealth,
  } = useMonsoon();

  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  // Landing page renders its own full-bleed layout with its own navbar
  if (pathname === "/") {
    return (
      <>
        {children}
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 bg-[#0B3B24] text-white px-4 py-3.5 rounded-xl shadow-xl border border-emerald-700/60"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-white text-sm">{t.title}</p>
                <p className="text-emerald-100/90 mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-emerald-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* DESKTOP PERSISTENT SIDEBAR */}
      <aside className="hidden lg:flex lg:flex-col lg:w-68 xl:w-72 bg-[#0B3B24] text-white shrink-0 border-r border-emerald-950/40 select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-emerald-900/60">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center shadow-md">
              <CloudRain className="w-6 h-6 text-[#0B3B24] stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  MonsoonPulse
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                Predict the Monsoon. Protect the Harvest.
              </p>
            </div>
          </Link>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/70 border border-emerald-800/60 text-[10px] font-medium text-emerald-300">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            AI-Powered Hyperlocal Monsoon Intelligence
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">
            Decision Support Suite
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm border border-emerald-500/40"
                    : "text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-emerald-200" : "text-emerald-400/80"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-emerald-900 text-emerald-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Active Block Mini Telemetry Card in Sidebar Footer */}
        <div className="p-4 m-3 rounded-xl bg-emerald-950/80 border border-emerald-800/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Global Sync Active
            </span>
            <span className="text-[11px] font-bold text-amber-300">
              {horizon} Horizon
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{selectedBlock.name}</p>
            <p className="text-xs text-emerald-200/75">
              {selectedDistrict}, {selectedState}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-800/60 text-xs">
            <div>
              <span className="text-emerald-300/70 block text-[10px]">
                Onset Prob.
              </span>
              <span className="font-bold text-emerald-300">
                {selectedBlock.onsetProbability}%
              </span>
            </div>
            <div>
              <span className="text-emerald-300/70 block text-[10px]">
                False Onset Risk
              </span>
              <span className="font-bold text-amber-300">
                {selectedBlock.falseOnsetProbability}%
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#0B3B24] text-white flex flex-col h-full z-10 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-emerald-900">
              <Link
                href="/"
                className="flex items-center gap-2.5"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-400 flex items-center justify-center">
                  <CloudRain className="w-5 h-5 text-[#0B3B24]" />
                </div>
                <span className="font-bold text-base">MonsoonPulse AI</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-emerald-200 hover:bg-emerald-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "text-emerald-100 hover:bg-emerald-900/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* TOP HEADER & GLOBAL SYNCHRONIZED CONTROLS */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Mobile trigger + Breadcrumb Location Selector (State -> District -> Block) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center flex-wrap gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <select
                  value={selectedState}
                  onChange={(e) => {
                    const nextState = e.target.value;
                    setSelectedState(nextState);
                    const districts = stateDistricts[nextState] || [
                      "Prayagraj",
                    ];
                    setSelectedDistrict(districts[0]);
                  }}
                  aria-label="Select State"
                  className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  {Object.keys(stateDistricts).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  aria-label="Select District"
                  className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  {(stateDistricts[selectedState] || ["Prayagraj"]).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                <select
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  aria-label="Select Block"
                  className="bg-emerald-50 text-emerald-900 font-bold px-2 py-0.5 rounded-md border border-emerald-200 focus:outline-none cursor-pointer"
                >
                  {allBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DEMO SCENARIO SELECTOR (Requirement 15) */}
              <div className="flex items-center gap-1.5 bg-emerald-50/80 border border-emerald-300/80 rounded-xl px-2.5 py-1.5 text-xs">
                <Sliders className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                <span className="font-bold text-emerald-950 hidden sm:inline">
                  Demo Scenario:
                </span>
                <select
                  value={demoScenario}
                  onChange={(e) =>
                    setDemoScenario(e.target.value as DemoScenarioId)
                  }
                  aria-label="Select Demo Scenario"
                  className="bg-transparent font-extrabold text-emerald-950 focus:outline-none cursor-pointer"
                >
                  {demoScenarios.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right: Horizon Selector (7D | 14D | 21D | 30D) + Demo Mode Toggle */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Loading state pill if active */}
              {loadingMessage && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>{loadingMessage}</span>
                </div>
              )}

              {/* Forecast Horizon Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 px-2 hidden sm:inline">
                  Horizon:
                </span>
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      horizon === h
                        ? "bg-[#0B3B24] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>

              {/* CONTROLLED FORECAST ENGINE MODE SWITCH (Requirement 27: DEMO MODE | SIMULATED FORECAST | AI FORECAST) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/90">
                <button
                  onClick={() => setForecastEngineMode("DEMO")}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    forecastEngineMode === "DEMO"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  DEMO MODE
                </button>
                <button
                  onClick={() => setForecastEngineMode("SIMULATED")}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    forecastEngineMode === "SIMULATED"
                      ? "bg-sky-700 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  SIMULATED FORECAST
                </button>
                <button
                  onClick={() => setForecastEngineMode("AI_FORECAST")}
                  disabled={!modelHealth.ready_for_ai_forecast}
                  title={
                    modelHealth.ready_for_ai_forecast
                      ? `Activate Real Calibrated Ensemble (${modelHealth.model_version})`
                      : "AI forecast unavailable — using simulated prototype."
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer disabled:opacity-45 ${
                    aiForecastActive
                      ? "bg-[#0B3B24] text-white shadow-2xs"
                      : "text-emerald-900 hover:bg-emerald-50"
                  }`}
                >
                  AI FORECAST
                </button>
              </div>

              {/* Active Provenance & Data Status Badge */}
              <div className="hidden xl:flex items-center gap-1.5">
                {aiForecastActive ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-[#0B3B24] text-emerald-100 border border-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    AI FORECAST • {modelHealth.model_version}
                  </span>
                ) : demoMode ? (
                  <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-900 border border-amber-400/50">
                    SIMULATED FORECAST — DEMO
                  </span>
                ) : liveDataActive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-emerald-600 text-white border border-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    LIVE DATA
                  </span>
                ) : usingStoredObservationFallback ? (
                  <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 border border-sky-300">
                    STORED SUPABASE OBSERVATION
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-900 border border-amber-400/50">
                    SIMULATED FORECAST — DEMO
                  </span>
                )}
              </div>

              {/* Unread Alerts Quick Pill */}
              <Link
                href="/dashboard#alerts-panel"
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80"
                title="Active Monsoon Alerts"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadAlertsCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT OR ERROR FALLBACK (Requirement 17) */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto">
          {simulatedError ? (
            <div className="bg-white rounded-2xl border border-red-200 shadow-soft p-8 max-w-lg mx-auto my-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Unable to load forecast data.
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                The simulated telemetry stream experienced a temporary timeout
                while fetching block ensemble data for {selectedBlock.name}.
              </p>
              <button
                onClick={retryLoadData}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-extrabold transition"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex items-center justify-around py-1.5 px-1 shadow-lg">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                active ? "text-emerald-800" : "text-slate-500"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  active ? "text-emerald-700 stroke-[2.5]" : "text-slate-400"
                }`}
              />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* FLOATING TOAST NOTIFICATIONS */}
      <div className="fixed bottom-16 lg:bottom-6 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 bg-[#0B3B24] text-white px-4 py-3.5 rounded-xl shadow-xl border border-emerald-700/60"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-white text-sm">{t.title}</p>
              <p className="text-emerald-100/90 mt-0.5 leading-relaxed">
                {t.description}
              </p>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-emerald-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
