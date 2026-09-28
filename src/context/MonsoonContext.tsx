"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEMO_SCENARIOS,
  MOCK_BLOCKS,
  MOCK_CROPS,
  STATE_DISTRICTS,
  buildForecastForBlock,
  generateDynamicAlertsForState,
  getBlocksForScenarioAndHorizon,
  getClimateIndicesForScenario,
} from "@/data/mockData";
import {
  ALL_LGD_STATES,
  LGD_STATE_DISTRICTS,
  getBlocks,
  getDistrictsForState,
  getStates,
  validateLocationHierarchy,
} from "@/services/locationService";
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
import { isSupabaseConfigured } from "@/lib/supabase";
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

const EMPTY_BLOCK: Block = {
  id: "",
  name: "No Block Selected",
  district: "",
  state: "",
  coordinates: [25.4358, 81.8463],
  polygon: [],
  farmersRegistered: 0,
  cultivatedAreaHa: 0,
  soilType: "N/A",
  irrigationCoverage: 0,
  onsetProbability: 0,
  falseOnsetProbability: 0,
  falseOnsetRisk: 0,
  drySpellProbability: 0,
  drySpellRisk: 0,
  heavyRainProbability: 0,
  heavyRainfallRisk: 0,
  rainfallAnomaly: 0,
  rainfallAnomalyPct: 0,
  expectedRainfall: 0,
  expectedRainfallMm: 0,
  confidence: 0,
  expectedDrySpellDays: "N/A",
  onsetWindow: "N/A",
  soilMoisture: 0,
  riskLevel: "Low",
  mainIssue: "No block data available for this district.",
  recommendedAdvisory: "No advisory available for this district.",
  panchayats: [],
};

const EMPTY_FORECAST: Forecast = {
  ...buildForecastForBlock("karchhana", "14D", "scenario_b"),
  blockId: "",
  blockName: "No Block Selected",
  district: "",
  state: "",
  onsetProbability: 0,
  falseOnsetRisk: 0,
  falseOnsetWarningProbability: 0,
  breakMonsoonRisk: 0,
  heavyRainfallRisk: 0,
  expectedRainfallMm: 0,
  rainfallAnomalyPct: 0,
  confidence: 0,
  soilMoisturePct: 0,
  dailySeries: [],
};

interface MonsoonContextValue {
  selectedState: string;
  setSelectedState: (s: string) => void;
  selectedDistrict: string;
  setSelectedDistrict: (d: string) => void;
  selectedBlockId: string;
  setSelectedBlockId: (id: string) => void;
  selectedBlock: Block;
  availableStates: string[];
  availableDistricts: string[];
  availableBlocks: Block[];
  allBlocks: Block[];
  hasNoBlocksForDistrict: boolean;
  isLoadingDistricts: boolean;
  isLoadingBlocks: boolean;
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
  // Real AI Prediction Engine Layer
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
  const [selectedState, setSelectedStateState] =
    useState<string>("Uttar Pradesh");
  const [selectedDistrict, setSelectedDistrictState] =
    useState<string>("Prayagraj");
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

  const [isLoadingDistricts, setIsLoadingDistricts] = useState<boolean>(false);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState<boolean>(false);

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
    getBlocksForScenarioAndHorizon("scenario_b", "14D").filter(
      (b) => b.state === "Uttar Pradesh" && b.district === "Prayagraj"
    )
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

  const triggerBriefLoading = useCallback(
    (message: string, durationMs = 240) => {
      setLoadingMessage(message);
      setTimeout(() => {
        setLoadingMessage(null);
      }, durationMs);
    },
    []
  );

  // Cascading Location Setters
  const setSelectedState = useCallback(
    async (nextState: string) => {
      const normState = nextState.trim();
      setSelectedStateState(normState);
      setIsLoadingDistricts(true);
      setIsLoadingBlocks(true);

      const districts = LGD_STATE_DISTRICTS[normState] || [];
      const nextDistrict = districts[0] || "";
      setSelectedDistrictState(nextDistrict);

      const blocks = await getBlocks(horizon, demoScenario, nextDistrict, normState);
      if (blocks.length > 0) {
        setSelectedBlockIdState(blocks[0].id);
      } else {
        setSelectedBlockIdState("");
      }

      // Immediately clear stale predictions & observations
      setAiPrediction(null);
      setIngestedWeather(null);
      setIngestedRainfall(null);
      setIsLoadingDistricts(false);
      setIsLoadingBlocks(false);
      triggerBriefLoading("Updating state and districts...", 240);
    },
    [horizon, demoScenario, triggerBriefLoading]
  );

