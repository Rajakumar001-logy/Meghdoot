"use client";

import React from "react";
import { ShieldCheck, Database, Cpu, Clock, AlertTriangle } from "lucide-react";
import { formatUpdatedAgo } from "@/lib/geo";
import { PROTOTYPE_RISK_THRESHOLD_LABEL } from "@/config/riskThresholds";

interface MapProvenancePanelProps {
  geometryMode: "polygon_boundary" | "centroid_fallback";
  geometrySource: string;
  geometryVersion: string;
  fallbackBannerText: string | null;
  observationSource: string;
  observationQuality: string;
  observationIsLive: boolean;
  forecastModeLabel: "AI FORECAST" | "SIMULATED FORECAST" | "DEMO MODE";
  modelName: string;
  modelVersion: string;
  trainingPeriod: string;
  testPeriod: string;
  lastUpdatedTimestamp: string;
}

export function MapProvenancePanel({
  geometryMode,
  geometrySource,
  geometryVersion,
  fallbackBannerText,
  observationSource,
  observationQuality,
  observationIsLive,
  forecastModeLabel,
  modelName,
  modelVersion,
  trainingPeriod,
  testPeriod,
  lastUpdatedTimestamp,
}: MapProvenancePanelProps) {
  return (
    <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 space-y-2.5">
      {/* Centroid Fallback Honesty Banner if active */}
      {geometryMode === "centroid_fallback" && fallbackBannerText && (
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-200 font-bold text-[11px]"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{fallbackBannerText}</span>
        </div>
      )}

      {/* Required 6-field GIS Provenance Matrix (Section 16) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="w-3 h-3" />
            <span>BOUNDARIES</span>
          </div>
          <p
            className="font-bold text-white text-[11px] mt-0.5 truncate"
            title={geometrySource}
          >
            {geometryMode === "polygon_boundary"
              ? "Official Multi-Vertex Polygons"
              : "LGD / Census 2011 Block Centroids"}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {geometryVersion} • EPSG:4326
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-400">
            <Database className="w-3 h-3" />
            <span>OBSERVATIONS</span>
          </div>
          <p
            className="font-bold text-white text-[11px] mt-0.5 truncate"
            title={observationSource}
          >
            {observationSource}
          </p>
          <p className="text-[10px] text-slate-400">
            {observationIsLive ? "Live Telemetry" : "Stored Real Archive"} (
            {observationQuality})
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            <Cpu className="w-3 h-3" />
            <span>AI MODEL</span>
          </div>
          <p className="font-bold text-white text-[11px] mt-0.5">
            {modelVersion} ({modelName})
          </p>
          <p className="text-[10px] text-emerald-300 font-semibold">
            Mode: {forecastModeLabel}
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            TRAINING WINDOW
          </span>
          <p className="font-extrabold text-white text-xs mt-0.5">
            {trainingPeriod}
          </p>
          <p className="text-[10px] text-slate-400">
            Chronological Split (Val: 2023)
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            HELD-OUT TEST
          </span>
          <p className="font-extrabold text-emerald-300 text-xs mt-0.5">
            {testPeriod}
          </p>
          <p className="text-[10px] text-slate-400">
            Strict Out-of-Sample Evaluation
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <Clock className="w-3 h-3" />
            <span>LAST UPDATED</span>
          </div>
          <p className="font-bold text-white text-[11px] mt-0.5">
            {formatUpdatedAgo(lastUpdatedTimestamp)}
          </p>
          <p
            className="text-[10px] text-slate-400 truncate"
            title={lastUpdatedTimestamp}
          >
            {lastUpdatedTimestamp}
          </p>
        </div>
      </div>

      {/* Scientific Honesty Footer (Section 27) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
        <span>
          <strong>Scientific Transparency:</strong>{" "}
          {geometryMode === "polygon_boundary"
            ? "Official WGS84 block boundary polygons"
            : "Official LGD / Census 2011 WGS84 block centroids (zero fabricated polygon vertices)"}{" "}
          • Active Engine:{" "}
          <strong className="text-slate-200">{forecastModeLabel}</strong> •{" "}
          {PROTOTYPE_RISK_THRESHOLD_LABEL}
        </span>
        <span>Held-Out Test Window: {testPeriod}</span>
      </div>
    </div>
  );
}
