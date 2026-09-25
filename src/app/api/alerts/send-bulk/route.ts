import { NextRequest, NextResponse } from "next/server";
import {
  dispatchSingleAlert,
  getRegisteredFarmers,
  previewBulkAlertOperation,
} from "@/services/communicationEngine";
import { checkDispatchRateLimit } from "@/services/alertPriorityService";
import {
  AdvisorySignalSource,
  CommunicationChannel,
} from "@/types/communication";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Section 17: Bulk alert sending MUST require explicit user confirmation
    if (body.confirmSend !== true) {
      const preview = previewBulkAlertOperation({
        locationId: String(body.locationId || "karchhana"),
        cropId: String(body.cropId || "paddy"),
        channel: (body.channel || "WhatsApp") as CommunicationChannel,
        language: (body.language || "Hindi") as FarmerLanguage,
        horizon: (body.horizon || "14D") as ForecastHorizon,
      });

      return NextResponse.json(
        {
          ok: false,
          confirmation_required: true,
          reason:
            "Bulk alert dispatch requires explicit confirmation (confirmSend: true). Review recipient summary and preview first.",
          preview,
        },
        { status: 400 }
      );
    }

    // Rate limit check for bulk job (Section 28)
    const rateCheck = checkDispatchRateLimit({ isBulkJob: true });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: rateCheck.reason,
        },
        { status: 429 }
      );
    }

    const locationId = String(body.locationId || "karchhana");
    const cropId = String(body.cropId || "paddy");
    const channel = (body.channel || "WhatsApp") as CommunicationChannel;
    const language = body.language as FarmerLanguage | undefined;
    const horizon = (body.horizon || "14D") as ForecastHorizon;
    const signalSource = (body.signalSource ||
      "AI_FORECAST") as AdvisorySignalSource;
    const simulate = typeof body.simulate === "boolean" ? body.simulate : true;

    const targetFarmers = getRegisteredFarmers(
      locationId === "all" ? undefined : locationId
    );

    const results = [];
    let sentOrSimulatedCount = 0;
    let consentBlockedCount = 0;
    let duplicateSuppressedCount = 0;

    for (const farmer of targetFarmers) {
      const res = await dispatchSingleAlert({
        farmerId: farmer.id,
        locationId: farmer.location_id,
        cropId,
        channel,
        language: language || farmer.preferred_language,
        horizon,
        signalSource,
        simulate,
      });

      if (res.status === "CANCELLED") {
        consentBlockedCount++;
      } else if (res.duplicate_suppressed) {
        duplicateSuppressedCount++;
      } else {
        sentOrSimulatedCount++;
      }
      results.push(res);
    }

    return NextResponse.json({
      ok: true,
      total_targeted: targetFarmers.length,
      dispatched_count: sentOrSimulatedCount,
      consent_blocked_count: consentBlockedCount,
      duplicate_suppressed_count: duplicateSuppressedCount,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Bulk alert dispatch failed",
      },
      { status: 400 }
    );
  }
}
