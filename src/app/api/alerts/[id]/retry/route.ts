import { NextRequest, NextResponse } from "next/server";
import { retryCommunicationAlert } from "@/services/communicationEngine";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const simulate = typeof body.simulate === "boolean" ? body.simulate : true;

  const result = await retryCommunicationAlert(id, simulate);
  return NextResponse.json({
    ok: result.success,
    ...result,
  });
}
