import { FarmerLanguage, ForecastHorizon } from "./monsoon";
import {
  AdvisorySeverity,
  AdvisorySourceMode,
  CanonicalGrowthStage,
  SupportedCropId,
} from "./advisory";

export type CropStageId =
  | CanonicalGrowthStage
  | "sowing"
  | "nursery"
  | "vegetative"
  | "flowering"
  | "harvest";

export type AdvisorySignalSource =
  | "AI_FORECAST"
  | "SIMULATED_FORECAST"
  | "DEMO_SCENARIO";
export type AdvisoryConfidenceTier = "HIGH" | "MODERATE" | "LOW";

export type AlertPriorityLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";

export type AlertLifecycleStatus =
  | "GENERATED"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "EXPIRED"
  | "SIMULATED"
  | "CANCELLED"
  | "NOT_CONFIGURED";

export type CommunicationChannel =
  | "In-App"
  | "WhatsApp"
  | "SMS"
  | "Dashboard";

export type FarmerResponseOption =
  | "READ_ACKNOWLEDGED"
  | "ACTION_TAKEN"
  | "NEED_OFFICER_CALL";

export interface FarmerCropAssignment {
  id: string;
  farmer_id: string;
  crop_id: string;
  crop_name: string;
  hindi_crop_name: string;
  crop_stage: CropStageId;
  sowing_date: string;
  created_at: string;
  updated_at: string;
}

export interface FarmerCommunicationProfile {
  id: string;
  name: string;
  hindi_name: string;
  /** Masked phone number for UI and logs: +91 ******1234 */
  masked_phone: string;
  /** Raw phone stored server-side only; never serialized unmasked in non-authorized views */
  raw_phone_last4: string;
  preferred_language: FarmerLanguage;
  location_id: string;
  block_name: string;
  panchayat_name: string;
  preferred_channel: CommunicationChannel;
  notification_enabled: boolean;
  active: boolean;
  land_size_acres: number;
  crops: FarmerCropAssignment[];
  created_at: string;
  updated_at: string;
}

export interface AlertExplainabilityTrace {
  block_name: string;
  crop_name: string;
  crop_stage: string;
  false_onset_risk_pct: number;
  dry_spell_risk_pct: number;
  heavy_rain_risk_pct: number;
  soil_moisture_pct: number;
  cumulative_rain_7d_mm: number;
  rule_id: string;
  rule_triggered: string;
  recommended_action: string;
  why_receiving_points: string[];
}

export interface CommunicationAlertRecord {
  id: string;
  farmer_id: string | null;
  farmer_name: string | null;
  masked_phone: string | null;
  location_id: string;
  block_name: string;
  crop_id: string;
  crop_name: string;
  crop_stage: CropStageId;
  advisory_id: string;
  alert_type: string;
  severity: AlertPriorityLevel;
  title: string;
  message: string;
  language: FarmerLanguage;
  channel: CommunicationChannel;
  status: AlertLifecycleStatus;
  delivery_mode_badge:
    | "SIMULATED DELIVERY"
    | "NOT_CONFIGURED"
    | "IN-APP DELIVERED"
    | "PROVIDER DELIVERED"
    | "CONSENT BLOCKED"
    | "EXPIRED"
    | "DUPLICATE SUPPRESSED";
  dedup_key: string;
  model_version: string;
  forecast_horizon: ForecastHorizon;
  signal_source: AdvisorySignalSource;
  confidence_tier: AdvisoryConfidenceTier;
  observation_cutoff: string;
  forecast_issue_time: string;
  created_at: string;
  sent_at: string | null;
  expires_at: string;
  read: boolean;
  farmer_response: FarmerResponseOption | null;
  explainability: AlertExplainabilityTrace;
}

export interface AlertDeliveryLogRecord {
  id: string;
  alert_id: string;
  provider: string;
  request_timestamp: string;
  response_timestamp: string;
  provider_message_id: string | null;
  status: AlertLifecycleStatus;
  error_code: string | null;
  error_message: string | null;
}

export interface ProviderDeliveryResult {
  status: "SENT" | "DELIVERED" | "SIMULATED" | "NOT_CONFIGURED" | "FAILED";
  delivery_label:
    | "SIMULATED DELIVERY"
    | "NOT_CONFIGURED"
    | "PROVIDER DELIVERED"
    | "DELIVERY FAILED";
  provider: string;
  provider_message_id: string | null;
  request_timestamp: string;
  response_timestamp: string;
  reason: string;
  error_code?: string | null;
}
