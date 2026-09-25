"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
  Sprout,
  X,
} from "lucide-react";
import { useMonsoon } from "@/context/MonsoonContext";
import { MOCK_FARMERS } from "@/data/mockData";
import { generateFarmerMessage } from "@/services/monsoonService";
import {
  StoredFarmerMessage,
  getFarmerMessages,
  recordFarmerMessageInDb,
} from "@/services/farmerMessageService";
import { evaluateCropAdvisories } from "@/services/advisoryEngine";
import { CROP_PROFILES } from "@/config/advisoryRules";
import { AdvisorySourceMode, SupportedCropId } from "@/types/advisory";
import { fetchGISBlockIntelligence } from "@/services/gisService";
import { BlockSpatialIntelligence } from "@/types/gis";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";
import OfficerAlertCenterAndFarmerHub from "@/components/communication/OfficerAlertCenterAndFarmerHub";

type ChannelType = "WhatsApp" | "SMS" | "Mobile App";

const HORIZON_DAYS_MAP: Record<ForecastHorizon, number> = {
  "7D": 7,
  "14D": 14,
  "21D": 21,
  "30D": 30,
};

export default function FarmerCommunicationPage() {
  const {
    selectedBlock,
    selectedBlockId,
    setSelectedBlockId,
    selectedCrop,
    selectedCropId,
    setSelectedCropId,
    selectedLanguage,
    setSelectedLanguage,
    horizon,
    setHorizon,
    demoScenario,
    forecastEngineMode,
    allBlocks,
    allCrops,
    triggerBriefLoading,
    triggerToast,
  } = useMonsoon();

  const [activeChannel, setActiveChannel] = useState<ChannelType>("WhatsApp");
  const [sendingState, setSendingState] = useState<"idle" | "sms" | "whatsapp">(
    "idle"
  );
  const [showWhyDrawer, setShowWhyDrawer] = useState<boolean>(false);
  const [spatialBlock, setSpatialBlock] =
    useState<BlockSpatialIntelligence | null>(null);

  const [confirmationModal, setConfirmationModal] = useState<{
    open: boolean;
    channel: ChannelType;
    dispatchId: string;
    blockName: string;
    cropName: string;
    language: FarmerLanguage;
    status: "simulated";
    recipientsCount: number;
    messageText: string;
  } | null>(null);

  const [dispatchLogs, setDispatchLogs] = useState<StoredFarmerMessage[]>([]);

  // Load persisted farmer_messages on mount
  useEffect(() => {
    let mounted = true;
    getFarmerMessages().then((rows) => {
      if (mounted) setDispatchLogs(rows);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Load block spatial intelligence for "Your Farm Outlook"
  useEffect(() => {
    let mounted = true;
    fetchGISBlockIntelligence({
      horizon,
      engineMode: forecastEngineMode,
      scenario: demoScenario,
    }).then((res) => {
      if (!mounted || !res?.blocks) return;
      const found =
        res.blocks.find((b) => b.block_id === selectedBlockId) || null;
      setSpatialBlock(found);
    });
    return () => {
      mounted = false;
    };
  }, [horizon, forecastEngineMode, demoScenario, selectedBlockId]);

  const horizonDays = HORIZON_DAYS_MAP[horizon] as 7 | 14 | 21 | 30;
  const advisoryMode: AdvisorySourceMode =
    forecastEngineMode === "AI_FORECAST"
      ? "AI"
      : forecastEngineMode === "SIMULATED"
      ? "SIMULATED"
      : "DEMO";
  const cropIdTyped = (
    CROP_PROFILES[selectedCropId as SupportedCropId] ? selectedCropId : "paddy"
  ) as SupportedCropId;

  const farmOutlookBundle = useMemo(() => {
    const pred = spatialBlock?.prediction;
    const obs = spatialBlock?.observation;

    return evaluateCropAdvisories({
      location_id: selectedBlockId,
      block_name: selectedBlock.name,
      district: selectedBlock.district,
      state: selectedBlock.state,
      crop_id: cropIdTyped,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      crop_stage: "pre_sowing",
      current_rainfall: obs?.rainfall_mm ?? 21.4,
      recent_rainfall: obs?.cumulative_7d_rain_mm ?? 58.0,
      rainfall_anomaly:
        advisoryMode === "AI" && pred?.rainfall_anomaly_pct !== null && pred?.rainfall_anomaly_pct !== undefined
          ? pred.rainfall_anomaly_pct
          : selectedBlock.rainfallAnomaly,
      temperature: obs?.temperature_c ?? 29.5,
      humidity: obs?.humidity_pct ?? 82.0,
      soil_moisture: advisoryMode === "AI" ? null : selectedBlock.soilMoisture,
      onset_probability:
        advisoryMode === "AI" && pred?.onset_probability !== null && pred?.onset_probability !== undefined
          ? pred.onset_probability
          : selectedBlock.onsetProbability / 100.0,
      false_onset_probability:
        advisoryMode === "AI" && pred?.false_onset_probability !== null && pred?.false_onset_probability !== undefined
          ? pred.false_onset_probability
          : selectedBlock.falseOnsetProbability / 100.0,
      dry_spell_probability:
        advisoryMode === "AI" && pred?.dry_spell_probability !== null && pred?.dry_spell_probability !== undefined
          ? pred.dry_spell_probability
          : selectedBlock.drySpellProbability / 100.0,
      heavy_rain_probability:
        advisoryMode === "AI" && pred?.heavy_rain_probability !== null && pred?.heavy_rain_probability !== undefined
          ? pred.heavy_rain_probability
          : selectedBlock.heavyRainProbability / 100.0,
      expected_rainfall:
        advisoryMode === "AI" && pred?.expected_rainfall_mm !== null && pred?.expected_rainfall_mm !== undefined
          ? pred.expected_rainfall_mm
          : selectedBlock.expectedRainfall,
      model_version:
        advisoryMode === "AI"
          ? pred?.model_version || "MPAI-ENS-0.1"
          : advisoryMode === "SIMULATED"
          ? "SIM-PROTO-v1"
          : "DEMO-SCENARIO-v1",
      observation_cutoff:
        pred?.observation_cutoff || obs?.observation_timestamp || "2025-08-31",
      source_mode: advisoryMode,
    });
  }, [
    spatialBlock,
    selectedBlockId,
    selectedBlock,
    cropIdTyped,
    horizon,
    horizonDays,
    advisoryMode,
  ]);

  const generatedMessages = generateFarmerMessage({
    blockName: selectedBlock.name,
    cropName: selectedCrop.name,
    drySpellProbability: selectedBlock.drySpellProbability,
    falseOnsetProbability: selectedBlock.falseOnsetProbability,
    heavyRainProbability: selectedBlock.heavyRainProbability,
    horizonDays,
    delayDays: "5–7",
  });

  const activeMessageText =
    selectedLanguage === "Hindi"
      ? generatedMessages.hindi
      : generatedMessages.english;

  const handleGenerateAdvisory = () => {
    triggerBriefLoading("Generating farmer message...", 240);
    triggerToast(
      `Generated ${selectedLanguage} Farmer Message`,
      `Retrieved database-backed ${horizon} forecast & advisory for ${selectedBlock.name} (${selectedCrop.name}).`
    );
  };

  const handleDispatch = async (channel: "SMS" | "WhatsApp") => {
    setSendingState(channel === "SMS" ? "sms" : "whatsapp");
    triggerBriefLoading("Generating farmer message...", 260);

    const savedRow = await recordFarmerMessageInDb({
      locationId: selectedBlock.id,
      blockName: selectedBlock.name,
      cropId: selectedCrop.id,
      cropName: selectedCrop.name,
      language: selectedLanguage,
      channel,
      horizon,
      farmersReached: selectedBlock.farmersRegistered,
      message: activeMessageText,
    });

    setSendingState("idle");
    setDispatchLogs((prev) => [savedRow, ...prev]);

    setConfirmationModal({
      open: true,
      channel,
      dispatchId: savedRow.id,
      blockName: selectedBlock.name,
      cropName: selectedCrop.name,
      language: selectedLanguage,
      status: "simulated",
      recipientsCount: selectedBlock.farmersRegistered,
      messageText: activeMessageText,
    });

    triggerToast(
      "Prototype message queued successfully.",
      `Stored in farmer_messages (status = simulated) for ${selectedBlock.name} (${selectedCrop.name}).`
    );
  };

  const isHindi = selectedLanguage === "Hindi";

  return (
    <div className="space-y-6">
      {/* 1. SECTION 19: FARMER-FRIENDLY "YOUR FARM OUTLOOK" DASHBOARD */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft overflow-hidden">
        <div className="bg-gradient-to-r from-[#0B3B24] to-emerald-900 text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-emerald-400 text-[#0B3B24] text-[10px] font-extrabold uppercase">
                SECTION 19 • YOUR FARM OUTLOOK
              </span>
              <span className="px-2.5 py-0.5 rounded bg-white/15 text-emerald-200 text-[10px] font-bold">
                Source: {farmOutlookBundle.source_mode}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">
              {isHindi
                ? `आपकी खेती का दृष्टिकोण — ${selectedBlock.name} (${selectedCrop.hindiName})`
                : `Your Farm Outlook — ${selectedBlock.name} (${selectedCrop.name})`}
            </h2>
            <p className="text-xs text-emerald-100/90">
              {isHindi
                ? "बिना किसी जटिल तकनीकी शब्द (XGBoost/LSTM) के, आपकी फसल और विकासखंड के लिए सरल कृषि सलाह।"
                : "Plain-language sowing, water, heavy-rain, and dry-spell guidance tailored to your block and crop."}
            </p>
          </div>

          {/* Quick Horizon & Language Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/20 text-xs">
              <button
                onClick={() => setHorizon("7D")}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                  horizon === "7D"
                    ? "bg-emerald-400 text-[#0B3B24]"
                    : "text-emerald-100 hover:text-white"
                }`}
              >
                {isHindi ? "अगले 7 दिन (Next 7 days)" : "Next 7 days"}
              </button>
              <button
                onClick={() => setHorizon("14D")}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                  horizon === "14D"
                    ? "bg-emerald-400 text-[#0B3B24]"
                    : "text-emerald-100 hover:text-white"
                }`}
              >
                {isHindi ? "अगले 14 दिन (Next 14 days)" : "Next 14 days"}
              </button>
            </div>

            <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/20 text-xs">
              {(["English", "Hindi"] as FarmerLanguage[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-2.5 py-1.5 rounded-lg font-extrabold transition ${
                    selectedLanguage === lang
                      ? "bg-white text-[#0B3B24]"
                      : "text-emerald-100 hover:text-white"
                  }`}
                >
                  {lang === "Hindi" ? "हिन्दी" : "English"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4-Pillar Farmer Cards: 🌱 Sowing | 💧 Water | 🌧️ Heavy Rain | ☀️ Dry Spell */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {farmOutlookBundle.farmer_outlook_cards.map((card) => {
              const sevColor =
                card.severity === "CRITICAL" || card.severity === "HIGH"
                  ? "border-amber-300 bg-amber-50/70"
                  : card.severity === "MODERATE"
                  ? "border-sky-200 bg-sky-50/60"
                  : "border-emerald-200 bg-emerald-50/60";

              return (
                <div
                  key={card.pillar_id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 ${sevColor}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span className="text-xl">{card.icon_emoji}</span>
                        <span>{isHindi ? card.title_hi : card.title_en}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-extrabold">
                        {card.severity}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs space-y-1">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                        Risk (जोखिम)
                      </span>
                      <p className="font-extrabold text-slate-900">
                        {isHindi ? card.risk_label_hi : card.risk_label_en}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs space-y-1">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                        Reason (कारण)
                      </span>
                      <p className="text-slate-700 font-medium">
                        {isHindi ? card.reason_hi : card.reason_en}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#0B3B24] text-white text-xs space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-300 block">
                      Action (क्या करें)
                    </span>
                    <p className="font-bold leading-relaxed">
                      {isHindi ? card.action_hi : card.action_en}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapsible "Why this prediction?" Technical Traceability Drawer (Section 19) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowWhyDrawer((prev) => !prev)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-extrabold text-slate-800 transition"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                <span>
                  {isHindi
                    ? "यह सलाह क्यों दी गई है? (Why this prediction? — तकनीकी साक्ष्य एवं मॉडल विवरण)"
                    : "Why this prediction? (Expand Technical Model & Rule Evidence Basis)"}
                </span>
              </span>
              {showWhyDrawer ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showWhyDrawer && (
              <div className="p-4 bg-slate-950 text-slate-200 text-xs space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                      Model &amp; Source Mode
                    </span>
                    <p className="font-bold text-white mt-0.5">
                      {farmOutlookBundle.model_version} (Mode:{" "}
                      {farmOutlookBundle.source_mode})
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Observation cutoff: {farmOutlookBundle.observation_cutoff}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-sky-400 block">
                      Matched Deterministic Rule IDs
                    </span>
                    <p className="font-mono font-bold text-white mt-0.5">
                      {farmOutlookBundle.active_advisories
                        .map((a) => a.rule_id)
                        .join(", ")}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Soil Moisture:{" "}
                      {farmOutlookBundle.soil_moisture_status_en}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-amber-400 block">
                      Evidence Basis Summary
                    </span>
                    <p className="text-[11px] text-slate-200 mt-0.5">
                      {farmOutlookBundle.active_advisories[0]?.evidence
                        .summary_en || "Deterministic rule evaluation."}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-amber-300/90">
                  {farmOutlookBundle.scientific_disclaimer_en}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. EXISTING FARMER COMMUNICATION & SUPABASE `farmer_messages` CENTER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900">
              <MessageCircle className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Supabase `farmer_messages` Integration
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase">
              status = simulated
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Farmer Communication Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Generates Hindi &amp; English messages from database-backed forecast
            &amp; advisory values and stores dispatches in{" "}
            <code>farmer_messages</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleGenerateAdvisory}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Generate Advisory
          </button>
          <button
            onClick={() => handleDispatch("SMS")}
            disabled={sendingState !== "idle"}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-60"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {sendingState === "sms" ? "Queueing SMS..." : "Send SMS"}
          </button>
          <button
            onClick={() => handleDispatch("WhatsApp")}
            disabled={sendingState !== "idle"}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs transition disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {sendingState === "whatsapp"
              ? "Queueing WhatsApp..."
              : "Send WhatsApp"}
          </button>
        </div>
      </div>

      {/* CHANNEL & INPUT CONFIGURATION BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              1. Configure Broadcast Inputs
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Block (location_id)
                </label>
                <select
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs font-extrabold text-emerald-950"
                >
                  {allBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.drySpellProbability}% dry risk)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Crop (crop_id)
                </label>
                <select
                  value={selectedCropId}
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs font-extrabold text-emerald-950"
                >
                  {allCrops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) =>
                    setSelectedLanguage(e.target.value as FarmerLanguage)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="Hindi">Hindi (हिन्दी)</option>
                  <option value="English">English</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Forecast Horizon
                </label>
                <select
                  value={horizon}
                  onChange={(e) =>
                    setHorizon(e.target.value as ForecastHorizon)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="7D">7D (7 days)</option>
                  <option value="14D">14D (14 days)</option>
                  <option value="21D">21D (21 days)</option>
                  <option value="30D">30D (30 days)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                Delivery Channel
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      id: "WhatsApp",
                      label: "WhatsApp",
                      sub: "Rich Bulletin",
                      icon: MessageCircle,
                    },
                    {
                      id: "SMS",
                      label: "SMS",
                      sub: "2G / Text",
                      icon: MessageSquare,
                    },
                    {
                      id: "Mobile App",
                      label: "Mobile App",
                      sub: "Push Alert",
                      icon: Smartphone,
                    },
                  ] as const
                ).map((ch) => {
                  const Icon = ch.icon;
                  const active = activeChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannel(ch.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? "bg-[#0B3B24] text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mb-1.5 ${
                          active ? "text-emerald-400" : "text-slate-500"
                        }`}
                      />
                      <span className="font-bold text-xs block">{ch.label}</span>
                      <span
                        className={`text-[10px] block ${
                          active ? "text-emerald-200" : "text-slate-500"
                        }`}
                      >
                        {ch.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-700" />
                farmer_messages Records ({dispatchLogs.length})
              </h3>
              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                status = simulated
              </span>
            </div>
            <div className="space-y-2.5 max-h-[270px] overflow-y-auto pr-1">
              {dispatchLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        {log.block_name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                        {log.channel} • {log.language}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      status: {log.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    {log.message.replace(/\n+/g, " ")}
                  </p>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>
                      ID: {log.id} • crop_id: {log.crop_id}
                    </span>
                    <span>{log.timestamp_label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-soft p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Database-Backed Message Generator ({selectedLanguage} Selected)
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                {selectedBlock.name} • {selectedCrop.name} • Next {horizonDays}{" "}
                Days
              </h2>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(["Hindi", "English"] as FarmerLanguage[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    selectedLanguage === lang
                      ? "bg-[#0B3B24] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {lang === "Hindi" ? "हिन्दी (Hindi)" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              className={`rounded-2xl p-5 flex flex-col justify-between space-y-4 transition ${
                selectedLanguage === "Hindi"
                  ? "bg-[#ECFDF5] border-2 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                  : "bg-[#ECFDF5]/60 border border-emerald-300 opacity-85"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                  <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Hindi (हिन्दी) — {activeChannel}
                  </span>
                  {selectedLanguage === "Hindi" && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600 text-white">
                      Selected Language
                    </span>
                  )}
                </div>

                <div className="bg-white rounded-xl p-4 border border-emerald-200/90 text-slate-900 text-sm leading-relaxed whitespace-pre-line font-medium shadow-2xs">
                  {generatedMessages.hindi}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedLanguage("Hindi");
                  handleDispatch("WhatsApp");
                }}
                className="w-full py-2.5 rounded-xl bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                Send WhatsApp (Hindi)
              </button>
            </div>

            <div
              className={`rounded-2xl p-5 flex flex-col justify-between space-y-4 transition ${
                selectedLanguage === "English"
                  ? "bg-sky-50 border-2 border-sky-500 ring-2 ring-sky-500/20 shadow-md"
                  : "bg-sky-50/60 border border-sky-200 opacity-85"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-sky-200 pb-2.5">
                  <span className="text-xs font-extrabold text-sky-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                    English — {activeChannel}
                  </span>
                  {selectedLanguage === "English" && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-sky-600 text-white">
                      Selected Language
                    </span>
                  )}
                </div>

                <div className="bg-white rounded-xl p-4 border border-sky-200/90 text-slate-900 text-sm leading-relaxed whitespace-pre-line font-medium shadow-2xs">
                  {generatedMessages.english}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedLanguage("English");
                  handleDispatch("SMS");
                }}
                className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send SMS (English)
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered Farmer Recipients ({selectedBlock.name} &amp; Prayagraj
              Cluster)
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-bold uppercase">
                    <th className="py-2.5 px-3">Farmer</th>
                    <th className="py-2.5 px-3">Block &amp; Panchayat</th>
                    <th className="py-2.5 px-3">Crop</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {MOCK_FARMERS.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {f.name}{" "}
                        <span className="text-slate-500 font-normal block text-[11px]">
                          {f.hindiName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {f.blockName} • {f.panchayatName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-800">
                        {f.primaryCrop}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                          {f.preferredChannel} ({f.preferredLanguage})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                        ✓ Subscribed
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <OfficerAlertCenterAndFarmerHub
        selectedBlockId={selectedBlockId}
        selectedBlockName={selectedBlock.name}
        selectedCropId={selectedCropId}
        horizon={horizon}
      />

      {confirmationModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-emerald-300 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    farmer_messages • status = simulated
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    Prototype message queued successfully.
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setConfirmationModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Record ID:</span>
                <span className="font-mono font-bold text-slate-900">
                  {confirmationModal.dispatchId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Database Table &amp; Status:</span>
                <span className="font-mono font-bold text-emerald-800">
                  farmer_messages (status = &quot;simulated&quot;)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location &amp; Crop:</span>
                <span className="font-bold text-slate-800">
                  {confirmationModal.blockName} • {confirmationModal.cropName} (
                  {confirmationModal.language})
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs whitespace-pre-line font-medium text-slate-900 max-h-48 overflow-y-auto">
              {confirmationModal.messageText}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmationModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-extrabold transition"
              >
                Done — Persisted in farmer_messages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
