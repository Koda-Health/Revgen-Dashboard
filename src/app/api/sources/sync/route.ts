// src/app/api/sources/sync/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAttioSync } from "@/lib/run-sync";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = (await req.json()) as { source: string };

  try {
    if (source === "attio") {
      const result = await runAttioSync();
      await prisma.auditLog.create({
        data: { action: "SYNC_ATTIO", details: result },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
  } catch (err) {
    console.error(`[sources/sync] ${source}:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
