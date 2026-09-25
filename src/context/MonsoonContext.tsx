"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEMO_SCENARIOS,
  MOCK_CROPS,
  STATE_DISTRICTS,
  buildForecastForBlock,
  generateDynamicAlertsForState,
  getBlocksForScenarioAndHorizon,
  getClimateIndicesForScenario,
} from "@/data/mockData";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getBlocks } from "@/services/locationService";
import { getForecast } from "@/services/forecastService";
import {
  getAlerts,
  getPersistedReadAlertMap,
  markAlertRead as markAlertReadInDb,
  markAllAlertsRead as markAllAlertsReadInDb,
} from "@/services/alertService";
import { getClimateIndices } from "@/services/climateService";
import {
  getStoredWeatherSourceStatus,
  syncWeatherData,
} from "@/services/ingestion/weatherIngestion";
import {
  getStoredRainfallSourceStatus,
  syncRainfallData,
} from "@/services/ingestion/rainfallIngestion";
import {
  getStoredClimateSourceStatus,
  syncClimateIndices,
} from "@/services/ingestion/climateIngestion";
import {
  getAIPrediction,
  getModelHealth,
  getModelMetrics,
  ModelHealthStatus,
  ModelMetricsPayload,
} from "@/services/aiPredictionService";
import {
  AIPredictionRow,
  ClimateIndexObservationRow,
  DataSourceStatusRow,
  RainfallObservationRow,
  WeatherObservationRow,
} from "@/types/database";
import {
  Alert,
  Block,
  ClimateIndex,
  Crop,
  DemoScenarioId,
  DemoScenarioMeta,
  FarmerLanguage,
  Forecast,
  ForecastHorizon,
  RiskFilterType,
} from "@/types/monsoon";

interface ToastItem {
  id: string;
  title: string;
  description: string;
  type: "success" | "info" | "warning";
}

export interface DataSourceStatusesMap {
  weather: DataSourceStatusRow;
  rainfall: DataSourceStatusRow;
  climate: DataSourceStatusRow;
}

export type ForecastEngineMode = "DEMO" | "SIMULATED" | "AI_FORECAST";

interface MonsoonContextValue {
  selectedState: string;
  setSelectedState: (s: string) => void;
  selectedDistrict: string;
  setSelectedDistrict: (d: string) => void;
  selectedBlockId: string;
  setSelectedBlockId: (id: string) => void;
  selectedBlock: Block;
  horizon: ForecastHorizon;
  setHorizon: (h: ForecastHorizon) => void;
  selectedRiskType: RiskFilterType;
  setSelectedRiskType: (r: RiskFilterType) => void;
  selectedCropId: string;
  setSelectedCropId: (c: string) => void;
  selectedCrop: Crop;
  selectedStage: string;
  setSelectedStage: (s: string) => void;
  selectedLanguage: FarmerLanguage;
  setSelectedLanguage: (lang: FarmerLanguage) => void;
  demoScenario: DemoScenarioId;
  setDemoScenario: (s: DemoScenarioId) => void;
  currentScenarioMeta: DemoScenarioMeta;
  demoScenarios: DemoScenarioMeta[];
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  isSupabaseConnected: boolean;
  currentForecast: Forecast;
  climateIndices: ClimateIndex[];
  alerts: Alert[];
  markAlertAsRead: (id: string) => void;
  markAllAlertsAsRead: () => void;
  loadingMessage: string | null;
  triggerBriefLoading: (message: string, durationMs?: number) => void;
  simulatedError: boolean;
  setSimulatedError: (err: boolean) => void;
  retryLoadData: () => void;
  toasts: ToastItem[];
  triggerToast: (
    title: string,
    description: string,
    type?: "success" | "info" | "warning"
  ) => void;
  dismissToast: (id: string) => void;
  allBlocks: Block[];
  allCrops: Crop[];
  stateDistricts: Record<string, string[]>;
  // Real External Observation & Ingestion Layer
  liveDataActive: boolean;
  usingStoredObservationFallback: boolean;
  weatherObservation: WeatherObservationRow;
  rainfallObservation: RainfallObservationRow;
  rainfallObservationHistory: RainfallObservationRow[];
  climateObservations: ClimateIndexObservationRow[];
  dataSourceStatuses: DataSourceStatusesMap;
  isRefreshingExternalData: boolean;
  simulateExternalOffline: boolean;
  setSimulateExternalOffline: (val: boolean) => void;
  refreshExternalData: (
    target?: "all" | "weather" | "rainfall" | "climate",
    switchToLiveMode?: boolean
  ) => Promise<void>;
  // Real AI Prediction Engine Layer (Prompt 5)
  forecastEngineMode: ForecastEngineMode;
  setForecastEngineMode: (mode: ForecastEngineMode) => void;
  aiForecastActive: boolean;
  aiPrediction: AIPredictionRow | null;
  modelHealth: ModelHealthStatus;
  modelMetrics: ModelMetricsPayload | null;
  aiUnavailableReason: string | null;
  refreshAIPrediction: () => Promise<void>;
}

