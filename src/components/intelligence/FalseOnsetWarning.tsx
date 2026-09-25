"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  Cpu,
  Droplets,
  Flame,
  ShieldAlert,
  Sprout,
} from "lucide-react";
import { FalseOnsetRuleEvaluation } from "@/types/monsoon";

interface FalseOnsetWarningProps {
  falseOnsetProbability?: number;
  expectedDrySpell?: string;
  recommendedAction?: string;
  blockName?: string;
  ruleEvaluation?: FalseOnsetRuleEvaluation;
}

export function FalseOnsetWarning({
  falseOnsetProbability = 68,
  expectedDrySpell = "8–11 days",
  recommendedAction = "Delay rainfed sowing and prepare supplemental irrigation.",
  blockName = "Karchhana Block",
  ruleEvaluation,
}: FalseOnsetWarningProps) {
  const initialBurst = ruleEvaluation?.initialRainBurstMm ?? 58;
  const peakMoisture = ruleEvaluation?.peakSoilMoisturePct ?? 55;
  const subRainProb = ruleEvaluation?.subsequentRainProbPct ?? 38;

  const steps = [
    {
      step: "01",
      title: "Rainfall Event",
      subtitle: `15–18 June Initial Shower in ${blockName}`,
      metric: `~${initialBurst} mm burst`,
      color: "bg-sky-50 border-sky-200 text-sky-900",
      icon: CloudRain,
      iconColor: "text-sky-600 bg-sky-100",
    },
    {
      step: "02",
      title: "Initial Wet Conditions",
      subtitle: `Top 10 cm soil moisture temporarily peaks at ${peakMoisture}%`,
      metric: "Temporary moisture spike",
      color: "bg-emerald-50 border-emerald-200 text-emerald-900",
      icon: Droplets,
      iconColor: "text-emerald-600 bg-emerald-100",
    },
    {
      step: "03",
      title: "Expected Prolonged Dry Spell",
      subtitle: `Subsequent rain probability drops to ${subRainProb}% (${expectedDrySpell} break)`,
      metric: `Dry Spell: ${expectedDrySpell}`,
      color: "bg-amber-50 border-amber-200 text-amber-900",
      icon: Flame,
      iconColor: "text-amber-600 bg-amber-100",
    },
    {
      step: "04",
      title: "⚠ False Onset Risk",
      subtitle: "Germinating seedlings face desiccation & thermal stress",
      metric: `${falseOnsetProbability}% Trap Risk`,
      color: "bg-red-50 border-red-300 text-red-950 ring-2 ring-red-500/20",
      icon: AlertTriangle,
      iconColor: "text-red-600 bg-red-100",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-amber-300/90 shadow-soft overflow-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0B3B24] via-emerald-950 to-amber-950 text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold tracking-tight">
                False Onset Early Warning — {blockName}
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                Prototype Decision Logic
              </span>
            </div>
            <p className="text-xs text-emerald-100/80">
              Simulated post-shower break-monsoon detector derived dynamically
              from {blockName} telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 block font-semibold">
              False Onset Probability
            </span>
            <span className="text-2xl font-extrabold text-amber-300">
              {falseOnsetProbability}%
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left 7 Cols: Causal Sequence Diagram */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Causal Atmospheric &amp; Soil Moisture Sequence ({blockName})
            </p>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Simulated Forecast — Demo
            </span>
          </div>
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.step}>
                <div
                  className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border ${item.color}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.iconColor}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase opacity-70">
                          Stage {item.step}
                        </span>
                        <h4 className="font-bold text-sm">{item.title}</h4>
                      </div>
                      <p className="text-xs opacity-85 mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-white/80 border border-current/15 shrink-0">
                    {item.metric}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Right 5 Cols: Prototype Rule Engine Evaluation & Action Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-amber-50/90 via-white to-red-50/50 rounded-2xl border border-amber-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200/70 pb-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                False Onset Probability
              </span>
              <span className="text-3xl font-extrabold text-red-600">
                {falseOnsetProbability}%
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 block">
                Expected Dry Spell
              </span>
              <span className="text-xl font-extrabold text-amber-700">
                {expectedDrySpell}
              </span>
            </div>
          </div>

          {/* Explicit Prototype Decision Logic Box (Requirement 8) */}
          <div className="p-3 rounded-xl bg-white border border-slate-200/90 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between font-extrabold text-slate-800 border-b border-slate-100 pb-1">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-700" />
                Prototype Decision Logic
              </span>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                Rule Evaluated
              </span>
            </div>
            <p className="text-slate-600 font-mono leading-relaxed">
              <strong>IF</strong> initial rainfall is high ({initialBurst} mm)
              <br />
              <strong>AND</strong> soil moisture temporarily increases (
              {peakMoisture}%)
              <br />
              <strong>AND</strong> subsequent rain probability drops (
              {subRainProb}%)
              <br />
              <strong>AND</strong> dry spell probability is high (
              {expectedDrySpell})
              <br />
              <strong>THEN</strong> False Onset Probability ={" "}
              <strong className="text-red-600">
                {falseOnsetProbability}%
              </strong>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0B3B24] text-white space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Sprout className="w-4 h-4" />
              Recommended Action ({blockName})
            </div>
            <p className="text-sm font-bold leading-snug text-white">
              {recommendedAction}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Link
              href="/advisories"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors"
            >
              Generate Block Advisory
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/farmers"
              className="inline-flex items-center justify-center px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition-colors"
            >
              Alert Farmers
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
