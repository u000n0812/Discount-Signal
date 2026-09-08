import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/userId";
import { DEFAULT_MIN_SCORE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ setting: { minScore: DEFAULT_MIN_SCORE, browserNotify: true } });
  }

  const setting = await prisma.setting.findUnique({ where: { userId } });
  return NextResponse.json({
    setting: setting ?? { minScore: DEFAULT_MIN_SCORE, browserNotify: true },
  });
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "사용자 식별 실패" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    minScore?: number;
    browserNotify?: boolean;
  };

  const minScore =
    typeof body.minScore === "number" && Number.isFinite(body.minScore)
      ? Math.max(30, Math.min(95, Math.round(body.minScore)))
      : undefined;
  const browserNotify = typeof body.browserNotify === "boolean" ? body.browserNotify : undefined;

  if (minScore === undefined && browserNotify === undefined) {
    return NextResponse.json({ error: "바꿀 값이 없어요." }, { status: 400 });
  }

  const setting = await prisma.setting.upsert({
    where: { userId },
    create: { userId, ...(minScore !== undefined ? { minScore } : {}), ...(browserNotify !== undefined ? { browserNotify } : {}) },
    update: { ...(minScore !== undefined ? { minScore } : {}), ...(browserNotify !== undefined ? { browserNotify } : {}) },
  });

  return NextResponse.json({ setting });
}
