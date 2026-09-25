"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CloudRain,
  Compass,
  Map as MapIcon,
  ShieldAlert,
  Sparkles,
  Sprout,
  CheckCircle2,
  Activity,
  Layers,
} from "lucide-react";
import { HyperlocalRiskMap } from "@/components/map/HyperlocalRiskMap";
import { useMonsoon } from "@/context/MonsoonContext";

const FEATURE_CARDS = [
  {
    title: "Hyperlocal Forecasting",
    description:
      "Probabilistic 7D, 14D, 21D, and 30D predictions downscaled to Indian Block and Gram Panchayat resolution.",
    icon: MapIcon,
    badge: "Block / Panchayat Scale",
    accent: "from-emerald-500/15 to-emerald-500/5 border-emerald-200 text-emerald-800",
  },
  {
    title: "Climate Teleconnection Intelligence",
    description:
      "Couples global ENSO, Indian Ocean Dipole (IOD), and Madden–Julian Oscillation (MJO) waves with local soil moisture.",
    icon: Compass,
    badge: "ENSO + IOD + MJO",
    accent: "from-sky-500/15 to-sky-500/5 border-sky-200 text-sky-800",
  },
  {
    title: "Crop-Specific Advisories",
    description:
      "Translates raw ML probabilities into clear Probability → Risk → Action guidance for Paddy, Maize, Pulses, and Cotton.",
    icon: Sprout,
    badge: "6 Major Crops",
    accent: "from-emerald-600/15 to-teal-500/5 border-emerald-200 text-emerald-900",
  },
  {
    title: "Early Risk Detection",
    description:
      "Detects post-shower False Onset traps and 8–11 day break-monsoon dry spells before farmers commit Kharif seed stock.",
    icon: ShieldAlert,
    badge: "False Onset Engine",
    accent: "from-amber-500/15 to-red-500/5 border-amber-200 text-amber-900",
  },
];

export default function LandingPage() {
  const { demoMode, setDemoMode } = useMonsoon();

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B3B24] flex items-center justify-center shadow-sm">
              <CloudRain className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-[#0B3B24]">
                  MonsoonPulse AI
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  AI-Powered Hyperlocal Monsoon Intelligence
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Predict the Monsoon. Protect the Harvest.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1">
              <button
                onClick={() => setDemoMode(!demoMode)}
                className="text-xs font-bold text-amber-950 flex items-center gap-1.5"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    demoMode ? "bg-emerald-600" : "bg-slate-400"
                  }`}
                />
                Demo Mode
              </button>
              {demoMode && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/30 text-amber-950">
                  SIMULATED FORECAST — DEMO
                </span>
              )}
            </div>

            <Link
              href="/forecast"
              className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Explore Forecast
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-950 text-white text-xs font-bold shadow-sm transition"
            >
              Open Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0B3B24] via-[#0F4C2E] to-[#0B3B24] text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left 7 Cols: Hero Copy */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI-Powered Hyperlocal Monsoon Intelligence</span>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-300">
                  MONSOONPULSE AI
                </p>
                <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.1]">
                  “Predict the Monsoon.{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300">
                    Protect the Harvest.”
                  </span>
                </h1>
              </div>

              <p className="text-base sm:text-lg text-emerald-100/90 max-w-2xl leading-relaxed">
                Block-level probabilistic monsoon intelligence that converts
                climate and weather signals into crop-specific agricultural
                decision support.
              </p>

              {/* Primary CTAs */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B3B24] font-extrabold text-sm shadow-lg transition"
                >
                  Open Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/forecast"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 font-bold text-sm transition"
                >
                  Explore Forecast
                </Link>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl text-emerald-200 hover:text-white font-semibold text-xs transition"
                >
                  <MapIcon className="w-4 h-4" />
                  Live Block Risk Map
                </Link>
              </div>

              {/* Quick Telemetry Pills */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-emerald-800/70 max-w-xl">
                <div>
                  <span className="text-2xl font-extrabold text-white block">
                    128
                  </span>
                  <span className="text-xs text-emerald-200/80">
                    Blocks Monitored
                  </span>
                </div>
                <div>
                  <span className="text-2xl font-extrabold text-amber-300 block">
                    7D–30D
                  </span>
                  <span className="text-xs text-emerald-200/80">
                    Sub-Seasonal Horizons
                  </span>
                </div>
                <div>
                  <span className="text-2xl font-extrabold text-sky-300 block">
                    12,540+
                  </span>
                  <span className="text-xs text-emerald-200/80">
                    Farmers Reached (UP)
                  </span>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Probability -> Risk -> Action Live Card Preview */}
            <div className="lg:col-span-5 bg-white/10 backdrop-blur-md rounded-2xl border border-emerald-400/30 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                    Live Decision Translation Engine
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Prayagraj • Karchhana &amp; Phulpur Cluster
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase">
                  14D Horizon
                </span>
              </div>

              {/* Example 1: Onset Probability -> Risk -> Action */}
              <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-600/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300">
                    78% Onset Probability (15–19 June)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                    Favorable
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white font-semibold">
                  <span>Favorable sowing window</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">
                    Prepare nursery &amp; canal storage
                  </span>
                </div>
              </div>

              {/* Example 2: False Onset / Dry Spell Probability -> Risk -> Action */}
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-amber-400/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">
                    62% Break-Monsoon / 68% False Onset
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                    Elevated Risk
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white font-semibold">
                  <span>High moisture-stress risk (8–11d)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-amber-200">
                    Delay sowing 5–7d / prep irrigation
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-emerald-200/80">
                <span>Models: XGBoost + LSTM + Calibration</span>
                <Link
                  href="/dashboard"
                  className="font-bold text-emerald-300 hover:underline flex items-center gap-1"
                >
                  Open Officer Console <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUR FEATURE CARDS SECTION */}
      <section className="py-14 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Core Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Built for Agricultural Officers &amp; Climate Decision-Makers
              </h2>
            </div>
            <Link
              href="/climate-intelligence"
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1"
            >
              View Teleconnection &amp; AI Pipeline
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-soft flex flex-col justify-between hover:border-emerald-400 transition"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.accent} border flex items-center justify-center`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {card.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* VISUAL PREVIEW OF THE HYPERLOCAL RISK MAP */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Interactive Live Preview
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Block-Level Monsoon Risk Map Preview
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Click any block polygon (such as{" "}
                <strong>Phulpur Block</strong> or <strong>Karchhana Block</strong>)
                to inspect live onset, false onset, and dry spell probabilities.
              </p>
            </div>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3B24] text-white text-xs font-bold hover:bg-emerald-900 transition"
            >
              Open Full-Screen Risk Map
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <HyperlocalRiskMap compact />
        </div>
      </section>
    </div>
  );
}
