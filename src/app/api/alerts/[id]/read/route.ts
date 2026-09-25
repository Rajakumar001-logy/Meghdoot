import { NextRequest, NextResponse } from "next/server";
import { markCommunicationAlertRead } from "@/services/communicationEngine";
import { FarmerResponseOption } from "@/types/communication";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const farmerResponse = body.farmerResponse as
    | FarmerResponseOption
    | undefined;

  const updated = markCommunicationAlertRead(id, farmerResponse);
  if (!updated) {
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
    alert: updated,
  });
}
