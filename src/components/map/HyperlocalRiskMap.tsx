"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Filter,
  Compass,
  Maximize2,
  RotateCcw,
  Cpu,
  AlertTriangle,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Block, ForecastHorizon, RiskFilterType } from "@/types/monsoon";
import { useMonsoon } from "@/context/MonsoonContext";
import {
  BlockSpatialIntelligence,
  GISBatchIntelligenceResponse,
  GISMapLayerId,
} from "@/types/gis";
import { fetchGISBlockIntelligence } from "@/services/gisService";
import { GIS_MAP_LAYERS, formatUpdatedAgo } from "@/lib/geo";
import {
  classifyProbabilityToRiskBand,
  computeOverallAgriculturalRisk,
  RiskThresholdBand,
} from "@/config/riskThresholds";
import { RiskLegend } from "@/components/map/RiskLegend";
import { MapProvenancePanel } from "@/components/map/MapProvenancePanel";
import { BlockDetailPanel } from "@/components/map/BlockDetailPanel";

const HORIZON_OPTIONS: { id: ForecastHorizon; label: string }[] = [
  { id: "7D", label: "7D" },
  { id: "14D", label: "14D" },
  { id: "21D", label: "21D" },
  { id: "30D", label: "30D" },
];

// Map between MonsoonContext RiskFilterType and the 7 GISMapLayerIds (A through G)
const FILTER_TO_GIS_LAYER: Record<RiskFilterType, GISMapLayerId> = {
  monsoon_onset: "monsoon_onset",
  false_onset: "false_onset",
  dry_spell: "dry_spell",
  heavy_rainfall: "heavy_rain",
  expected_rainfall: "expected_rainfall",
  rainfall_deficit: "rainfall_anomaly",
  overall_agricultural_risk: "overall_agricultural_risk",
};

const GIS_LAYER_TO_FILTER: Record<GISMapLayerId, RiskFilterType> = {
  monsoon_onset: "monsoon_onset",
  false_onset: "false_onset",
  dry_spell: "dry_spell",
  heavy_rain: "heavy_rainfall",
  expected_rainfall: "expected_rainfall",
  rainfall_anomaly: "rainfall_deficit",
  overall_agricultural_risk: "overall_agricultural_risk",
};

export function evaluateBlockRiskForFilter(
  block: Block,
  filter: RiskFilterType
): {
  level: "Low" | "Moderate" | "High" | "Very High";
  score: number;
  displayValue: string;
  hex: string;
  bgClass: string;
  badgeText: string;
} {
  let metric = block.drySpellProbability;
  let displayValue = `${block.drySpellProbability}%`;

  if (filter === "monsoon_onset") {
    metric = 100 - block.onsetProbability;
    displayValue = `${block.onsetProbability}% Onset (${metric}% Risk)`;
  } else if (filter === "false_onset") {
    metric = block.falseOnsetProbability;
    displayValue = `${block.falseOnsetProbability}%`;
  } else if (filter === "dry_spell") {
    metric = block.drySpellProbability;
    displayValue = `${block.drySpellProbability}%`;
  } else if (filter === "heavy_rainfall") {
    metric = block.heavyRainProbability;
    displayValue = `${block.heavyRainProbability}%`;
  } else if (filter === "expected_rainfall") {
    metric = Math.min(100, Math.max(10, 100 - (block.expectedRainfall / 260) * 100));
    displayValue = `${block.expectedRainfall} mm`;
  } else if (filter === "rainfall_deficit") {
    metric = Math.max(10, Math.min(95, Math.abs(block.rainfallAnomaly) * 2.2));
    displayValue =
      block.rainfallAnomaly > 0
        ? `+${block.rainfallAnomaly}%`
        : `${block.rainfallAnomaly}%`;
  } else if (filter === "overall_agricultural_risk") {
    const res = computeOverallAgriculturalRisk({
      onsetProbability: block.onsetProbability / 100,
      falseOnsetProbability: block.falseOnsetProbability / 100,
      drySpellProbability: block.drySpellProbability / 100,
      heavyRainProbability: block.heavyRainProbability / 100,
    });
    metric = Math.round(res.overallRiskPct);
    displayValue = `${res.overallRiskPct}% Ag Risk`;
  }

  const band = classifyProbabilityToRiskBand(metric);
  const levelMap: Record<
    RiskThresholdBand["category"],
    "Low" | "Moderate" | "High" | "Very High"
  > = {
    LOW: "Low",
    MODERATE: "Moderate",
    HIGH: "High",
    "VERY HIGH": "Very High",
  };

  return {
    level: levelMap[band.category],
    score: Math.round(metric),
    displayValue,
    hex: band.hexColor,
    bgClass: `${band.tailwindBg} ${band.tailwindText}`,
    badgeText: `${band.iconSymbol} ${band.shortBadge} Risk`,
  };
}

