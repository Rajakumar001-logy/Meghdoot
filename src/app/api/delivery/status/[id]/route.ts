import { NextRequest, NextResponse } from "next/server";
import { getCommunicationAlertById } from "@/services/communicationEngine";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { alert, deliveryLogs } = getCommunicationAlertById(id);

  if (!alert) {
    return NextResponse.json(
      {
        ok: false,
        error: `Delivery status for alert ${id} not found`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    alert_id: alert.id,
    channel: alert.channel,
    status: alert.status,
    delivery_mode_badge: alert.delivery_mode_badge,
    masked_recipient_phone: alert.masked_phone,
    sent_at: alert.sent_at,
    expires_at: alert.expires_at,
    farmer_response: alert.farmer_response,
    delivery_logs: deliveryLogs,
  });
}
