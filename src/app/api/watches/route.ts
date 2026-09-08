import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/userId";
import { fetchSteamPrice } from "@/lib/steam";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ watches: [] });

  const watches = await prisma.watch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ watches });
}

type CreateBody = {
  kind?: "STEAM" | "WEB";
  label?: string;
  steamAppId?: number;
  url?: string;
  condition?: string;
  minDiscount?: number;
  targetPrice?: number;
};

function toPositiveInt(value: unknown, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.round(parsed), max);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "사용자 식별에 실패했어요. 새로고침 후 다시 시도해주세요." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const kind = body.kind === "WEB" ? "WEB" : body.kind === "STEAM" ? "STEAM" : null;
  if (!kind) {
    return NextResponse.json({ error: "감시 종류를 골라주세요." }, { status: 400 });
  }

  const condition = body.condition?.trim().slice(0, 200) || null;
  const minDiscount = toPositiveInt(body.minDiscount, 99);
  const targetPrice = toPositiveInt(body.targetPrice, 100_000_000);

  if (kind === "STEAM") {
    const appId = toPositiveInt(body.steamAppId, 99_999_999);
    if (!appId) {
      return NextResponse.json({ error: "게임을 검색해서 골라주세요." }, { status: 400 });
    }

    // 등록 시점에 한 번 불러 실제로 존재하는 게임인지 확인하고 제목을 채운다.
    let label = body.label?.trim();
    try {
      const price = await fetchSteamPrice(appId);
      label = price.name;
    } catch (error) {
      if (!label) {
        const message = error instanceof Error ? error.message : "스팀 정보를 확인하지 못했어요.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const watch = await prisma.watch.create({
      data: {
        userId,
        kind,
        label: label!.slice(0, 120),
        steamAppId: appId,
        condition,
        minDiscount,
        targetPrice,
      },
    });
    return NextResponse.json({ watch });
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "감시할 주소를 입력해주세요." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "주소 형식이 올바르지 않아요." }, { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "http(s) 주소만 감시할 수 있어요." }, { status: 400 });
  }

  const watch = await prisma.watch.create({
    data: {
      userId,
      kind,
      label: (body.label?.trim() || url.host).slice(0, 120),
      url: url.toString(),
      condition,
      minDiscount,
      targetPrice,
    },
  });
  return NextResponse.json({ watch });
}
