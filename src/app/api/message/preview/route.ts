import { NextRequest, NextResponse } from "next/server";
import { generateStructuredFarmerMessage } from "@/services/messageGenerator";
import { evaluateAlertPriority } from "@/services/alertPriorityService";
import { MOCK_BLOCKS } from "@/data/mockData";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";
import {
  AdvisorySignalSource,
  CommunicationChannel,
} from "@/types/communication";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const locationId = String(body.locationId || "karchhana");
    const block =
      MOCK_BLOCKS.find((b) => b.id === locationId) || MOCK_BLOCKS[0];

    const falseOnsetRiskPct =
      typeof body.falseOnsetRiskPct === "number"
        ? body.falseOnsetRiskPct
        : block.falseOnsetProbability;
    const drySpellRiskPct =
      typeof body.drySpellRiskPct === "number"
        ? body.drySpellRiskPct
        : block.drySpellProbability;
    const heavyRainRiskPct =
      typeof body.heavyRainRiskPct === "number"
        ? body.heavyRainRiskPct
        : block.heavyRainProbability;

    const priorityEval = evaluateAlertPriority({
      falseOnsetRisk: falseOnsetRiskPct,
      drySpellRisk: drySpellRiskPct,
      heavyRainRisk: heavyRainRiskPct,
      soilMoisturePct: block.soilMoisture,
    });

    const generated = generateStructuredFarmerMessage({
      blockName: body.blockName || block.name,
      districtName: body.districtName || block.district,
      cropName: body.cropName || "Paddy / Rice",
      hindiCropName: body.hindiCropName,
      cropStage: body.cropStage || "sowing",
      language: (body.language ||
        body.preferredLanguage ||
        "Hindi") as FarmerLanguage,
      preferredLanguage: (body.preferredLanguage || "Hindi") as FarmerLanguage,
      horizon: (body.horizon || "14D") as ForecastHorizon,
      severity: priorityEval.severity,
      falseOnsetRiskPct,
      drySpellRiskPct,
      heavyRainRiskPct,
      expectedDrySpellDays:
        body.expectedDrySpellDays || block.expectedDrySpellDays,
      recommendedActionEn: body.recommendedActionEn,
      recommendedActionHi: body.recommendedActionHi,
      cautionEn: body.cautionEn,
      cautionHi: body.cautionHi,
      signalSource: (body.signalSource ||
        "AI_FORECAST") as AdvisorySignalSource,
      modelVersion: body.modelVersion || "MPAI-ENS-0.1",
      channel: (body.channel || "WhatsApp") as CommunicationChannel,
    });

    return NextResponse.json({
      ok: true,
      priority: priorityEval,
      preview: generated,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate message preview",
      },
      { status: 400 }
    );
  }
}
