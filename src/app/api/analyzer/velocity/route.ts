import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPipelineVelocity, VELOCITY_TIMEFRAMES, type Timeframe } from "@/lib/velocity-analysis";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tf = req.nextUrl.searchParams.get("timeframe");
  const timeframe: Timeframe =
    tf && (VELOCITY_TIMEFRAMES as string[]).includes(tf) ? (tf as Timeframe) : "lifetime";

  const data = await getPipelineVelocity(timeframe);
  return NextResponse.json(data);
}
