import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/userId";
import { runChecksForUser } from "@/lib/check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 화면의 "지금 확인" 버튼 — 내 감시만 즉시 한 바퀴 돈다. */
export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "사용자 식별에 실패했어요." }, { status: 400 });
  }

  try {
    const summary = await runChecksForUser(userId);
    const [watches, alerts] = await Promise.all([
      prisma.watch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.alert.findMany({
        where: { userId, dismissed: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return NextResponse.json({ summary, watches, alerts });
  } catch (error) {
    console.error("[api/check] failed", error);
    return NextResponse.json({ error: "확인 중 문제가 생겼어요." }, { status: 500 });
  }
}
