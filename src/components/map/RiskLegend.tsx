"use client";

import React from "react";
import {
  PROTOTYPE_RISK_THRESHOLD_LABEL,
  RISK_THRESHOLD_BANDS,
} from "@/config/riskThresholds";

interface RiskLegendProps {
  dark?: boolean;
}

export function RiskLegend({ dark = true }: RiskLegendProps) {
  return (
    <div
      role="region"
      aria-label="Map Risk Classification Legend"
      className={`rounded-xl px-3.5 py-2.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
        dark
          ? "bg-slate-950/90 backdrop-blur-md border-slate-800 text-white"
          : "bg-slate-50 border-slate-200 text-slate-900"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`font-extrabold uppercase tracking-wider text-[10px] ${
            dark ? "text-emerald-300" : "text-emerald-800"
          }`}
        >
          MAP LEGEND — Prototype risk classification thresholds.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {RISK_THRESHOLD_BANDS.map((band) => (
          <div
            key={band.category}
            className="inline-flex items-center gap-1.5"
            title={`${band.label}: ${band.rangeText} (${PROTOTYPE_RISK_THRESHOLD_LABEL})`}
          >
            <span
              aria-hidden="true"
              className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[9px] font-black text-white shadow-xs"
              style={{ backgroundColor: band.hexColor }}
            >
              {band.iconSymbol}
            </span>
            <span className="font-bold">
              {band.shortBadge}:{" "}
              <span className={dark ? "text-slate-300" : "text-slate-600"}>
                {band.rangeText}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
