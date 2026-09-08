import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/userId";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ alerts: [] });

  const alerts = await prisma.alert.findMany({
    where: { userId, dismissed: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ alerts });
}

/** "관심없음" — 피드에서 내리고, 나중에 매칭 정확도를 손볼 때 근거로 쓴다. */
export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "사용자 식별 실패" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id가 필요해요." }, { status: 400 });

  const { count } = await prisma.alert.updateMany({
    where: { id: body.id, userId },
    data: { dismissed: true },
  });
  if (count === 0) return NextResponse.json({ error: "알림을 찾지 못했어요." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
