import { NextRequest, NextResponse } from "next/server";
import { previewBulkAlertOperation } from "@/services/communicationEngine";
import { CommunicationChannel } from "@/types/communication";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const locationId = String(body.locationId || "karchhana");
    const cropId = String(body.cropId || "paddy");
    const channel = (body.channel || "WhatsApp") as CommunicationChannel;
    const language = (body.language || "Hindi") as FarmerLanguage;
    const horizon = (body.horizon || "14D") as ForecastHorizon;

    const summary = previewBulkAlertOperation({
      locationId,
      cropId,
      channel,
      language,
      horizon,
    });

    return NextResponse.json({
      ok: true,
      preview: summary,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to preview alert",
      },
      { status: 400 }
    );
  }
}
