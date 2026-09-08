/**
 * 서버에서 바로 넘어온 Prisma 행과 fetch로 받은 JSON을 같이 다루려고
 * 날짜를 Date | string 둘 다 허용하는 표시용 타입을 따로 둔다.
 */

export type WatchRow = {
  id: string;
  kind: "STEAM" | "WEB";
  label: string;
  condition: string | null;
  minDiscount: number | null;
  targetPrice: number | null;
  steamAppId: number | null;
  url: string | null;
  active: boolean;
  lastCheckedAt: Date | string | null;
  lastError: string | null;
};

export type AlertRow = {
  id: string;
  watchId: string;
  title: string;
  source: string;
  url: string | null;
  priceNow: number | null;
  priceWas: number | null;
  discountPercent: number | null;
  matchScore: number;
  reason: string;
  createdAt: Date | string;
};

export type SettingRow = {
  minScore: number;
  browserNotify: boolean;
};

/**
 * 서버는 UTC로, 브라우저는 사용자의 시간대로 돌아서 시간대를 고정하지 않으면
 * 서버 렌더 결과와 클라이언트 렌더 결과가 어긋나 hydration이 깨진다.
 */
const TIME_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatTime(value: Date | string | null): string {
  if (!value) return "확인 전";
  const date = typeof value === "string" ? new Date(value) : value;
  // 서버(UTC)와 브라우저의 시간대·로케일 데이터가 달라 문자열이 어긋나면
  // hydration이 깨지므로, 시간대를 고정하고 조각을 직접 조립한다.
  const parts = Object.fromEntries(
    TIME_PARTS.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.month}월 ${parts.day}일 ${parts.hour}:${parts.minute}`;
}

export function formatWon(value: number | null): string | null {
  return value === null ? null : `${value.toLocaleString("ko-KR")}원`;
}

/** 감시 조건을 사람이 읽는 한 줄로 되돌린다. */
export function describeWatch(watch: WatchRow): string {
  const parts: string[] = [];
  if (watch.minDiscount) parts.push(`${watch.minDiscount}%↑`);
  if (watch.targetPrice) parts.push(`${watch.targetPrice.toLocaleString("ko-KR")}원↓`);
  if (watch.condition) parts.push(watch.condition);
  return parts.length ? parts.join(" · ") : "할인 시작 시";
}
