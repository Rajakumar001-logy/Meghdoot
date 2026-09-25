"use client";

import React from "react";
import { Cpu, Database, FlaskConical, Radio } from "lucide-react";

export type ProvenanceBadgeState = "REAL" | "SIMULATED" | "AI" | "DEMO";

interface DataProvenanceBadgeProps {
  state: ProvenanceBadgeState;
  detail?: string;
  size?: "xs" | "sm";
}

const PROVENANCE_CONFIG: Record<
  ProvenanceBadgeState,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  REAL: {
    label: "REAL OBSERVATION",
    bg: "bg-emerald-100",
    border: "border-emerald-300",
    text: "text-emerald-950",
    Icon: Radio,
  },
  SIMULATED: {
    label: "SIMULATED FORECAST",
    bg: "bg-sky-100",
    border: "border-sky-300",
    text: "text-sky-950",
    Icon: Database,
  },
  AI: {
    label: "AI PREDICTION (MPAI-ENS-0.1)",
    bg: "bg-indigo-100",
    border: "border-indigo-300",
    text: "text-indigo-950",
    Icon: Cpu,
  },
  DEMO: {
    label: "DEMO DATA",
    bg: "bg-amber-100",
    border: "border-amber-300",
    text: "text-amber-950",
    Icon: FlaskConical,
  },
};

/**
 * Reusable DataProvenanceBadge (Prompt 10 Section 3).
 * Explicitly labels data provenance across every major screen:
 * - REAL (REAL OBSERVATION)
 * - SIMULATED (SIMULATED FORECAST)
 * - AI (AI PREDICTION)
 * - DEMO (DEMO DATA)
 */
export function DataProvenanceBadge({
  state,
  detail,
  size = "xs",
}: DataProvenanceBadgeProps) {
  const cfg = PROVENANCE_CONFIG[state] || PROVENANCE_CONFIG.DEMO;
  const Icon = cfg.Icon;

  return (
    <span
      role="status"
      aria-label={`Data provenance: ${cfg.label}${detail ? ` (${detail})` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-md border font-extrabold uppercase tracking-wider ${
        cfg.bg
      } ${cfg.border} ${cfg.text} ${
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{cfg.label}</span>
      {detail && <span className="font-mono font-semibold opacity-85">• {detail}</span>}
    </span>
  );
}

export default DataProvenanceBadge;