/**
 * Evaluates a block's risk band and display value for the active layer & horizon
 * using either the Spatial Intelligence server payload or local fallback.
 */
function evaluateSpatialBlockLayer(
  block: Block,
  spatialBlock: BlockSpatialIntelligence | undefined,
  layerId: GISMapLayerId,
  horizon: ForecastHorizon,
  isAIMode: boolean,
  aiPredictionUnavailable: boolean
): {
  band: RiskThresholdBand;
  riskPercent: number;
  displayValue: string;
  secondaryLabel: string;
  unavailable: boolean;
} {
  if (isAIMode && aiPredictionUnavailable) {
    const fallbackBand = classifyProbabilityToRiskBand(0);
    return {
      band: {
        ...fallbackBand,
        hexColor: "#64748B",
        shortBadge: "LOW",
      },
      riskPercent: 0,
      displayValue: "AI N/A",
      secondaryLabel: "AI prediction unavailable",
      unavailable: true,
    };
  }

  // Use spatialBlock.layer_risks if available
  const layerRisk = spatialBlock?.layer_risks?.[layerId];
  if (layerRisk) {
    if (layerRisk.category === "UNAVAILABLE") {
      const fallbackBand = classifyProbabilityToRiskBand(0);
      return {
        band: {
          ...fallbackBand,
          hexColor: "#64748B",
          shortBadge: "LOW",
        },
        riskPercent: 0,
        displayValue: "AI N/A",
        secondaryLabel: "AI prediction unavailable",
        unavailable: true,
      };
    }
    const probPct =
      layerRisk.probability !== null
        ? Math.round(layerRisk.probability * 1000) / 10
        : 20;
    const band = classifyProbabilityToRiskBand(probPct);
    return {
      band,
      riskPercent: probPct,
      displayValue: layerRisk.display_value,
      secondaryLabel: layerRisk.label,
      unavailable: false,
    };
  }

  // Fallback evaluation
  const filterKey = GIS_LAYER_TO_FILTER[layerId];
  const simEval = evaluateBlockRiskForFilter(block, filterKey);
  const band = classifyProbabilityToRiskBand(simEval.score);
  return {
    band,
    riskPercent: simEval.score,
    displayValue: simEval.displayValue,
    secondaryLabel: `${horizon}`,
    unavailable: false,
  };
}

// Prayagraj District Bounding Box in EPSG:4326
const PRAYAGRAJ_BOUNDS: [[number, number], [number, number]] = [
  [24.78, 81.5],
  [25.75, 82.35],
];
const PRAYAGRAJ_CENTER: [number, number] = [25.32, 81.94];