  const setSelectedDistrict = useCallback(
    async (nextDistrict: string) => {
      const normDistrict = nextDistrict.trim();
      setSelectedDistrictState(normDistrict);
      setIsLoadingBlocks(true);

      // Validate hierarchy in dev
      validateLocationHierarchy(selectedState, normDistrict);

      const blocks = await getBlocks(horizon, demoScenario, normDistrict, selectedState);
      if (blocks.length > 0) {
        setSelectedBlockIdState(blocks[0].id);
      } else {
        setSelectedBlockIdState("");
      }

      // Clear stale predictions & observations from previous district
      setAiPrediction(null);
      setIngestedWeather(null);
      setIngestedRainfall(null);
      setIsLoadingBlocks(false);
      triggerBriefLoading("Syncing district blocks...", 240);
    },
    [selectedState, horizon, demoScenario, triggerBriefLoading]
  );

  const setSelectedBlockId = useCallback(
    (id: string) => {
      if (!id || id.trim() === "") {
        setSelectedBlockIdState("");
        setAiPrediction(null);
        return;
      }

      const normId = id.trim().toLowerCase();
      const validation = validateLocationHierarchy(
        selectedState,
        selectedDistrict,
        normId
      );

      if (!validation.valid) {
        console.warn(
          `Cannot select block "${normId}": does not belong to ${selectedDistrict}, ${selectedState}`
        );
        setSelectedBlockIdState("");
        setAiPrediction(null);
        return;
      }

      setSelectedBlockIdState(normId);
      triggerBriefLoading("Syncing block observations & AI forecast...", 220);
    },
    [selectedState, selectedDistrict, triggerBriefLoading]
  );

  // Hydrate persisted read alerts & URL query params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = getPersistedReadAlertMap();
    setReadAlertIds(persisted);

    const params = new URLSearchParams(window.location.search);
    const qState = params.get("state");
    const qDistrict = params.get("district");
    const qBlock = params.get("block")?.toLowerCase();

    let targetState = "Uttar Pradesh";
    if (qState && LGD_STATE_DISTRICTS[qState]) {
      targetState = qState;
      setSelectedStateState(targetState);
    }

    const validDistricts = LGD_STATE_DISTRICTS[targetState] || [];
    let targetDistrict = validDistricts[0] || "Prayagraj";
    if (qDistrict && validDistricts.includes(qDistrict)) {
      targetDistrict = qDistrict;
      setSelectedDistrictState(targetDistrict);
    }

