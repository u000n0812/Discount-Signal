import { NextResponse } from "next/server";
import { runChecksForDueWatches } from "@/lib/check";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 정해진 주기로 모든 사용자의 감시를 확인한다.
 * Vercel Cron은 요청에 `Authorization: Bearer $CRON_SECRET`을 붙여준다.
 * CRON_SECRET을 설정하지 않으면 이 경로는 열리지 않는다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았어요." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  }

  try {
    const summary = await runChecksForDueWatches();
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[api/cron] failed", error);
    return NextResponse.json({ error: "확인 중 문제가 생겼어요." }, { status: 500 });
  }
}
