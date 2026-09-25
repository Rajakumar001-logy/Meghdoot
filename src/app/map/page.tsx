"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Map as MapIcon, Sprout, MessageSquareShare } from "lucide-react";
import { HyperlocalRiskMap } from "@/components/map/HyperlocalRiskMap";
import { useMonsoon } from "@/context/MonsoonContext";

export default function RiskMapPage() {
  const { allBlocks, selectedBlockId, setSelectedBlockId, selectedBlock } =
    useMonsoon();

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900">
              <MapIcon className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Block &amp; Panchayat Spatial Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Hyperlocal Monsoon Risk Map
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Real WGS84 (<strong>EPSG:4326</strong>) spatial intelligence across{" "}
            <strong>A. Monsoon Onset Risk</strong>,{" "}
            <strong>B. False Onset Risk</strong>,{" "}
            <strong>C. Dry Spell Risk</strong>,{" "}
            <strong>D. Heavy Rain Risk</strong>,{" "}
            <strong>E. Expected Rainfall</strong>,{" "}
            <strong>F. Rainfall Anomaly</strong>, and{" "}
            <strong>G. Overall Agricultural Risk</strong> for 7D, 14D, 21D, and
            30D horizons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/advisories"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-bold transition"
          >
            <Sprout className="w-4 h-4 text-emerald-400" />
            Generate Advisory for {selectedBlock.name}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/farmers"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-bold transition"
          >
            <MessageSquareShare className="w-4 h-4 text-emerald-700" />
            Send Block Farmer Alerts
          </Link>
        </div>
      </div>

      {/* QUICK BLOCK SELECTOR BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 px-2 shrink-0">
          Quick Select Block:
        </span>
        {allBlocks.map((b) => {
          const active = b.id === selectedBlockId;
          const dotColor =
            b.riskLevel === "Very High"
              ? "bg-red-600"
              : b.riskLevel === "High"
              ? "bg-orange-500"
              : b.riskLevel === "Moderate"
              ? "bg-amber-400"
              : "bg-emerald-500";
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBlockId(b.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                active
                  ? "bg-[#0B3B24] text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <span>{b.name}</span>
              <span className="opacity-75 text-[10px]">
                ({b.onsetProbability}% Onset)
              </span>
            </button>
          );
        })}
      </div>

      {/* FULL INTERACTIVE MAP COMPONENT */}
      <HyperlocalRiskMap />
    </div>
  );
}
