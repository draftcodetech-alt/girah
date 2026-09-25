import { NextRequest, NextResponse } from "next/server";
import { processSafepayWebhook } from "@/modules/payments";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const result = await processSafepayWebhook(
    rawBody,
    request.headers.get("x-sfpy-signature"),
    request.headers.get("x-sfpy-timestamp")
  );
  return NextResponse.json(result.body, { status: result.status });
}