    if (qBlock) {
      // Validate that qBlock genuinely belongs to targetDistrict and targetState
      const validation = validateLocationHierarchy(
        targetState,
        targetDistrict,
        qBlock
      );
      if (validation.valid) {
        setSelectedBlockIdState(qBlock);
      }
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

  // Synchronize with Supabase Service Layer whenever District, Block, Horizon, or Scenario changes
  useEffect(() => {
    let active = true;

    async function syncFromSupabaseServices() {
      setIsLoadingBlocks(true);
      const [blocksRes, forecastRes, climateRes, alertsRes] =
        await Promise.all([
          getBlocks(horizon, demoScenario, selectedDistrict, selectedState),
          selectedBlockId
            ? getForecast(selectedBlockId, horizon, demoScenario)
            : Promise.resolve({
                ...EMPTY_FORECAST,
                district: selectedDistrict,
                state: selectedState,
              }),
          getClimateIndices(demoScenario),
          selectedBlockId
            ? getAlerts(selectedBlockId, horizon, demoScenario)
            : Promise.resolve([]),
        ]);

      if (!active) return;
      setServiceBlocks(blocksRes);
      setServiceForecast(forecastRes);
      setServiceClimate(climateRes);
      setIsLoadingBlocks(false);

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
  }, [selectedState, selectedDistrict, selectedBlockId, horizon, demoScenario]);

  // Synchronize Real AI Model Health, Readiness Gate, Evaluation Metrics, and Block x Horizon AI Prediction
  const refreshAIPrediction = useCallback(async () => {
    if (!selectedBlockId) {
      setAiPrediction(null);
      setAiUnavailableReason("No block selected for this district.");
      return;
    }

    const isPrayagraj = selectedDistrict.toLowerCase() === "prayagraj";
    const activeBlockDataCoverage = serviceBlocks.find((b) => b.id === selectedBlockId)?.dataCoverage;
    const isFullCoverage = isPrayagraj || activeBlockDataCoverage === "FULL";

    if (!isFullCoverage) {
      setAiPrediction(null);
      setAiUnavailableReason("AI forecast unavailable for this location");
      if (forecastEngineMode === "AI_FORECAST") {
        setForecastEngineModeState("SIMULATED");
      }
      return;
    }

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
  }, [selectedBlockId, serviceBlocks, selectedDistrict, horizon, forecastEngineMode]);

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
      const isPrayagraj = selectedDistrict.toLowerCase() === "prayagraj";
      const activeBlockDataCoverage = serviceBlocks.find((b) => b.id === selectedBlockId)?.dataCoverage;
      const isFullCoverage = isPrayagraj || activeBlockDataCoverage === "FULL";
      if (!isFullCoverage) {
        triggerToast(
          "AI Forecast Unavailable",
          "AI forecast unavailable for this location",
          "warning"
        );
        setForecastEngineModeState("SIMULATED");
        return;
      }
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
      if (!selectedBlockId) {
        setIngestedWeather(null);
        setIngestedRainfall(null);
        return;
      }

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
          if (rRes.latestObservation)
            setIngestedRainfall(rRes.latestObservation);
          if (rRes.history.length > 0)
            setIngestedRainfallHistory(rRes.history);
          setDataSourceStatuses((prev) => ({ ...prev, rainfall: rRes.status }));
        }
        if (cRes) {
          if (cRes.observations.length > 0)
            setIngestedClimate(cRes.observations);
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

  // Determine whether AI Forecast Mode is genuinely active
  const aiForecastActive = Boolean(
    !demoMode &&
      forecastEngineMode === "AI_FORECAST" &&
      modelHealth.ready_for_ai_forecast &&
      modelMetrics?.ready &&
      aiPrediction
  );

  // BASE BLOCKS: Strictly filtered by selectedState and selectedDistrict
  // Never returns blocks belonging to District A when District B is selected
  const districtFilteredBase: Block[] = useMemo(() => {
    // 1. If serviceBlocks is loaded from locationService with district filter
    const validServiceBlocks = serviceBlocks.filter(
      (b) =>
        b.state.toLowerCase() === selectedState.toLowerCase() &&
        b.district.toLowerCase() === selectedDistrict.toLowerCase()
    );
    if (validServiceBlocks.length > 0) {
      return validServiceBlocks;
    }

    // 2. Fallback scenario blocks filtered strictly for Prayagraj
    if (selectedDistrict.toLowerCase() === "prayagraj") {
      const scenarioBlocks = getBlocksForScenarioAndHorizon(
        demoScenario,
        horizon
      );
      return scenarioBlocks.filter(
        (b) =>
          b.state.toLowerCase() === selectedState.toLowerCase() &&
          b.district.toLowerCase() === selectedDistrict.toLowerCase()
      );
    }
    return [];
  }, [serviceBlocks, selectedState, selectedDistrict, demoScenario, horizon]);

  // When AI Forecast Mode is active, apply real calibrated ensemble probabilities to the active block
  const allBlocks: Block[] = useMemo(() => {
    return districtFilteredBase.map((b) => {
      if (aiForecastActive && aiPrediction && b.id === selectedBlockId) {
        const onsetPct = Math.round(aiPrediction.onset_probability * 100);
        const falseOnsetPct = Math.round(
          aiPrediction.false_onset_probability * 100
        );
        const drySpellPct = Math.round(
          aiPrediction.dry_spell_probability * 100
        );
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
  }, [districtFilteredBase, aiForecastActive, aiPrediction, selectedBlockId]);

  const hasNoBlocksForDistrict = allBlocks.length === 0;

  const selectedBlock: Block = useMemo(() => {
    if (hasNoBlocksForDistrict) {
      return {
        ...EMPTY_BLOCK,
        district: selectedDistrict,
        state: selectedState,
        name: `No blocks in ${selectedDistrict}`,
      };
    }
    return (
      allBlocks.find((b) => b.id === selectedBlockId) || allBlocks[0]
    );
  }, [allBlocks, hasNoBlocksForDistrict, selectedBlockId, selectedDistrict, selectedState]);

  const selectedCrop =
    MOCK_CROPS.find((c) => c.id === selectedCropId) || MOCK_CROPS[0];

  const baseForecast: Forecast = useMemo(() => {
    if (hasNoBlocksForDistrict || !selectedBlock.id) {
      return {
        ...EMPTY_FORECAST,
        district: selectedDistrict,
        state: selectedState,
      };
    }
    const isPrayagraj = selectedDistrict.toLowerCase() === "prayagraj";
    if (!isPrayagraj && selectedBlock.dataCoverage !== "FULL") {
      return {
        ...EMPTY_FORECAST,
        blockId: selectedBlock.id,
        blockName: selectedBlock.name,
        district: selectedDistrict,
        state: selectedState,
        mainIssue: "AI forecast unavailable for this location",
        recommendedAdvisory: "AI forecast unavailable for this location",
      };
    }
    return serviceForecast &&
      serviceForecast.blockId === selectedBlock.id &&
      serviceForecast.horizon === horizon &&
      serviceForecast.scenario === demoScenario
      ? serviceForecast
      : buildForecastForBlock(selectedBlock.id, horizon, demoScenario);
  }, [
    hasNoBlocksForDistrict,
    selectedBlock.id,
    selectedBlock.name,
    selectedBlock.dataCoverage,
    selectedDistrict,
    selectedState,
    serviceForecast,
    horizon,
    demoScenario,
  ]);

  const currentForecast: Forecast = useMemo(() => {
    if (hasNoBlocksForDistrict || !selectedBlock.id) {
      return {
        ...EMPTY_FORECAST,
        district: selectedDistrict,
        state: selectedState,
      };
    }
    if (aiForecastActive && aiPrediction) {
      return {
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
      };
    }
    return baseForecast;
  }, [
    hasNoBlocksForDistrict,
    selectedBlock.id,
    selectedDistrict,
    selectedState,
    aiForecastActive,
    aiPrediction,
    baseForecast,
  ]);

  const defaultDemoClimateIndices =
    serviceClimate.length > 0
      ? serviceClimate
      : getClimateIndicesForScenario(demoScenario);

  const demoRain = selectedBlock.expectedRainfallMm
    ? Number((selectedBlock.expectedRainfallMm / 14).toFixed(1))
    : 0;
  const demoHumidity = Math.min(
    98,
    Math.max(40, selectedBlock.soilMoisture + 18)
  );

  const isPrayagraj = selectedDistrict.toLowerCase() === "prayagraj";
  const isFullData = isPrayagraj || selectedBlock.dataCoverage === "FULL";

  const demoWeatherObservation: WeatherObservationRow = {
    id: `demo-wobs-${selectedBlock.id || "none"}`,
    location_id: selectedBlock.id || "",
    observation_date: new Date().toISOString().slice(0, 10),
    precipitation_mm: hasNoBlocksForDistrict || !isFullData ? null : demoRain,
    rainfall_mm: hasNoBlocksForDistrict || !isFullData ? null : demoRain,
    temperature_c: hasNoBlocksForDistrict || !isFullData ? null : 33.4,
    humidity: hasNoBlocksForDistrict || !isFullData ? null : demoHumidity,
    humidity_pct: hasNoBlocksForDistrict || !isFullData ? null : demoHumidity,
    pressure: hasNoBlocksForDistrict || !isFullData ? null : 1002.4,
    pressure_hpa: hasNoBlocksForDistrict || !isFullData ? null : 1002.4,
    wind_speed: hasNoBlocksForDistrict || !isFullData ? null : 14.2,
    wind_speed_kmh: hasNoBlocksForDistrict || !isFullData ? null : 14.2,
    source:
      hasNoBlocksForDistrict || !isFullData
        ? "Weather data unavailable"
        : "Simulated Block Telemetry (Demo Mode)",
    quality_flag: hasNoBlocksForDistrict || !isFullData ? "missing" : "estimated",
    created_at: new Date().toISOString(),
  };

  const weatherObservation: WeatherObservationRow =
    !demoMode && isFullData && ingestedWeather && ingestedWeather.location_id === selectedBlock.id
      ? ingestedWeather
      : !demoMode && isFullData && ingestedWeather && selectedBlock.id
      ? { ...ingestedWeather, location_id: selectedBlock.id }
      : demoWeatherObservation;

  const demoRainfallObservation: RainfallObservationRow = {
    id: `demo-robs-${selectedBlock.id || "none"}`,
    location_id: selectedBlock.id || "",
    observation_date: new Date().toISOString().slice(0, 10),
    rainfall_mm:
      hasNoBlocksForDistrict || !isFullData
        ? null
        : Number((selectedBlock.expectedRainfallMm / 14).toFixed(1)),
    normal_rainfall_mm: hasNoBlocksForDistrict || !isFullData ? null : 8.5,
    anomaly_percent: hasNoBlocksForDistrict || !isFullData ? null : selectedBlock.rainfallAnomaly,
    source:
      hasNoBlocksForDistrict || !isFullData
        ? "Weather data unavailable"
        : "Simulated IMD Baseline (Demo Mode)",
    quality_flag: hasNoBlocksForDistrict || !isFullData ? "missing" : "estimated",
    created_at: new Date().toISOString(),
  };

  const rainfallObservation: RainfallObservationRow =
    !demoMode && isFullData && ingestedRainfall && selectedBlock.id
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

  const rawAlerts =
    !hasNoBlocksForDistrict && selectedBlock.id
      ? generateDynamicAlertsForState(selectedBlock, allBlocks, horizon)
      : [];

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

  const availableStates = ALL_LGD_STATES;
  const availableDistricts = useMemo(
    () => LGD_STATE_DISTRICTS[selectedState] || [],
    [selectedState]
  );

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
        availableStates,
        availableDistricts,
        availableBlocks: allBlocks,
        allBlocks,
        hasNoBlocksForDistrict,
        isLoadingDistricts,
        isLoadingBlocks,
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
        allCrops: MOCK_CROPS,
        stateDistricts: LGD_STATE_DISTRICTS,
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
