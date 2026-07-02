import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPipelineVelocityTrend, VELOCITY_WINDOWS, type VelocityWindow } from "@/lib/velocity-analysis";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const w = req.nextUrl.searchParams.get("window");
  const window: VelocityWindow =
    w && (VELOCITY_WINDOWS as string[]).includes(w) ? (w as VelocityWindow) : "3m";

  const data = await getPipelineVelocityTrend(window);
  return NextResponse.json(data);
}