const MonsoonContext = createContext<MonsoonContextValue | undefined>(undefined);

export function MonsoonProvider({ children }: { children: React.ReactNode }) {
  const [selectedState, setSelectedState] = useState<string>("Uttar Pradesh");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("Prayagraj");
  const [selectedBlockId, setSelectedBlockIdState] =
    useState<string>("karchhana");
  const [horizon, setHorizonState] = useState<ForecastHorizon>("14D");
  const [selectedRiskType, setSelectedRiskType] =
    useState<RiskFilterType>("false_onset");
  const [selectedCropId, setSelectedCropIdState] = useState<string>("paddy");
  const [selectedStage, setSelectedStage] = useState<string>(
    "Nursery / Pre-sowing"
  );
  const [selectedLanguage, setSelectedLanguage] =
    useState<FarmerLanguage>("Hindi");
  const [demoScenario, setDemoScenarioState] =
    useState<DemoScenarioId>("scenario_b");
  const [demoMode, setDemoModeState] = useState<boolean>(false);
  const [forecastEngineMode, setForecastEngineModeState] =
    useState<ForecastEngineMode>("AI_FORECAST");

  const [readAlertIds, setReadAlertIds] = useState<Record<string, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [simulatedError, setSimulatedError] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // External ingestion states
  const [liveDataActive, setLiveDataActive] = useState<boolean>(false);
  const [usingStoredObservationFallback, setUsingStoredObservationFallback] =
    useState<boolean>(false);
  const [isRefreshingExternalData, setIsRefreshingExternalData] =
    useState<boolean>(false);
  const [simulateExternalOffline, setSimulateExternalOffline] =
    useState<boolean>(false);

  const [ingestedWeather, setIngestedWeather] =
    useState<WeatherObservationRow | null>(null);
  const [ingestedRainfall, setIngestedRainfall] =
    useState<RainfallObservationRow | null>(null);
  const [ingestedRainfallHistory, setIngestedRainfallHistory] = useState<
    RainfallObservationRow[]
  >([]);
  const [ingestedClimate, setIngestedClimate] = useState<
    ClimateIndexObservationRow[]
  >([]);

  const [dataSourceStatuses, setDataSourceStatuses] =
    useState<DataSourceStatusesMap>(() => ({
      weather: getStoredWeatherSourceStatus(),
      rainfall: getStoredRainfallSourceStatus(),
      climate: getStoredClimateSourceStatus(),
    }));

  // Real AI Prediction Engine states
  const [modelHealth, setModelHealth] = useState<ModelHealthStatus>({
    ready_for_ai_forecast: false,
    model_status: "checking",
    dataset_status: "checking",
    model_name: "MonsoonPulse Ensemble",
    model_version: "MPAI-ENS-0.1",
  });
  const [modelMetrics, setModelMetrics] = useState<ModelMetricsPayload | null>(
    null
  );
  const [aiPrediction, setAiPrediction] = useState<AIPredictionRow | null>(null);
  const [aiUnavailableReason, setAiUnavailableReason] = useState<string | null>(
    null
  );

  // Service-backed states
  const [serviceBlocks, setServiceBlocks] = useState<Block[]>(() =>
    getBlocksForScenarioAndHorizon("scenario_b", "14D")
  );
  const [serviceForecast, setServiceForecast] = useState<Forecast>(() =>
    buildForecastForBlock("karchhana", "14D", "scenario_b")
  );
  const [serviceClimate, setServiceClimate] = useState<ClimateIndex[]>(() =>
    getClimateIndicesForScenario("scenario_b")
  );

  const triggerToast = useCallback(
    (
      title: string,
      description: string,
      type: "success" | "info" | "warning" = "success"
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  // Hydrate persisted read alerts & URL query params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = getPersistedReadAlertMap();
    setReadAlertIds(persisted);

    const params = new URLSearchParams(window.location.search);
    const qBlock = params.get("block")?.toLowerCase();
    if (qBlock) {
      setSelectedBlockIdState(qBlock);
    }
    const qHorizon = params.get("horizon")?.toUpperCase();
    if (qHorizon === "7" || qHorizon === "7D") setHorizonState("7D");
    if (qHorizon === "14" || qHorizon === "14D") setHorizonState("14D");
    if (qHorizon === "21" || qHorizon === "21D") setHorizonState("21D");
    if (qHorizon === "30" || qHorizon === "30D") setHorizonState("30D");

    const qRisk = params.get("risk")?.toLowerCase().replace("-", "_");
    if (
      qRisk === "monsoon_onset" ||
      qRisk === "false_onset" ||
      qRisk === "dry_spell" ||
      qRisk === "heavy_rainfall" ||
      qRisk === "rainfall_deficit"
    ) {
      setSelectedRiskType(qRisk);
    }

    const qCrop = params.get("crop")?.toLowerCase();
    if (qCrop && MOCK_CROPS.some((c) => c.id === qCrop)) {
      setSelectedCropIdState(qCrop);
    }
  }, []);

  // Synchronize with Supabase Service Layer whenever Block, Horizon, or Demo Scenario changes
  useEffect(() => {
    let active = true;

    async function syncFromSupabaseServices() {
      const [blocksRes, forecastRes, climateRes, alertsRes] = await Promise.all([
        getBlocks(horizon, demoScenario),
        getForecast(selectedBlockId, horizon, demoScenario),
        getClimateIndices(demoScenario),
        getAlerts(selectedBlockId, horizon, demoScenario),
      ]);

      if (!active) return;
      setServiceBlocks(blocksRes);
      setServiceForecast(forecastRes);
      setServiceClimate(climateRes);

      const mergedReads: Record<string, boolean> = {
        ...getPersistedReadAlertMap(),
      };
      alertsRes.forEach((a) => {
        if (a.read) mergedReads[a.id] = true;
      });
      setReadAlertIds((prev) => ({ ...prev, ...mergedReads }));
    }

    syncFromSupabaseServices();

    return () => {
      active = false;
    };
  }, [selectedBlockId, horizon, demoScenario]);

  // Synchronize Real AI Model Health, Readiness Gate, Evaluation Metrics, and Block x Horizon AI Prediction
  const refreshAIPrediction = useCallback(async () => {
    const [healthRes, metricsRes, predRes] = await Promise.all([
      getModelHealth(),
      getModelMetrics(),
      getAIPrediction(selectedBlockId, horizon),
    ]);

    setModelHealth(healthRes);
    if (metricsRes) {
      setModelMetrics(metricsRes);
    }

    const leakagePassed =
      metricsRes?.sequence_leakage_audit?.overall_leakage_free !== false;
    const integrityPassed =
      metricsRes?.artifact_integrity?.artifact_integrity_passed !== false;

    if (
      healthRes.ready_for_ai_forecast &&
      leakagePassed &&
      integrityPassed &&
      metricsRes &&
      metricsRes.ready &&
      predRes
    ) {
      setAiPrediction(predRes);
      setAiUnavailableReason(null);
    } else {
      setAiPrediction(null);
      setAiUnavailableReason(
        "AI forecast unavailable — using simulated prototype."
      );
      if (forecastEngineMode === "AI_FORECAST") {
        setForecastEngineModeState("SIMULATED");
      }
    }
  }, [selectedBlockId, horizon, forecastEngineMode]);

  useEffect(() => {
    refreshAIPrediction();
  }, [refreshAIPrediction]);

  const setForecastEngineMode = (mode: ForecastEngineMode) => {
    if (mode === "DEMO") {
      setDemoModeState(true);
      setForecastEngineModeState("DEMO");
    } else if (mode === "SIMULATED") {
      setDemoModeState(false);
      setForecastEngineModeState("SIMULATED");
    } else if (mode === "AI_FORECAST") {
      if (
        !modelHealth.ready_for_ai_forecast ||
        !modelMetrics ||
        !aiPrediction
      ) {
        triggerToast(
          "AI Forecast Unavailable",
          "AI forecast unavailable — using simulated prototype.",
          "warning"
        );
        setForecastEngineModeState("SIMULATED");
        return;
      }
      setDemoModeState(false);
      setForecastEngineModeState("AI_FORECAST");
      refreshAIPrediction();
    }
  };

  /**
   * Core ingestion pipeline trigger
   */
  const refreshExternalData = useCallback(
    async (
      target: "all" | "weather" | "rainfall" | "climate" = "all",
      switchToLiveMode = false
    ) => {
      setIsRefreshingExternalData(true);
      if (switchToLiveMode) {
        setDemoModeState(false);
      }

      try {
        const [wRes, rRes, cRes] = await Promise.all([
          target === "all" || target === "weather"
            ? syncWeatherData(selectedBlockId, simulateExternalOffline)
            : Promise.resolve(null),
          target === "all" || target === "rainfall"
            ? syncRainfallData(selectedBlockId, simulateExternalOffline)
            : Promise.resolve(null),
          target === "all" || target === "climate"
            ? syncClimateIndices(simulateExternalOffline)
            : Promise.resolve(null),
        ]);

        if (wRes) {
          if (wRes.observation) setIngestedWeather(wRes.observation);
          setDataSourceStatuses((prev) => ({ ...prev, weather: wRes.status }));
        }
        if (rRes) {
          if (rRes.latestObservation) setIngestedRainfall(rRes.latestObservation);
          if (rRes.history.length > 0) setIngestedRainfallHistory(rRes.history);
          setDataSourceStatuses((prev) => ({ ...prev, rainfall: rRes.status }));
        }
        if (cRes) {
          if (cRes.observations.length > 0) setIngestedClimate(cRes.observations);
          setDataSourceStatuses((prev) => ({ ...prev, climate: cRes.status }));
        }

        const anySucceeded = Boolean(
          wRes?.liveFetchSucceeded ||
            rRes?.liveFetchSucceeded ||
            cRes?.liveFetchSucceeded
        );
        const anyStoredFallback = Boolean(
          wRes?.usedStoredFallback ||
            rRes?.usedStoredFallback ||
            cRes?.usedStoredFallback
        );

        if (anySucceeded) {
          setLiveDataActive(true);
          setUsingStoredObservationFallback(false);
        } else if (anyStoredFallback) {
          setLiveDataActive(false);
          setUsingStoredObservationFallback(true);
          triggerToast(
            "External API Degraded — Using Stored Observation",
            "Live provider unreachable. Loaded latest verified observation from Supabase storage.",
            "warning"
          );
        } else {
          setLiveDataActive(false);
          setUsingStoredObservationFallback(false);
          setDemoModeState(true);
          setForecastEngineModeState("DEMO");
          triggerToast(
            "Fallback to Demo Mode",
            "External provider unreachable and no cached observation found. Activated Simulated Demo Dataset.",
            "warning"
          );
        }
      } finally {
        setIsRefreshingExternalData(false);
      }
    },
    [selectedBlockId, simulateExternalOffline, triggerToast]
  );

  useEffect(() => {
    refreshExternalData("all", false);
  }, [selectedBlockId, simulateExternalOffline, refreshExternalData]);

  const setDemoMode = (val: boolean) => {
    setDemoModeState(val);
    if (val) {
      setForecastEngineModeState("DEMO");
      setLiveDataActive(false);
    } else {
      if (modelHealth.ready_for_ai_forecast && aiPrediction) {
        setForecastEngineModeState("AI_FORECAST");
      } else {
        setForecastEngineModeState("SIMULATED");
      }
      refreshExternalData("all", true);
    }
  };

  const triggerBriefLoading = (message: string, durationMs = 240) => {
    setLoadingMessage(message);
    setTimeout(() => {
      setLoadingMessage(null);
    }, durationMs);
  };

  const setSelectedBlockId = (id: string) => {
    setSelectedBlockIdState(id);
    triggerBriefLoading("Syncing block observations & AI forecast...", 220);
  };

  const setHorizon = (h: ForecastHorizon) => {
    setHorizonState(h);
    triggerBriefLoading("Updating forecast horizon...", 220);
  };

  const setSelectedCropId = (c: string) => {
    setSelectedCropIdState(c);
    const found = MOCK_CROPS.find((item) => item.id === c);
    if (found && found.stages.length > 0) {
      setSelectedStage(found.stages[0]);
    }
    triggerBriefLoading("Loading advisories...", 220);
  };

  const setDemoScenario = (s: DemoScenarioId) => {
    setDemoScenarioState(s);
    triggerBriefLoading("Loading scenario...", 240);
  };

  const retryLoadData = () => {
    setSimulatedError(false);
    triggerBriefLoading("Loading forecast...", 280);
  };

  // Determine whether AI Forecast Mode is genuinely active (Requirement 27)
  const aiForecastActive = Boolean(
    !demoMode &&
      forecastEngineMode === "AI_FORECAST" &&
      modelHealth.ready_for_ai_forecast &&
      modelMetrics?.ready &&
      aiPrediction
  );

  const baseAllBlocks =
    serviceBlocks.length > 0
      ? serviceBlocks
      : getBlocksForScenarioAndHorizon(demoScenario, horizon);

  // When AI Forecast Mode is active, apply the real calibrated ensemble probabilities to the active block
  const allBlocks: Block[] = baseAllBlocks.map((b) => {
    if (aiForecastActive && aiPrediction && b.id === selectedBlockId) {
      const onsetPct = Math.round(aiPrediction.onset_probability * 100);
      const falseOnsetPct = Math.round(
        aiPrediction.false_onset_probability * 100
      );
      const drySpellPct = Math.round(aiPrediction.dry_spell_probability * 100);
      const heavyRainPct = Math.round(
        aiPrediction.heavy_rain_probability * 100
      );
      const expRain = Math.round(aiPrediction.expected_rainfall);
      const anomPct = Math.round(aiPrediction.rainfall_anomaly);

      return {
        ...b,
        onsetProbability: onsetPct,
        falseOnsetProbability: falseOnsetPct,
        falseOnsetRisk: falseOnsetPct,
        drySpellProbability: drySpellPct,
        drySpellRisk: drySpellPct,
        heavyRainProbability: heavyRainPct,
        heavyRainfallRisk: heavyRainPct,
        expectedRainfall: expRain,
        expectedRainfallMm: expRain,
        rainfallAnomaly: anomPct,
        rainfallAnomalyPct: anomPct,
      };
    }
    return b;
  });

  const selectedBlock =
    allBlocks.find((b) => b.id === selectedBlockId) || allBlocks[0];
  const selectedCrop =
    MOCK_CROPS.find((c) => c.id === selectedCropId) || MOCK_CROPS[0];

  const baseForecast =
    serviceForecast &&
    serviceForecast.blockId === selectedBlock.id &&
    serviceForecast.horizon === horizon &&
    serviceForecast.scenario === demoScenario
      ? serviceForecast
      : buildForecastForBlock(selectedBlock.id, horizon, demoScenario);

  const currentForecast: Forecast =
    aiForecastActive && aiPrediction
      ? {
          ...baseForecast,
          onsetProbability: Math.round(aiPrediction.onset_probability * 100),
          falseOnsetRisk: Math.round(
            aiPrediction.false_onset_probability * 100
          ),
          falseOnsetWarningProbability: Math.round(
            aiPrediction.false_onset_probability * 100
          ),
          breakMonsoonRisk: Math.round(
            aiPrediction.dry_spell_probability * 100
          ),
          heavyRainfallRisk: Math.round(
            aiPrediction.heavy_rain_probability * 100
          ),
          expectedRainfallMm: Math.round(aiPrediction.expected_rainfall),
          rainfallAnomalyPct: Math.round(aiPrediction.rainfall_anomaly),
        }
      : baseForecast;

  const defaultDemoClimateIndices =
    serviceClimate.length > 0
      ? serviceClimate
      : getClimateIndicesForScenario(demoScenario);

  const demoRain = Number((selectedBlock.expectedRainfallMm / 14).toFixed(1));
  const demoHumidity = Math.min(
    98,
    Math.max(40, selectedBlock.soilMoisture + 18)
  );
  const demoWeatherObservation: WeatherObservationRow = {
    id: `demo-wobs-${selectedBlock.id}`,
    location_id: selectedBlock.id,
    observation_date: new Date().toISOString().slice(0, 10),
    precipitation_mm: demoRain,
    rainfall_mm: demoRain,
    temperature_c: 33.4,
    humidity: demoHumidity,
    humidity_pct: demoHumidity,
    pressure: 1002.4,
    pressure_hpa: 1002.4,
    wind_speed: 14.2,
    wind_speed_kmh: 14.2,
    source: "Simulated Block Telemetry (Demo Mode)",
    quality_flag: "estimated",
    created_at: new Date().toISOString(),
  };

  const weatherObservation: WeatherObservationRow =
    !demoMode && ingestedWeather && ingestedWeather.location_id === selectedBlock.id
      ? ingestedWeather
      : !demoMode && ingestedWeather
      ? { ...ingestedWeather, location_id: selectedBlock.id }
      : demoWeatherObservation;

  const demoRainfallObservation: RainfallObservationRow = {
    id: `demo-robs-${selectedBlock.id}`,
    location_id: selectedBlock.id,
    observation_date: new Date().toISOString().slice(0, 10),
    rainfall_mm: Number((selectedBlock.expectedRainfallMm / 14).toFixed(1)),
    normal_rainfall_mm: 8.5,
    anomaly_percent: selectedBlock.rainfallAnomaly,
    source: "Simulated IMD Baseline (Demo Mode)",
    quality_flag: "estimated",
    created_at: new Date().toISOString(),
  };

  const rainfallObservation: RainfallObservationRow =
    !demoMode && ingestedRainfall
      ? ingestedRainfall
      : demoRainfallObservation;

  const demoClimateObservations: ClimateIndexObservationRow[] =
    defaultDemoClimateIndices.map((ci) => ({
      id: `demo-cobs-${ci.id.toLowerCase()}`,
      observation_date: new Date().toISOString().slice(0, 10),
      index_name: ci.id,
      index_value:
        ci.amplitude !== undefined
          ? ci.amplitude
          : parseFloat(ci.indexValue.replace(/[^0-9.-]/g, "")) || 0,
      phase: ci.currentPhase,
      source: "Simulated Scenario Baseline (Demo Mode)",
      quality_flag: "estimated",
      created_at: new Date().toISOString(),
    }));

  const climateObservations: ClimateIndexObservationRow[] =
    !demoMode && ingestedClimate.length > 0
      ? ingestedClimate
      : demoClimateObservations;

  const climateIndices: ClimateIndex[] =
    !demoMode && ingestedClimate.length > 0
      ? defaultDemoClimateIndices.map((baseCi) => {
          const realObs = ingestedClimate.find(
            (o) => o.index_name === baseCi.id
          );
          if (!realObs || realObs.index_value === null) return baseCi;
          const formattedVal =
            realObs.index_name === "MJO"
              ? `Amp ${realObs.index_value.toFixed(2)}`
              : `${realObs.index_value >= 0 ? "+" : ""}${realObs.index_value.toFixed(2)} °C`;
          return {
            ...baseCi,
            indexValue: formattedVal,
            amplitude:
              realObs.index_name === "MJO"
                ? realObs.index_value
                : baseCi.amplitude,
            currentPhase: realObs.phase,
          };
        })
      : defaultDemoClimateIndices;

  const currentScenarioMeta =
    DEMO_SCENARIOS.find((s) => s.id === demoScenario) || DEMO_SCENARIOS[1];

  const rawAlerts = generateDynamicAlertsForState(
    selectedBlock,
    allBlocks,
    horizon
  );
  const alerts: Alert[] = rawAlerts.map((a) => ({
    ...a,
    read: Boolean(readAlertIds[a.id]),
  }));

  const markAlertAsRead = async (id: string) => {
    setReadAlertIds((prev) => ({ ...prev, [id]: true }));
    await markAlertReadInDb(id);
  };

  const markAllAlertsAsRead = async () => {
    const ids = alerts.map((a) => a.id);
    const next: Record<string, boolean> = { ...readAlertIds };
    ids.forEach((id) => {
      next[id] = true;
    });
    setReadAlertIds(next);
    await markAllAlertsReadInDb(ids);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <MonsoonContext.Provider
      value={{
        selectedState,
        setSelectedState,
        selectedDistrict,
        setSelectedDistrict,
        selectedBlockId,
        setSelectedBlockId,
        selectedBlock,
        horizon,
        setHorizon,
        selectedRiskType,
        setSelectedRiskType,
        selectedCropId,
        setSelectedCropId,
        selectedCrop,
        selectedStage,
        setSelectedStage,
        selectedLanguage,
        setSelectedLanguage,
        demoScenario,
        setDemoScenario,
        currentScenarioMeta,
        demoScenarios: DEMO_SCENARIOS,
        demoMode,
        setDemoMode,
        isSupabaseConnected: isSupabaseConfigured(),
        currentForecast,
        climateIndices,
        alerts,
        markAlertAsRead,
        markAllAlertsAsRead,
        loadingMessage,
        triggerBriefLoading,
        simulatedError,
        setSimulatedError,
        retryLoadData,
        toasts,
        triggerToast,
        dismissToast,
        allBlocks,
        allCrops: MOCK_CROPS,
        stateDistricts: STATE_DISTRICTS,
        liveDataActive: !demoMode && liveDataActive,
        usingStoredObservationFallback:
          !demoMode && usingStoredObservationFallback,
        weatherObservation,
        rainfallObservation,
        rainfallObservationHistory: ingestedRainfallHistory,
        climateObservations,
        dataSourceStatuses,
        isRefreshingExternalData,
        simulateExternalOffline,
        setSimulateExternalOffline,
        refreshExternalData,
        forecastEngineMode: demoMode ? "DEMO" : forecastEngineMode,
        setForecastEngineMode,
        aiForecastActive,
        aiPrediction,
        modelHealth,
        modelMetrics,
        aiUnavailableReason,
        refreshAIPrediction,
      }}
    >
      {children}
    </MonsoonContext.Provider>
  );
}

export function useMonsoon() {
  const ctx = useContext(MonsoonContext);
  if (!ctx) {
    throw new Error("useMonsoon must be used inside a MonsoonProvider");
  }
  return ctx;
}
