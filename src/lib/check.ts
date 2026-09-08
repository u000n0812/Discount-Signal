/**
 * 감시 목록을 한 바퀴 돌면서 조건에 맞는 할인만 알림으로 남긴다.
 * 화면의 "지금 확인" 버튼과 크론(/api/cron)이 같은 함수를 쓴다.
 */

import type { Watch } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MIN_SCORE } from "@/lib/constants";
import { fetchSteamPrice, steamStoreUrl } from "@/lib/steam";
import { fetchPageSnapshot } from "@/lib/web";
import { matchSteam, matchWebPage, type MatchResult } from "@/lib/match";

export type CheckSummary = {
  checked: number;
  created: number;
  failed: number;
};

async function evaluate(watch: Watch): Promise<{ result: MatchResult; source: string; url: string }> {
  const input = {
    label: watch.label,
    condition: watch.condition,
    minDiscount: watch.minDiscount,
    targetPrice: watch.targetPrice,
  };

  if (watch.kind === "STEAM") {
    if (!watch.steamAppId) throw new Error("스팀 appId가 없는 감시예요.");
    const price = await fetchSteamPrice(watch.steamAppId);
    return {
      result: matchSteam(price, input),
      source: "Steam",
      url: steamStoreUrl(watch.steamAppId),
    };
  }

  if (!watch.url) throw new Error("감시할 주소가 없어요.");
  const snapshot = await fetchPageSnapshot(watch.url);
  return {
    result: await matchWebPage(snapshot, input),
    source: snapshot.host,
    url: snapshot.url,
  };
}

/** 감시 한 건을 확인하고, 새로운 할인이면 알림을 만든다. */
export async function checkWatch(watch: Watch, minScore: number): Promise<boolean> {
  let created = false;
  try {
    const { result, source, url } = await evaluate(watch);
    const isNew =
      result.matched && result.score >= minScore && result.signature !== watch.lastSignature;

    if (isNew) {
      try {
        await prisma.alert.create({
          data: {
            userId: watch.userId,
            watchId: watch.id,
            title: result.title,
            source,
            url,
            priceNow: result.priceNow,
            priceWas: result.priceWas,
            discountPercent: result.discountPercent,
            matchScore: result.score,
            reason: result.reason,
            signature: result.signature,
          },
        });
        created = true;
      } catch (error) {
        // 같은 세일이 이미 기록돼 있으면(unique 충돌) 조용히 넘어간다.
        if (!isUniqueViolation(error)) throw error;
      }
    }

    await prisma.watch.update({
      where: { id: watch.id },
      data: {
        lastCheckedAt: new Date(),
        lastError: null,
        // 조건을 만족한 상태만 기억해, 세일이 끝났다 다시 시작하면 새 알림이 가게 한다.
        lastSignature: result.matched ? result.signature : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error(`[signal] 감시 확인 실패 (${watch.id})`, error);
    await prisma.watch.update({
      where: { id: watch.id },
      data: { lastCheckedAt: new Date(), lastError: message },
    });
    throw error;
  }

  return created;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function getMinScore(userId: string): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { userId } });
  return setting?.minScore ?? DEFAULT_MIN_SCORE;
}

/** 하나가 실패해도 나머지는 계속 확인한다. */
async function runChecks(watches: Watch[], minScoreOf: (userId: string) => Promise<number>) {
  const summary: CheckSummary = { checked: 0, created: 0, failed: 0 };

  for (const watch of watches) {
    summary.checked += 1;
    try {
      if (await checkWatch(watch, await minScoreOf(watch.userId))) summary.created += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

export async function runChecksForUser(userId: string): Promise<CheckSummary> {
  const [watches, minScore] = await Promise.all([
    prisma.watch.findMany({ where: { userId, active: true }, orderBy: { createdAt: "asc" } }),
    getMinScore(userId),
  ]);
  return runChecks(watches, async () => minScore);
}

/** 크론용 — 가장 오래 확인하지 않은 감시부터 처리한다. */
export async function runChecksForDueWatches(limit = 40): Promise<CheckSummary> {
  const watches = await prisma.watch.findMany({
    where: { active: true },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
  });

  // 같은 사용자의 감시가 여러 개면 설정을 한 번만 읽는다.
  const cache = new Map<string, number>();
  return runChecks(watches, async (userId) => {
    const cached = cache.get(userId);
    if (cached !== undefined) return cached;
    const minScore = await getMinScore(userId);
    cache.set(userId, minScore);
    return minScore;
  });
}
