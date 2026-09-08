import { NextResponse } from "next/server";
import { searchSteamApps } from "@/lib/steam";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("q")?.trim();
  if (!term || term.length < 2) return NextResponse.json({ items: [] });

  try {
    const items = await searchSteamApps(term);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[api/steam-search] failed", error);
    return NextResponse.json(
      { items: [], error: "스팀 검색에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }
}
