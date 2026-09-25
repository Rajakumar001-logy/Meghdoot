"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Eye,
  Filter,
  HelpCircle,
  Lock,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserCheck,
  X,
} from "lucide-react";
import {
  AlertDeliveryLogRecord,
  AlertLifecycleStatus,
  AlertPriorityLevel,
  CommunicationAlertRecord,
  CommunicationChannel,
  FarmerCommunicationProfile,
  FarmerResponseOption,
} from "@/types/communication";
import {
  BulkAlertPreviewSummary,
  dispatchSingleAlert,
  getCommunicationAlertById,
  getRegisteredFarmers,
  listCommunicationAlerts,
  markCommunicationAlertRead,
  previewBulkAlertOperation,
  retryCommunicationAlert,
  updateFarmerConsentPreference,
} from "@/services/communicationEngine";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";

interface OfficerAlertCenterAndFarmerHubProps {
  selectedBlockId: string;
  selectedBlockName: string;
  selectedCropId: string;
  horizon: ForecastHorizon;
}

export default function OfficerAlertCenterAndFarmerHub({
  selectedBlockId,
  selectedBlockName,
  selectedCropId,
  horizon,
}: OfficerAlertCenterAndFarmerHubProps) {
  const [alerts, setAlerts] = useState<CommunicationAlertRecord[]>([]);
  const [farmers, setFarmers] = useState<FarmerCommunicationProfile[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    "ALL" | "UNREAD" | "HIGH_PRIORITY" | "EXPIRED"
  >("ALL");

  // Officer Filters
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterCrop, setFilterCrop] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<
    AlertPriorityLevel | "ALL"
  >("ALL");
  const [filterLanguage, setFilterLanguage] = useState<FarmerLanguage | "ALL">(
    "ALL"
  );
  const [filterChannel, setFilterChannel] = useState<
    CommunicationChannel | "ALL"
  >("ALL");
  const [filterStatus, setFilterStatus] = useState<
    AlertLifecycleStatus | "ALL"
  >("ALL");

  // Farmer View state
  const [activeFarmerId, setActiveFarmerId] = useState<string>("frm-101");
  const [expandedExplainAlertId, setExpandedExplainAlertId] = useState<
    string | null
  >(null);
  const [inspectLogAlertId, setInspectLogAlertId] = useState<string | null>(
    null
  );
  const [deliveryModeSimulated, setDeliveryModeSimulated] =
    useState<boolean>(true);
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  // Bulk Alert Confirmation Modal state (Section 17)
  const [bulkPreviewModal, setBulkPreviewModal] =
    useState<BulkAlertPreviewSummary | null>(null);

  const refreshAll = () => {
    setAlerts(listCommunicationAlerts());
    setFarmers([...getRegisteredFarmers()]);
  };

  useEffect(() => {
    refreshAll();
  }, [selectedBlockId, selectedCropId, horizon]);

  const activeFarmer = useMemo(
    () => farmers.find((f) => f.id === activeFarmerId) || farmers[0],
    [farmers, activeFarmerId]
  );

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (selectedTab === "UNREAD" && a.read) return false;
      if (
        selectedTab === "HIGH_PRIORITY" &&
        a.severity !== "CRITICAL" &&
        a.severity !== "HIGH"
      ) {
        return false;
      }
      if (selectedTab === "EXPIRED" && a.status !== "EXPIRED") return false;
      if (filterBlock !== "all" && a.location_id !== filterBlock) return false;
      if (filterCrop !== "all" && a.crop_id !== filterCrop) return false;
      if (filterSeverity !== "ALL" && a.severity !== filterSeverity)
        return false;
      if (filterLanguage !== "ALL" && a.language !== filterLanguage)
        return false;
      if (filterChannel !== "ALL" && a.channel !== filterChannel) return false;
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      return true;
    });
  }, [
    alerts,
    selectedTab,
    filterBlock,
    filterCrop,
    filterSeverity,
    filterLanguage,
    filterChannel,
    filterStatus,
  ]);

  // Block-Wide Alert Summary (Section 16)
  const blockWideSummary = useMemo(() => {
    const blockAlerts = alerts.filter(
      (a) => a.location_id === selectedBlockId && a.status !== "EXPIRED"
    );
    const blockFarmers = farmers.filter(
      (f) => f.location_id === selectedBlockId
    );
    const affectedCrops = Array.from(
      new Set(blockAlerts.map((a) => a.crop_name))
    );
    const highPriorityCount = blockAlerts.filter(
      (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
    ).length;
    const failureOrUnconfiguredCount = blockAlerts.filter(
      (a) =>
        a.status === "FAILED" ||
        a.status === "NOT_CONFIGURED" ||
        a.status === "CANCELLED"
    ).length;

    return {
      blockName: selectedBlockName,
      overallRisk: highPriorityCount > 0 ? "HIGH / CRITICAL" : "MODERATE",
      affectedCrops:
        affectedCrops.length > 0 ? affectedCrops : ["Paddy", "Pulses"],
      totalRegisteredFarmers: Math.max(1, blockFarmers.length),
      farmersWithActiveAlerts: new Set(blockAlerts.map((a) => a.farmer_id))
        .size,
      highPriorityCount,
      failureOrUnconfiguredCount,
    };
  }, [alerts, farmers, selectedBlockId, selectedBlockName]);

  const handleToggleConsent = (farmerId: string, nextVal: boolean) => {
    updateFarmerConsentPreference(farmerId, nextVal);
    refreshAll();
    setActionBanner({
      type: nextVal ? "success" : "warning",
      text: nextVal
        ? `Consent updated: Notifications enabled for farmer ${farmerId}.`
        : `Consent updated: Notifications disabled by farmer (${farmerId}). External dispatches will be blocked.`,
    });
  };

  const handleSingleDispatch = async (
    farmer: FarmerCommunicationProfile,
    cropId: string,
    channel: CommunicationChannel
  ) => {
    const res = await dispatchSingleAlert({
      farmerId: farmer.id,
      locationId: farmer.location_id,
      cropId,
      channel,
      language: farmer.preferred_language,
      horizon,
      simulate: deliveryModeSimulated,
    });
    refreshAll();
    setActionBanner({
      type:
        res.status === "CANCELLED" || res.duplicate_suppressed
          ? "warning"
          : "success",
      text: `[${res.delivery_mode_badge}] ${res.reason}`,
    });
  };

  const handleRetryAlert = async (alertId: string) => {
    const res = await retryCommunicationAlert(alertId, deliveryModeSimulated);
    refreshAll();
    setActionBanner({
      type: res.success ? "success" : "warning",
      text: `Retry result for ${alertId}: [${res.delivery_mode_badge}] ${res.reason}`,
    });
  };

  const handleMarkReadAndRespond = (
    alertId: string,
    response?: FarmerResponseOption
  ) => {
    markCommunicationAlertRead(alertId, response);
    refreshAll();
    setActionBanner({
      type: "success",
      text: response
        ? `User-submitted response recorded (${response}) and alert marked READ.`
        : `Alert ${alertId} marked as READ.`,
    });
  };

  const handleOpenBulkModal = () => {
    const preview = previewBulkAlertOperation({
      locationId: selectedBlockId,
      cropId: selectedCropId,
      channel: "WhatsApp",
      language: "Hindi",
      horizon,
    });
    setBulkPreviewModal(preview);
  };

  const handleExecuteConfirmedBulkSend = async () => {
    if (!bulkPreviewModal) return;
    let sentCount = 0;
    let blockedCount = 0;
    for (const f of bulkPreviewModal.eligible_farmers) {
      const res = await dispatchSingleAlert({
        farmerId: f.farmer_id,
        locationId: bulkPreviewModal.location_id,
        cropId: bulkPreviewModal.crop_id,
        channel: bulkPreviewModal.channel,
        language: f.preferred_language,
        horizon,
        simulate: deliveryModeSimulated,
        forceResend: true,
      });
      if (res.status === "CANCELLED") blockedCount++;
      else sentCount++;
    }
    setBulkPreviewModal(null);
    refreshAll();
    setActionBanner({
      type: "success",
      text: `Confirmed bulk alert dispatch complete: ${sentCount} processed (${
        deliveryModeSimulated ? "SIMULATED DELIVERY" : "NOT_CONFIGURED CHECK"
      }), ${blockedCount} blocked by farmer consent preference.`,
    });
  };

  const inspectedLogBundle: {
    alert: CommunicationAlertRecord | null;
    deliveryLogs: AlertDeliveryLogRecord[];
  } | null = useMemo(() => {
    if (!inspectLogAlertId) return null;
    return getCommunicationAlertById(inspectLogAlertId);
  }, [inspectLogAlertId, alerts]);

  return (
    <div className="space-y-6 pt-4 border-t border-slate-200">
      {actionBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
            actionBanner.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : actionBanner.type === "warning"
              ? "bg-amber-50 border-amber-300 text-amber-950"
              : "bg-rose-50 border-rose-300 text-rose-950"
          }`}
        >
          <span>{actionBanner.text}</span>
          <button
            onClick={() => setActionBanner(null)}
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: MULTI-CROP FARMER PROFILE, CONSENT & EXPLAINABLE ALERT VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
              Section 3, 4, 15, 25, 26 &amp; 30 • Farmer Profile &amp; Multi-Crop
              Mapping (farmer_crops)
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1">
              Farmer View: Registered Multi-Crop Profiles, Privacy Masking &amp;
              Consent Controls
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              Select Farmer:
            </span>
            <select
              value={activeFarmerId}
              onChange={(e) => setActiveFarmerId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50"
            >
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.block_name} • {f.crops.length} Crops)
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeFarmer && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left column: Farmer Metadata, Masked Phone & Consent Gate */}
            <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {activeFarmer.name}{" "}
                    <span className="text-slate-500 font-semibold">
                      ({activeFarmer.hindi_name})
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    MY LOCATION: Uttar Pradesh • Prayagraj •{" "}
                    <span className="font-bold text-slate-900">
                      {activeFarmer.block_name}
                    </span>{" "}
                    ({activeFarmer.panchayat_name})
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[11px] font-bold">
                  <Lock className="w-3 h-3 text-slate-600" />
                  {activeFarmer.masked_phone}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">
                    Preferred Language
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {activeFarmer.preferred_language}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">
                    Preferred Channel
                  </span>
                  <span className="font-extrabold text-emerald-800">
                    {activeFarmer.preferred_channel}
                  </span>
                </div>
              </div>

              {/* Farmer Consent Toggle (Section 25) */}
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">
                    Notification Consent (notification_enabled)
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {activeFarmer.notification_enabled
                      ? "Active — Authorized to receive advisories"
                      : "Notifications disabled by farmer."}
                  </span>
                </div>
                <button
                  onClick={() =>
                    handleToggleConsent(
                      activeFarmer.id,
                      !activeFarmer.notification_enabled
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    activeFarmer.notification_enabled
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-rose-600 text-white hover:bg-rose-700"
                  }`}
                >
                  {activeFarmer.notification_enabled ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            </div>

            {/* Right column: MY CROPS (farmer_crops multi-crop mapping) & Dispatch */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-emerald-700" />
                  MY CROPS ({activeFarmer.crops.length} Registered in
                  farmer_crops)
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">
                    Provider Mode:
                  </span>
                  <button
                    onClick={() =>
                      setDeliveryModeSimulated(!deliveryModeSimulated)
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition ${
                      deliveryModeSimulated
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : "bg-slate-800 border-slate-900 text-white"
                    }`}
                  >
                    {deliveryModeSimulated
                      ? "Demo Mode: SIMULATED DELIVERY"
                      : "Live Check: NOT_CONFIGURED"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeFarmer.crops.map((crop) => (
                  <div
                    key={crop.id}
                    className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">
                          {crop.crop_name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 uppercase">
                          Stage: {crop.crop_stage}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {crop.hindi_crop_name} • Sowing Date: {crop.sowing_date}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
                      <button
                        onClick={() =>
                          handleSingleDispatch(
                            activeFarmer,
                            crop.crop_id,
                            "WhatsApp"
                          )
                        }
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#0B3B24] hover:bg-emerald-900 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp ({activeFarmer.preferred_language})
                      </button>
                      <button
                        onClick={() =>
                          handleSingleDispatch(
                            activeFarmer,
                            crop.crop_id,
                            "SMS"
                          )
                        }
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        SMS ({activeFarmer.preferred_language})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: BLOCK-WIDE ALERT SUMMARY & BULK CONFIRMATION TRIGGER (Sections 16 & 17) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-900">
              Section 16 &amp; 17 • Block-Wide Alert Intelligence &amp;
              Mandatory Bulk Confirmation
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1">
              Block-Wide Alert Summary — {blockWideSummary.blockName}
            </h3>
          </div>

          <button
            onClick={handleOpenBulkModal}
            className="px-4 py-2 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            Preview &amp; Confirm Block-Wide Bulk Alert
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Overall Block Risk
            </span>
            <span className="text-xs font-extrabold text-amber-800 mt-0.5 block">
              {blockWideSummary.overallRisk}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Affected Crops
            </span>
            <span className="text-xs font-extrabold text-slate-900 mt-0.5 block">
              {blockWideSummary.affectedCrops.join(", ")}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Registered Farmers
            </span>
            <span className="text-xs font-extrabold text-slate-900 mt-0.5 block">
              {blockWideSummary.totalRegisteredFarmers}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Active Alert Recipients
            </span>
            <span className="text-xs font-extrabold text-emerald-800 mt-0.5 block">
              {blockWideSummary.farmersWithActiveAlerts}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-bold uppercase text-amber-800 block">
              High / Critical Priority
            </span>
            <span className="text-xs font-extrabold text-amber-950 mt-0.5 block">
              {blockWideSummary.highPriorityCount} Alerts
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-bold uppercase text-rose-800 block">
              Blocked / Unconfigured
            </span>
            <span className="text-xs font-extrabold text-rose-950 mt-0.5 block">
              {blockWideSummary.failureOrUnconfiguredCount} Alerts
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: OFFICER ALERT CENTER & IN-APP NOTIFICATION CENTER (Sections 13 & 14) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-950">
              Section 13, 14, 18, 19 &amp; 30 • Officer Alert Center &amp;
              Explainable Delivery Ledger
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1">
              Officer Alert Center (Deduplication, Expiration, Explainability
              &amp; Delivery Audit)
            </h3>
          </div>

          {/* View Tabs: ALL, UNREAD, HIGH PRIORITY, EXPIRED */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: "ALL", label: `ALL (${alerts.length})` },
                {
                  id: "UNREAD",
                  label: `UNREAD (${alerts.filter((a) => !a.read).length})`,
                },
                {
                  id: "HIGH_PRIORITY",
                  label: `HIGH PRIORITY (${
                    alerts.filter(
                      (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
                    ).length
                  })`,
                },
                {
                  id: "EXPIRED",
                  label: `EXPIRED (${
                    alerts.filter((a) => a.status === "EXPIRED").length
                  })`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  selectedTab === tab.id
                    ? "bg-[#0B3B24] text-white shadow-2xs"
                    : "text-slate-700 hover:bg-white/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Officer Filters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block">
              Block
            </label>
            <select
              value={filterBlock}
              onChange={(e) => setFilterBlock(e.target.value)}
              className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
            >
              <option value="all">All Blocks</option>
              <option value="karchhana">Karchhana</option>
              <option value="phulpur">Phulpur</option>
              <option value="meja">Meja</option>
              <option value="soraon">Soraon</option>
              <option value="koraon">Koraon</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block">
              Crop
            </label>
            <select
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
            >
              <option value="all">All Crops</option>
              <option value="paddy">Paddy</option>
              <option value="pulses">Pulses</option>
              <option value="maize">Maize</option>
              <option value="soybean">Soybean</option>
              <option value="cotton">Cotton</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block">
              Severity
            </label>
            <select
              value={filterSeverity}
              onChange={(e) =>
                setFilterSeverity(e.target.value as AlertPriorityLevel | "ALL")
              }
              className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MODERATE">MODERATE</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block">
              Language
            </label>
            <select
              value={filterLanguage}
              onChange={(e) =>
                setFilterLanguage(e.target.value as FarmerLanguage | "ALL")
              }
              className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
            >
              <option value="ALL">All Languages</option>
              <option value="Hindi">Hindi</option>
              <option value="English">English</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block">
              Channel
            </label>
            <select
              value={filterChannel}
              onChange={(e) =>
                setFilterChannel(e.target.value as CommunicationChannel | "ALL")
              }
              className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
            >
              <option value="ALL">All Channels</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="In-App">In-App</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block">
              Lifecycle Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as AlertLifecycleStatus | "ALL")
              }
              className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value="SIMULATED">SIMULATED</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
              <option value="CANCELLED">CANCELLED (Consent)</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="READ">READ</option>
            </select>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isExpanded = expandedExplainAlertId === alert.id;
            const isInspectingLogs = inspectLogAlertId === alert.id;
            return (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 space-y-3 transition ${
                  alert.status === "EXPIRED"
                    ? "bg-slate-50 border-slate-300 opacity-85"
                    : alert.severity === "CRITICAL" || alert.severity === "HIGH"
                    ? "bg-amber-50/40 border-amber-300"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                          alert.severity === "CRITICAL"
                            ? "bg-rose-700 text-white"
                            : alert.severity === "HIGH"
                            ? "bg-amber-600 text-white"
                            : "bg-sky-700 text-white"
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-200 text-slate-900">
                        {alert.delivery_mode_badge}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-600">
                        Status: {alert.status} • Channel: {alert.channel} (
                        {alert.language})
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-600">
                        Recipient: {alert.farmer_name} ({alert.masked_phone})
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {alert.title}
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() =>
                        setExpandedExplainAlertId(isExpanded ? null : alert.id)
                      }
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-800 flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
                      Why this alert?
                    </button>
                    <button
                      onClick={() =>
                        setInspectLogAlertId(isInspectingLogs ? null : alert.id)
                      }
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-800 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-700" />
                      Delivery Log
                    </button>
                    <button
                      onClick={() => handleRetryAlert(alert.id)}
                      className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold text-amber-950 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry / Resend
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs whitespace-pre-line font-medium text-slate-800">
                  {alert.message}
                </div>

                {/* Farmer Response Simulation & Read Status (Section 13 & 21) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">
                      Farmer Response Simulation (User-submitted response):
                    </span>
                    {(
                      [
                        { id: "READ_ACKNOWLEDGED", label: "Read" },
                        { id: "ACTION_TAKEN", label: "Action Taken" },
                        {
                          id: "NEED_OFFICER_CALL",
                          label: "Need Officer Call",
                        },
                      ] as const
                    ).map((resp) => (
                      <button
                        key={resp.id}
                        onClick={() =>
                          handleMarkReadAndRespond(alert.id, resp.id)
                        }
                        className={`px-2 py-0.5 rounded border font-bold transition ${
                          alert.farmer_response === resp.id
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {resp.label}
                      </button>
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    Dedup Key: {alert.dedup_key}
                  </span>
                </div>

                {/* Section 30: "Why this alert?" & "Why am I receiving this?" Drawer */}
                {isExpanded && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-300 text-xs space-y-2">
                    <p className="font-extrabold text-emerald-950 uppercase tracking-wider text-[11px]">
                      Alert Explainability (&quot;Why this alert?&quot; &amp;
                      &quot;Why am I receiving this?&quot;)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">
                          Block &amp; Crop:
                        </span>
                        <span className="font-bold text-slate-900">
                          {alert.explainability.block_name} •{" "}
                          {alert.explainability.crop_name} (
                          {alert.explainability.crop_stage})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          False Onset / Dry Spell:
                        </span>
                        <span className="font-bold text-slate-900">
                          {alert.explainability.false_onset_risk_pct}% /{" "}
                          {alert.explainability.dry_spell_risk_pct}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Soil Moisture &amp; 7D Rain:
                        </span>
                        <span className="font-bold text-slate-900">
                          {alert.explainability.soil_moisture_pct}% •{" "}
                          {alert.explainability.cumulative_rain_7d_mm} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Rule Triggered:
                        </span>
                        <span className="font-mono font-bold text-emerald-900">
                          {alert.explainability.rule_id} (
                          {alert.explainability.rule_triggered})
                        </span>
                      </div>
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-slate-800 space-y-0.5 pt-1">
                      {alert.explainability.why_receiving_points.map(
                        (pt, idx) => (
                          <li key={idx}>{pt}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {/* Section 20: Delivery Audit Log Drawer */}
                {isInspectingLogs && inspectedLogBundle && (
                  <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono space-y-1.5">
                    <p className="font-bold text-sky-400">
                      alert_delivery_logs Audit Trail (Alert ID: {alert.id})
                    </p>
                    {inspectedLogBundle.deliveryLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border-t border-slate-700 pt-1.5"
                      >
                        <div>
                          Provider: {log.provider} | Status: {log.status}
                        </div>
                        <div>
                          Req: {log.request_timestamp} | Resp:{" "}
                          {log.response_timestamp}
                        </div>
                        <div>
                          Msg ID: {log.provider_message_id || "null"} | Error:{" "}
                          {log.error_code || "none"} (
                          {log.error_message || "OK"})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 17: MANDATORY BULK ALERT CONFIRMATION MODAL */}
      {bulkPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  Mandatory Bulk Send Confirmation (Section 17)
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Confirm Block-Wide Advisory Dispatch
                </h3>
              </div>
              <button
                onClick={() => setBulkPreviewModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Block &amp; Crop:</span>
                <span className="font-bold text-slate-900">
                  {bulkPreviewModal.block_name} • {bulkPreviewModal.crop_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">
                  Channel &amp; Language:
                </span>
                <span className="font-bold text-slate-900">
                  {bulkPreviewModal.channel} ({bulkPreviewModal.language})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">
                  Eligible Recipients:
                </span>
                <span className="font-bold text-emerald-800">
                  {bulkPreviewModal.recipient_count} Farmers (Consent Enabled)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">
                  Consent Blocked / Severity:
                </span>
                <span className="font-bold text-amber-900">
                  {bulkPreviewModal.consent_blocked_count} Blocked •{" "}
                  {bulkPreviewModal.severity}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs whitespace-pre-line font-medium text-slate-900 max-h-48 overflow-y-auto">
              {bulkPreviewModal.message_preview}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBulkPreviewModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteConfirmedBulkSend}
                className="px-4 py-2 rounded-xl bg-[#0B3B24] hover:bg-emerald-900 text-white text-xs font-extrabold transition"
              >
                Confirm &amp; Dispatch ({bulkPreviewModal.recipient_count}{" "}
                Farmers)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
