import { NextRequest, NextResponse } from "next/server";
import {
  getRegisteredFarmers,
  listCommunicationAlerts,
} from "@/services/communicationEngine";
import {
  AlertLifecycleStatus,
  AlertPriorityLevel,
  CommunicationChannel,
} from "@/types/communication";
import { FarmerLanguage } from "@/types/monsoon";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId") || undefined;
  const cropId = searchParams.get("cropId") || undefined;
  const alertType = searchParams.get("alertType") || undefined;
  const severity =
    (searchParams.get("severity") as AlertPriorityLevel | "ALL") || undefined;
  const language =
    (searchParams.get("language") as FarmerLanguage | "ALL") || undefined;
  const channel =
    (searchParams.get("channel") as CommunicationChannel | "ALL") || undefined;
  const status =
    (searchParams.get("status") as AlertLifecycleStatus | "ALL" | "UNREAD") ||
    undefined;
  const farmerId = searchParams.get("farmerId") || undefined;

  const alerts = listCommunicationAlerts({
    locationId,
    cropId,
    alertType,
    severity,
    language,
    channel,
    status,
    farmerId,
  });

  const farmers = getRegisteredFarmers(locationId);

  return NextResponse.json({
    ok: true,
    count: alerts.length,
    unread_count: alerts.filter((a) => !a.read).length,
    high_priority_count: alerts.filter(
      (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
    ).length,
    expired_count: alerts.filter((a) => a.status === "EXPIRED").length,
    failed_or_unconfigured_count: alerts.filter(
      (a) => a.status === "FAILED" || a.status === "NOT_CONFIGURED"
    ).length,
    alerts,
    farmers,
  });
}
