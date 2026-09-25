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
        error: `Alert ${id} not found`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    alert,
    delivery_logs: deliveryLogs,
  });
}
