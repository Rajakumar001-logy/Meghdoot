import { NextRequest, NextResponse } from "next/server";
import { dispatchSingleAlert } from "@/services/communicationEngine";
import {
  AdvisorySignalSource,
  CommunicationChannel,
  CropStageId,
} from "@/types/communication";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await dispatchSingleAlert({
      farmerId: body.farmerId ? String(body.farmerId) : undefined,
      locationId: String(body.locationId || "karchhana"),
      cropId: String(body.cropId || "paddy"),
      cropStage: (body.cropStage || "sowing") as CropStageId,
      channel: (body.channel || "WhatsApp") as CommunicationChannel,
      language: body.language as FarmerLanguage | undefined,
      horizon: (body.horizon || "14D") as ForecastHorizon,
      signalSource: (body.signalSource || "AI_FORECAST") as AdvisorySignalSource,
      simulate: typeof body.simulate === "boolean" ? body.simulate : true,
      forceResend: Boolean(body.forceResend),
      validUntilIso: body.validUntilIso ? String(body.validUntilIso) : undefined,
    });

    return NextResponse.json({
      ok: result.success,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Alert dispatch failed",
      },
      { status: 400 }
    );
  }
}
