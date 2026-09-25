"use client";

import React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CloudRain, AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { DailyForecastPoint, ForecastHorizon } from "@/types/monsoon";

interface RainfallChartProps {
  data: DailyForecastPoint[];
  horizon: ForecastHorizon;
  onHorizonChange: (h: ForecastHorizon) => void;
  blockName: string;
  uncertaintyTier?: string;
}

const HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

export function RainfallChart({
  data,
  horizon,
  onHorizonChange,
  blockName,
  uncertaintyTier = "Moderate Uncertainty (±24%)",
}: RainfallChartProps) {
  const totalPredictedMm = data
    .reduce((acc, d) => acc + d.predictedMm, 0)
    .toFixed(1);
  const totalNormalMm = data
    .reduce((acc, d) => acc + d.historicalAvgMm, 0)
    .toFixed(1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-5 sm:p-6">
      {/* Header & Horizon Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/70">
              <CloudRain className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Simulated Rainfall Trajectory — {blockName} ({horizon})
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-extrabold uppercase">
              {uncertaintyTier}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulated daily rainfall (mm), 30-year climatological normal, and
            horizon-scaled P10–P90 ensemble uncertainty band
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => onHorizonChange(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                horizon === h
                  ? "bg-[#0B3B24] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & Cumulative Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 rounded-full bg-sky-600 inline-block" />
            <span className="font-semibold text-slate-700">
              Predicted Rainfall ({totalPredictedMm} mm)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-emerald-700 inline-block" />
            <span className="font-medium text-slate-600">
              Historical Average ({totalNormalMm} mm)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded-xs bg-sky-200/70 border border-sky-300 inline-block" />
            <span className="font-medium text-slate-600">
              P10–P90 Uncertainty Band ({uncertaintyTier.split(" ")[0]})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Simulated Dataset — Block &amp; Horizon Responsive</span>
        </div>
      </div>

      {/* Interactive Recharts Container */}
      <div className="h-[310px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 14, left: -10, bottom: 4 }}
          >
            <defs>
              <linearGradient id="uncertaintyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284C7" stopOpacity={0.26} />
                <stop offset="95%" stopColor="#0284C7" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="predictedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: "#64748B" }}
              tickLine={false}
              axisLine={{ stroke: "#CBD5E1" }}
            />
            <YAxis
              unit=" mm"
              tick={{ fontSize: 11, fill: "#64748B" }}
              tickLine={false}
              axisLine={false}
            />

            {data.length >= 14 && (
              <ReferenceArea
                x1="19 Jun"
                x2="26 Jun"
                fill="#FEF3C7"
                fillOpacity={0.5}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item: DailyForecastPoint = payload[0].payload;
                return (
                  <div className="bg-[#0B3B24] text-white p-3.5 rounded-xl shadow-xl border border-emerald-700/60 text-xs min-w-[220px]">
                    <div className="flex items-center justify-between border-b border-emerald-800 pb-1.5 mb-2">
                      <span className="font-bold text-sm">{item.dateLabel}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.phaseLabel === "Break / Dry Spell"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            : item.phaseLabel === "Onset Surge"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-400/40"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {item.phaseLabel}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">
                          Predicted Rainfall:
                        </span>
                        <span className="font-bold text-sky-300">
                          {item.predictedMm} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">
                          Historical Average:
                        </span>
                        <span className="font-semibold text-white">
                          {item.historicalAvgMm} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">
                          Uncertainty Range (P10–P90):
                        </span>
                        <span className="font-mono text-emerald-300">
                          {item.uncertaintyLowMm} – {item.uncertaintyHighMm} mm
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            {/* Uncertainty Range Area */}
            <Area
              type="monotone"
              dataKey="uncertaintyHighMm"
              stroke="#38BDF8"
              strokeWidth={1}
              strokeDasharray="2 2"
              fill="url(#uncertaintyGrad)"
              name="Upper Uncertainty (P90)"
            />

            {/* Predicted Daily Rainfall */}
            <Area
              type="monotone"
              dataKey="predictedMm"
              stroke="#0284C7"
              strokeWidth={2.6}
              fill="url(#predictedFill)"
              name="Predicted Rainfall"
              activeDot={{
                r: 5,
                fill: "#0284C7",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />

            {/* Historical Climatological Average */}
            <Line
              type="monotone"
              dataKey="historicalAvgMm"
              stroke="#15803D"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Historical Average"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Interpreter Bar */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong>{blockName} ({horizon}):</strong> Cumulative simulated
            rainfall is <strong>{totalPredictedMm} mm</strong> vs{" "}
            <strong>{totalNormalMm} mm</strong> historical average ({uncertaintyTier}).
          </span>
        </div>
      </div>
    </div>
  );
}