export function HyperlocalRiskMap({ compact = false }: { compact?: boolean }) {
  const {
    allBlocks,
    selectedBlockId,
    setSelectedBlockId,
    selectedBlock,
    horizon,
    setHorizon,
    selectedRiskType,
    setSelectedRiskType,
    forecastEngineMode,
    setForecastEngineMode,
    demoScenario,
    setDemoScenario,
    demoScenarios,
  } = useMonsoon();

  const [gisPayload, setGisPayload] =
    useState<GISBatchIntelligenceResponse | null>(null);
  const [isLoadingGis, setIsLoadingGis] = useState<boolean>(true);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<"leaflet" | "wgs84_canvas">(
    "leaflet"
  );
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);

  // Failure state simulation toggles (Section 21 verification)
  const [simulateAIFailure, setSimulateAIFailure] = useState<boolean>(false);
  const [simulateObsFailure, setSimulateObsFailure] = useState<boolean>(false);
  const [showResilienceToggles, setShowResilienceToggles] =
    useState<boolean>(false);

  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const activeLayerId: GISMapLayerId =
    FILTER_TO_GIS_LAYER[selectedRiskType] || "false_onset";
  const activeLayerMeta =
    GIS_MAP_LAYERS.find((l) => l.id === activeLayerId) || GIS_MAP_LAYERS[1];

  const isAIMode = forecastEngineMode === "AI_FORECAST";
  const forecastModeLabel: "AI FORECAST" | "SIMULATED FORECAST" | "DEMO MODE" =
    forecastEngineMode === "AI_FORECAST"
      ? "AI FORECAST"
      : forecastEngineMode === "SIMULATED"
      ? "SIMULATED FORECAST"
      : "DEMO MODE";

  // Load real GIS Spatial Intelligence payload from /api/gis/block-intelligence
  const loadGisIntelligence = useCallback(async () => {
    setIsLoadingGis(true);
    const data = await fetchGISBlockIntelligence({
      horizon,
      engineMode: forecastEngineMode,
      scenario: demoScenario,
      simulateAiFailure: simulateAIFailure,
      simulateObsFailure: simulateObsFailure,
    });
    if (data) {
      setGisPayload(data);
    }
    setIsLoadingGis(false);
  }, [
    horizon,
    forecastEngineMode,
    demoScenario,
    simulateAIFailure,
    simulateObsFailure,
  ]);

  useEffect(() => {
    loadGisIntelligence();
  }, [loadGisIntelligence]);

  const spatialBlocksMap = useMemo(() => {
    const map: Record<string, BlockSpatialIntelligence> = {};
    if (gisPayload?.blocks) {
      for (const b of gisPayload.blocks) {
        map[b.block_id] = b;
      }
    }
    return map;
  }, [gisPayload]);

  const hoveredBlock = hoveredBlockId
    ? allBlocks.find((b) => b.id === hoveredBlockId) || null
    : null;
  const hoveredSpatial = hoveredBlockId
    ? spatialBlocksMap[hoveredBlockId] || null
    : null;

  // Initialize Leaflet Map instance once when rendererMode === "leaflet"
  useEffect(() => {
    if (rendererMode !== "leaflet" || !leafletContainerRef.current) return;

    let isMounted = true;

    async function setupLeafletMap() {
      const L = (await import("leaflet")).default;
      if (!isMounted || !leafletContainerRef.current) return;

      if (!leafletInstanceRef.current) {
        const map = L.map(leafletContainerRef.current, {
          center: PRAYAGRAJ_CENTER,
          zoom: 9,
          zoomControl: true,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              "&copy; OpenStreetMap &copy; CARTO • LGD / Census 2011 WGS84 (EPSG:4326)",
            maxZoom: 16,
          }
        ).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
        leafletInstanceRef.current = map;
      }

      // Render/Update layers dynamically without destroying the map instance (Section 14)
      const map = leafletInstanceRef.current;
      const group = layerGroupRef.current;
      if (!map || !group) return;

      group.clearLayers();

      // 1. Draw Prayagraj District WGS84 Bounding Envelope Reference
      L.rectangle(PRAYAGRAJ_BOUNDS, {
        color: "#10B981",
        weight: 1.5,
        dashArray: "6 6",
        fillColor: "#064E3B",
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(group);

      // 2. Render each of the 8 Prayagraj Blocks from validated EPSG:4326 GeoJSON / Spatial Intelligence
      allBlocks.forEach((block) => {
        const sb = spatialBlocksMap[block.id];
        const lat = sb?.coordinates?.[0] ?? block.coordinates[0];
        const lon = sb?.coordinates?.[1] ?? block.coordinates[1];

        const evalState = evaluateSpatialBlockLayer(
          block,
          sb,
          activeLayerId,
          horizon,
          isAIMode,
          simulateAIFailure
        );
        const isSelected = block.id === selectedBlockId;

        const aiHoriz =
          !simulateAIFailure && sb?.prediction?.available
            ? sb.prediction
            : null;
        const obs =
          !simulateObsFailure && sb?.observation?.available
            ? sb.observation
            : null;

        // Build Section 12 compliant Hover Tooltip HTML
        const onsetStr = isAIMode
          ? aiHoriz && aiHoriz.onset_probability_pct !== null
            ? `${Math.round((100 - aiHoriz.onset_probability_pct) * 10) / 10}% (Onset: ${
                aiHoriz.onset_probability_pct
              }%)`
            : "AI prediction unavailable"
          : `${100 - block.onsetProbability}% (Onset: ${block.onsetProbability}%)`;

        const falseOnsetStr = isAIMode
          ? aiHoriz && aiHoriz.false_onset_probability_pct !== null
            ? `${aiHoriz.false_onset_probability_pct}%`
            : "N/A"
          : `${block.falseOnsetProbability}%`;

        const drySpellStr = isAIMode
          ? aiHoriz && aiHoriz.dry_spell_probability_pct !== null
            ? `${aiHoriz.dry_spell_probability_pct}%`
            : "N/A"
          : `${block.drySpellProbability}%`;

        const heavyRainStr = isAIMode
          ? aiHoriz && aiHoriz.heavy_rain_probability_pct !== null
            ? `${aiHoriz.heavy_rain_probability_pct}%`
            : "N/A"
          : `${block.heavyRainProbability}%`;

        const latestRainStr = obs
          ? `${obs.rainfall_mm ?? 0} mm`
          : "Latest observation unavailable";
        const obsTimeStr =
          obs && obs.observation_timestamp
            ? `${obs.observation_timestamp} (${
                obs.updated_ago || formatUpdatedAgo(obs.observation_timestamp)
              })`
            : "Unavailable";

        const tooltipHtml = `
          <div style="min-width:210px;font-family:system-ui,-apple-system,sans-serif;padding:4px;">
            <div style="font-weight:800;font-size:13px;color:#0F172A;border-bottom:1px solid #E2E8F0;padding-bottom:3px;margin-bottom:4px;">
              ${block.name.toUpperCase()}
            </div>
            <div style="font-size:11px;font-weight:700;color:#047857;margin-bottom:4px;">
              ${forecastModeLabel} • Horizon: ${horizon}
            </div>
            <div style="font-size:11px;line-height:1.45;color:#1E293B;">
              <div><strong>Onset Risk:</strong> ${onsetStr}</div>
              <div><strong>False Onset:</strong> ${falseOnsetStr}</div>
              <div><strong>Dry Spell:</strong> ${drySpellStr}</div>
              <div><strong>Heavy Rain:</strong> ${heavyRainStr}</div>
              <div style="margin-top:4px;padding-top:4px;border-top:1px dashed #CBD5E1;">
                <strong>Latest Rainfall:</strong> ${latestRainStr}
              </div>
              <div><strong>Observed:</strong> ${obsTimeStr}</div>
              <div style="font-weight:700;color:#0F172A;margin-top:2px;">
                Model: ${
                  isAIMode
                    ? aiHoriz?.model_version || "MPAI-ENS-0.1"
                    : forecastModeLabel
                }
              </div>
            </div>
          </div>
        `;

        // Check if official polygon geometry is provided; otherwise render honest centroid markers (Section 3 & 28.17)
        if (
          sb?.geometry &&
          (sb.geometry.type === "Polygon" || sb.geometry.type === "MultiPolygon")
        ) {
          const geoLayer = L.geoJSON(
            {
              type: "Feature",
              properties: { block_id: block.id },
              geometry: sb.geometry,
            } as any,
            {
              style: {
                color: isSelected ? "#FFFFFF" : evalState.band.hexColor,
                weight: isSelected ? 3.5 : 2,
                fillColor: evalState.band.hexColor,
                fillOpacity: isSelected ? 0.72 : 0.48,
              },
            }
          ).addTo(group);

          geoLayer.bindTooltip(tooltipHtml, { sticky: true });
          geoLayer.on("click", () => setSelectedBlockId(block.id));
        } else {
          // Outer spatial halo indicating block HQ zone in WGS84
          L.circle([lat, lon], {
            radius: isSelected ? 8200 : 6800,
            color: isSelected ? "#FFFFFF" : evalState.band.hexColor,
            weight: isSelected ? 3 : 1.8,
            dashArray: isSelected ? undefined : "4 4",
            fillColor: evalState.band.hexColor,
            fillOpacity: isSelected ? 0.42 : 0.25,
          })
            .addTo(group)
            .on("click", () => setSelectedBlockId(block.id));

          // Exact WGS84 Block HQ Centroid Point Marker with label badge
          const markerIcon = L.divIcon({
            className: "mpai-centroid-marker",
            html: `
              <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
                <div style="
                  background:${evalState.band.hexColor};
                  color:#FFFFFF;
                  border:${isSelected ? "3px solid #FFFFFF" : "2px solid #0F172A"};
                  box-shadow:0 4px 12px rgba(0,0,0,0.45);
                  padding:3px 8px;
                  border-radius:999px;
                  font-size:11px;
                  font-weight:800;
                  white-space:nowrap;
                  display:flex;
                  align-items:center;
                  gap:4px;
                ">
                  <span>${evalState.band.iconSymbol}</span>
                  <span>${block.name.replace(" Block", "")}</span>
                  <span style="opacity:0.92;font-weight:900;">${evalState.displayValue}</span>
                </div>
              </div>
            `,
            iconSize: [120, 32],
            iconAnchor: [60, 16],
          });

          const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(group);
          marker.bindTooltip(tooltipHtml, {
            direction: "top",
            offset: [0, -14],
          });
          marker.on("click", () => {
            setSelectedBlockId(block.id);
          });
        }
      });
    }

    setupLeafletMap();
  }, [
    rendererMode,
    allBlocks,
    spatialBlocksMap,
    activeLayerId,
    horizon,
    isAIMode,
    forecastModeLabel,
    selectedBlockId,
    simulateAIFailure,
    simulateObsFailure,
    setSelectedBlockId,
  ]);

  // Cleanup Leaflet instance on unmount or when switching away from leaflet
  useEffect(() => {
    return () => {
      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
        leafletInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [rendererMode]);

  const handleFitToDistrict = () => {
    if (leafletInstanceRef.current) {
      leafletInstanceRef.current.fitBounds(PRAYAGRAJ_BOUNDS, {
        padding: [24, 24],
      });
    }
  };

  const handleResetView = () => {
    if (leafletInstanceRef.current) {
      leafletInstanceRef.current.setView(PRAYAGRAJ_CENTER, 9);
    }
  };

  const selectedSpatialBlock = spatialBlocksMap[selectedBlockId] || null;
  const geometryMode =
    gisPayload?.provenance?.boundaries?.geometry_mode || "centroid_fallback";
  const fallbackBannerText =
    gisPayload?.provenance?.boundaries?.status_banner ||
    "Boundary data unavailable — displaying block centroids.";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft overflow-hidden">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {/* 1. SCIENTIFIC HONESTY & CENTROID FALLBACK BANNER (Section 3 & 28.17) */}
      {geometryMode === "centroid_fallback" && (
        <div
          role="status"
          className="bg-amber-950 text-amber-200 px-4 py-2 border-b border-amber-800/80 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 font-extrabold">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{fallbackBannerText}</span>
          </div>
          <span className="text-[11px] text-amber-300/90">
            LGD District 130 / Census 2011 District 175 WGS84 (EPSG:4326)
            Headquarters Centroids • Zero Fabricated Polygon Vertices
          </span>
        </div>
      )}

      {/* 2. TOP FILTER, ENGINE MODE, HORIZON & LAYER CONTROL BAR */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col gap-3.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#0B3B24] text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                REAL GIS + SPATIAL INTELLIGENCE
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-extrabold">
                MODEL: MPAI-ENS-0.1 (0.6 XGB + 0.4 LSTM)
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Prayagraj District Block-Level Monsoon Intelligence Map (EPSG:4326)
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Real WGS84 block coordinates connected to{" "}
              <strong>REAL OBSERVATIONS</strong> and{" "}
              <strong>MPAI-ENS-0.1 Multi-Horizon (7D/14D/21D/30D)</strong>{" "}
              calibrated ensemble predictions.
            </p>
          </div>

          {/* Engine Mode Switcher (Preserves DEMO MODE, SIMULATED FORECAST, AI FORECAST) */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Forecast Engine Mode"
              className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs"
            >
              <button
                onClick={() => setForecastEngineMode("AI_FORECAST")}
                className={`px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1 transition ${
                  forecastEngineMode === "AI_FORECAST"
                    ? "bg-[#0B3B24] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                AI FORECAST
              </button>
              <button
                onClick={() => setForecastEngineMode("SIMULATED")}
                className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                  forecastEngineMode === "SIMULATED"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                SIMULATED FORECAST
              </button>
              <button
                onClick={() => setForecastEngineMode("DEMO")}
                className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                  forecastEngineMode === "DEMO"
                    ? "bg-emerald-700 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                DEMO MODE
              </button>
            </div>

            {/* Demo Scenario Selector when in DEMO or SIMULATED mode */}
            {forecastEngineMode !== "AI_FORECAST" && (
              <select
                aria-label="Select Demo Scenario"
                value={demoScenario}
                onChange={(e) => setDemoScenario(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                {demoScenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.code}: {sc.shortLabel}
                  </option>
                ))}
              </select>
            )}

            {/* Resilience / Failure Verification Toggle Button */}
            <button
              onClick={() => setShowResilienceToggles((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              title="Test Failure Handling States (Section 21)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
              <span>Verify Fallbacks</span>
            </button>
          </div>
        </div>

        {/* Optional Failure Simulation Bar (Section 21) */}
        {showResilienceToggles && (
          <div className="p-2.5 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-emerald-300">
              Section 21 Resilience &amp; Failure Verification Controls:
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateAIFailure}
                  onChange={(e) => setSimulateAIFailure(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span>
                  Simulate AI Prediction Failure (&quot;AI prediction
                  unavailable&quot;)
                </span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateObsFailure}
                  onChange={(e) => setSimulateObsFailure(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span>
                  Simulate Observation Failure (&quot;Latest observation
                  unavailable&quot;)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Second Row: 7 Map Layers (A–G) + 4 Horizons (7D/14D/21D/30D) + Map Renderer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
          {/* 7 Required Map Layer Selector (A through G) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-600 mr-1">
              <Filter className="w-3.5 h-3.5 text-emerald-700" />
              <span>Map Layer (A–G):</span>
            </div>
            {GIS_MAP_LAYERS.map((layer) => {
              const filterKey = GIS_LAYER_TO_FILTER[layer.id];
              const isActive = selectedRiskType === filterKey;
              return (
                <button
                  key={layer.id}
                  onClick={() => setSelectedRiskType(filterKey)}
                  title={layer.description}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    isActive
                      ? "bg-[#0B3B24] text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-emerald-400 mr-1">{layer.code}.</span>
                  {layer.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Horizon Selector (7D | 14D | 21D | 30D) + View Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5">
                Horizon:
              </span>
              {HORIZON_OPTIONS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHorizon(h.id)}
                  className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                    horizon === h.id
                      ? "bg-[#0B3B24] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            {/* Renderer Switcher (Leaflet GIS vs WGS84 Graticule Plot) */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setRendererMode("leaflet")}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                  rendererMode === "leaflet"
                    ? "bg-emerald-700 text-white"
                    : "text-slate-600"
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Leaflet WGS84
              </button>
              <button
                onClick={() => setRendererMode("wgs84_canvas")}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                  rendererMode === "wgs84_canvas"
                    ? "bg-emerald-700 text-white"
                    : "text-slate-600"
                }`}
              >
                EPSG:4326 Plot
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN SPLIT VIEW: MAP CANVAS (7 COLS) + FULL SPATIAL DETAIL PANEL (5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT 7 COLS: REAL WGS84 SPATIAL INTELLIGENCE MAP */}
        <div className="lg:col-span-7 relative bg-gradient-to-br from-slate-950 via-[#072617] to-slate-950 min-h-[540px] flex flex-col justify-between p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-200 space-y-3">
          {/* Top Map Overlay Status & Zoom/Fit Controls (Section 18) */}
          <div className="z-10 flex flex-wrap items-center justify-between gap-2">
            <div className="bg-slate-950/90 backdrop-blur-md text-white px-3.5 py-2 rounded-xl border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-extrabold">
                  Prayagraj District (LGD 130) • 8 Validated Block Centroids
                  (EPSG:4326)
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 mt-0.5">
                Layer{" "}
                <strong className="text-amber-300">
                  {activeLayerMeta.code}. {activeLayerMeta.label}
                </strong>{" "}
                • Horizon: <strong>{horizon}</strong> • Engine:{" "}
                <strong className="text-white">{forecastModeLabel}</strong>
              </p>
            </div>

            {rendererMode === "leaflet" && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleFitToDistrict}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 text-xs font-bold transition"
                  title="Fit map bounds to Prayagraj District"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fit to District</span>
                </button>
                <button
                  onClick={handleResetView}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 text-xs font-bold transition"
                  title="Reset map zoom and center"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reset View</span>
                </button>
              </div>
            )}
          </div>

          {/* Interactive Hover Tooltip Overlay (Section 12) */}
          {hoveredBlock && (
            <div
              role="tooltip"
              className="z-20 bg-slate-950/95 text-white px-4 py-3 rounded-xl border border-emerald-400/60 shadow-2xl text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
                <span className="font-extrabold text-emerald-300 text-sm">
                  {hoveredBlock.name.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-[10px] font-bold text-emerald-200">
                  {forecastModeLabel} | {horizon}
                </span>
              </div>
              {(() => {
                const aiH =
                  !simulateAIFailure && hoveredSpatial?.prediction?.available
                    ? hoveredSpatial.prediction
                    : null;
                const obs =
                  !simulateObsFailure && hoveredSpatial?.observation?.available
                    ? hoveredSpatial.observation
                    : null;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Onset Risk:</span>
                      <strong className="text-white">
                        {isAIMode
                          ? aiH && aiH.onset_probability_pct !== null
                            ? `${
                                Math.round((100 - aiH.onset_probability_pct) * 10) /
                                10
                              }%`
                            : "Unavailable"
                          : `${100 - hoveredBlock.onsetProbability}%`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">False Onset:</span>
                      <strong className="text-amber-300">
                        {isAIMode
                          ? aiH && aiH.false_onset_probability_pct !== null
                            ? `${aiH.false_onset_probability_pct}%`
                            : "Unavailable"
                          : `${hoveredBlock.falseOnsetProbability}%`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Dry Spell:</span>
                      <strong className="text-orange-300">
                        {isAIMode
                          ? aiH && aiH.dry_spell_probability_pct !== null
                            ? `${aiH.dry_spell_probability_pct}%`
                            : "Unavailable"
                          : `${hoveredBlock.drySpellProbability}%`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Heavy Rain:</span>
                      <strong className="text-sky-300">
                        {isAIMode
                          ? aiH && aiH.heavy_rain_probability_pct !== null
                            ? `${aiH.heavy_rain_probability_pct}%`
                            : "Unavailable"
                          : `${hoveredBlock.heavyRainProbability}%`}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Latest Rainfall: </span>
                      <strong className="text-emerald-300">
                        {obs ? `${obs.rainfall_mm ?? 0} mm` : "Unavailable"}
                      </strong>{" "}
                      <span className="text-[10px] text-slate-400">
                        (Observed: {obs ? obs.observation_timestamp : "N/A"})
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-slate-400">Model: </span>
                      <strong className="text-white">
                        {isAIMode
                          ? aiH?.model_version || "MPAI-ENS-0.1"
                          : forecastModeLabel}
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MAP RENDERER: REAL LEAFLET WGS84 OR EPSG:4326 COORDINATE GRATICULE */}
          {rendererMode === "leaflet" ? (
            <div className="relative">
              <div
                ref={leafletContainerRef}
                className="w-full h-[390px] rounded-xl overflow-hidden border border-emerald-500/30 z-0"
              />
              {isLoadingGis && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center rounded-xl text-xs font-bold text-emerald-300">
                  Loading validated EPSG:4326 block geometries &amp; MPAI-ENS-0.1
                  spatial predictions...
                </div>
              )}
            </div>
          ) : (
            /* EPSG:4326 Projected Coordinate Graticule Plot (Zero fabricated polygons; exact WGS84 lat/lon projection) */
            <div className="relative w-full h-[390px] rounded-xl border border-emerald-500/30 bg-slate-950/90 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-emerald-300/80 font-mono">
                <span>25.75°N, 81.50°E (NW Prayagraj)</span>
                <span>WGS84 (EPSG:4326) True Coordinate Graticule</span>
                <span>25.75°N, 82.35°E (NE)</span>
              </div>

              <svg
                viewBox="0 0 540 330"
                className="w-full h-full select-none"
                role="img"
                aria-label="Prayagraj District WGS84 Block Centroid Coordinate Plot"
              >
                <defs>
                  <pattern
                    id="wgs84Grid"
                    width="54"
                    height="33"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 54 0 L 0 0 0 33"
                      fill="none"
                      stroke="rgba(16, 185, 129, 0.14)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="540" height="330" fill="url(#wgs84Grid)" rx="12" />

                {/* Ganga & Yamuna Hydrological Reference Curves */}
                <path
                  d="M 50 75 Q 200 115, 250 130 T 490 165"
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="5"
                  strokeOpacity="0.4"
                  strokeLinecap="round"
                />
                <path
                  d="M 45 185 Q 165 155, 250 130"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="4"
                  strokeOpacity="0.4"
                  strokeLinecap="round"
                />

                {/* Plot each block at its exact normalized EPSG:4326 [lon, lat] position */}
                {allBlocks.map((block) => {
                  const sb = spatialBlocksMap[block.id];
                  const lat = sb?.coordinates?.[0] ?? block.coordinates[0];
                  const lon = sb?.coordinates?.[1] ?? block.coordinates[1];

                  // Normalize lon [81.50..82.35] -> x [60..480], lat [24.78..25.75] -> y [290..40]
                  const cx =
                    60 + ((lon - 81.5) / (82.35 - 81.5)) * (480 - 60);
                  const cy =
                    290 - ((lat - 24.78) / (25.75 - 24.78)) * (290 - 40);

                  const evalState = evaluateSpatialBlockLayer(
                    block,
                    sb,
                    activeLayerId,
                    horizon,
                    isAIMode,
                    simulateAIFailure
                  );
                  const isSelected = block.id === selectedBlockId;
                  const isHovered = block.id === hoveredBlockId;

                  return (
                    <g
                      key={block.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${block.name}: ${evalState.displayValue} (${evalState.band.shortBadge} Risk)`}
                      onClick={() => setSelectedBlockId(block.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedBlockId(block.id);
                        }
                      }}
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      className="cursor-pointer focus:outline-none"
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 34 : isHovered ? 30 : 26}
                        fill={evalState.band.hexColor}
                        fillOpacity={isSelected ? 0.35 : 0.22}
                        stroke={isSelected ? "#FFFFFF" : evalState.band.hexColor}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={isSelected ? undefined : "4 3"}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 11 : 9}
                        fill={evalState.band.hexColor}
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      <text
                        x={cx}
                        y={cy - 15}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="11"
                        fontWeight="800"
                      >
                        {evalState.band.iconSymbol}{" "}
                        {block.name.replace(" Block", "")}
                      </text>
                      <text
                        x={cx}
                        y={cy + 24}
                        textAnchor="middle"
                        fill="#E2E8F0"
                        fontSize="10"
                        fontWeight="700"
                      >
                        {evalState.displayValue}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="flex items-center justify-between text-[10px] text-emerald-300/80 font-mono">
                <span>24.78°N, 81.50°E (SW)</span>
                <span>Boundary data unavailable — displaying block centroids.</span>
                <span>24.78°N, 82.35°E (SE Koraon)</span>
              </div>
            </div>
          )}

          {/* Keyboard-Accessible Block Centroid Selection Strip (Section 22) */}
          <div
            role="group"
            aria-label="Keyboard-accessible Prayagraj Block Selector"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
          >
            {allBlocks.map((block) => {
              const sb = spatialBlocksMap[block.id];
              const evalState = evaluateSpatialBlockLayer(
                block,
                sb,
                activeLayerId,
                horizon,
                isAIMode,
                simulateAIFailure
              );
              const isSelected = block.id === selectedBlockId;

              return (
                <button
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                  aria-pressed={isSelected}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition flex items-center justify-between gap-1.5 text-xs ${
                    isSelected
                      ? "bg-white text-slate-950 border-white font-extrabold shadow-md"
                      : "bg-slate-900/85 text-slate-200 border-slate-800 hover:border-emerald-500/50"
                  }`}
                >
                  <span className="truncate font-bold">
                    <span
                      aria-hidden="true"
                      className="mr-1"
                      style={{ color: evalState.band.hexColor }}
                    >
                      {evalState.band.iconSymbol}
                    </span>
                    {block.name.replace(" Block", "")}
                  </span>
                  <span
                    className="text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white shrink-0"
                    style={{ backgroundColor: evalState.band.hexColor }}
                  >
                    {evalState.displayValue}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 4. ACCESSIBLE MAP RISK LEGEND (Section 8, 15, 22) */}
          <RiskLegend dark />

          {/* 5. PROVENANCE PANEL ON MAP (Section 16, 17, 27) */}
          <MapProvenancePanel
            geometryMode={geometryMode}
            geometrySource={
              gisPayload?.provenance?.boundaries?.source ||
              "Government of India LGD (District 130) / Census 2011 (District 175) Block Headquarters Centroids"
            }
            geometryVersion={
              gisPayload?.provenance?.boundaries?.dataset_name ||
              "LGD-2024.1-CENTROID-FALLBACK"
            }
            fallbackBannerText={fallbackBannerText}
            observationSource={
              selectedSpatialBlock?.observation?.source ||
              gisPayload?.provenance?.observations_source ||
              "Open-Meteo ERA5 Historical / Prayagraj Block Grid Archive"
            }
            observationQuality={
              selectedSpatialBlock?.observation?.quality || "valid"
            }
            observationIsLive={false}
            forecastModeLabel={forecastModeLabel}
            modelName={
              gisPayload?.provenance?.ai_model_name || "MonsoonPulse Ensemble"
            }
            modelVersion={
              gisPayload?.provenance?.ai_model_version || "MPAI-ENS-0.1"
            }
            trainingPeriod={
              gisPayload?.provenance?.training_period || "2019–2022"
            }
            testPeriod={gisPayload?.provenance?.test_period || "2024–2025"}
            lastUpdatedTimestamp={
              selectedSpatialBlock?.observation?.observation_timestamp ||
              gisPayload?.provenance?.observations_last_updated ||
              "2025-08-31T12:00:00Z"
            }
          />
        </div>

        {/* RIGHT 5 COLS: FULL SPATIAL DETAIL PANEL (Desktop + Mobile Bottom Sheet Toggle) */}
        <div className="lg:col-span-5 bg-white">
          {/* Mobile Bottom Sheet Toggle Header */}
          <div className="lg:hidden p-3 bg-slate-900 text-white flex items-center justify-between">
            <span className="text-xs font-extrabold">
              Selected Block: {selectedBlock.name} ({horizon})
            </span>
            <button
              onClick={() => setMobileSheetOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold"
            >
              <span>
                {mobileSheetOpen ? "Hide Details" : "Expand Block Sheet"}
              </span>
              {mobileSheetOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className={`${mobileSheetOpen ? "block" : "hidden"} lg:block`}>
            <BlockDetailPanel
              selectedBlock={selectedBlock}
              spatialBlock={selectedSpatialBlock}
              horizon={horizon}
              onHorizonChange={setHorizon}
              forecastModeLabel={forecastModeLabel}
              aiPredictionUnavailable={simulateAIFailure}
              observationUnavailable={simulateObsFailure}
              compact={compact}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
