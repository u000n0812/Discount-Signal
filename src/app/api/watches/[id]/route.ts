import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/userId";

export const dynamic = "force-dynamic";

/** 켜기·끄기만 바꾼다. 조건을 크게 바꾸려면 지우고 새로 등록하는 편이 명확하다. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/watches/[id]">
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "사용자 식별 실패" }, { status: 400 });

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { active?: boolean };
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active 값이 필요해요." }, { status: 400 });
  }

  // userId를 함께 걸어 남의 감시를 id만으로 건드릴 수 없게 한다.
  const { count } = await prisma.watch.updateMany({
    where: { id, userId },
    data: { active: body.active },
  });
  if (count === 0) return NextResponse.json({ error: "감시를 찾지 못했어요." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/watches/[id]">) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "사용자 식별 실패" }, { status: 400 });

  const { id } = await ctx.params;
  const { count } = await prisma.watch.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "감시를 찾지 못했어요." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
