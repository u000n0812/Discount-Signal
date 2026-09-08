/**
 * 스팀 상점의 공개(비공식) JSON 엔드포인트로 게임 가격과 할인율을 읽는다.
 * 키가 필요 없는 대신 문서화되지 않은 API라, IP당 5분에 200회 정도로
 * 제한이 걸린다고 알려져 있어 호출을 최소로 유지한다.
 */

const SEARCH_URL = "https://store.steampowered.com/api/storesearch/";
const DETAIL_URL = "https://store.steampowered.com/api/appdetails";
const TIMEOUT_MS = 10_000;

export type SteamSearchItem = {
  appId: number;
  name: string;
  image: string | null;
  priceNow: number | null;
  priceWas: number | null;
  discountPercent: number | null;
};

export type SteamPrice = {
  appId: number;
  name: string;
  /** 무료거나 아직 출시 전이면 가격 정보가 없다. */
  priceNow: number | null;
  priceWas: number | null;
  discountPercent: number;
  currency: string;
  url: string;
};

/**
 * 스팀은 가격을 통화의 최소 단위(센트)로 돌려준다. 원화도 100을 곱한 값이라
 * 100으로 나눠 실제 원화 금액으로 맞춘다.
 */
function toMajorUnit(minorUnits: number | undefined | null): number | null {
  if (typeof minorUnits !== "number" || Number.isNaN(minorUnits)) return null;
  return Math.round(minorUnits / 100);
}

/** "₩ 7,750" 처럼 포맷된 문자열이 오면 그 숫자를 그대로 믿는다. */
function fromFormatted(formatted: string | undefined): number | null {
  if (!formatted) return null;
  const digits = formatted.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "Accept-Language": "ko-KR,ko" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    // 429는 호출이 몰렸을 때, 403은 지역 차단이나 차단된 네트워크일 때 주로 난다.
    throw new Error(
      response.status === 429
        ? "스팀 호출이 잠시 많았어요. 몇 분 뒤에 다시 시도해주세요."
        : `스팀에 연결하지 못했어요 (${response.status}).`
    );
  }
  return response.json();
}

export function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

/** 감시를 등록할 때 게임 제목으로 appId를 찾는다. */
export async function searchSteamApps(term: string): Promise<SteamSearchItem[]> {
  const url = `${SEARCH_URL}?term=${encodeURIComponent(term)}&l=koreana&cc=KR`;
  const data = (await getJson(url)) as {
    items?: {
      id: number;
      name: string;
      tiny_image?: string;
      price?: { initial?: number; final?: number; discount_percent?: number };
    }[];
  };

  return (data.items ?? []).slice(0, 8).map((item) => ({
    appId: item.id,
    name: item.name,
    image: item.tiny_image ?? null,
    priceNow: toMajorUnit(item.price?.final),
    priceWas: toMajorUnit(item.price?.initial),
    discountPercent: item.price?.discount_percent ?? null,
  }));
}

/** 감시 중인 게임의 현재 가격을 읽는다. */
export async function fetchSteamPrice(appId: number): Promise<SteamPrice> {
  const url = `${DETAIL_URL}?appids=${appId}&cc=kr&l=koreana&filters=price_overview,basic`;
  const data = (await getJson(url)) as Record<
    string,
    {
      success?: boolean;
      data?: {
        name?: string;
        is_free?: boolean;
        price_overview?: {
          currency?: string;
          initial?: number;
          final?: number;
          discount_percent?: number;
          initial_formatted?: string;
          final_formatted?: string;
        };
      };
    }
  >;

  const entry = data[String(appId)];
  if (!entry?.success || !entry.data) {
    throw new Error("스팀에서 이 게임을 찾지 못했어요. appId를 확인해주세요.");
  }

  const price = entry.data.price_overview;
  return {
    appId,
    name: entry.data.name ?? `앱 ${appId}`,
    priceNow: fromFormatted(price?.final_formatted) ?? toMajorUnit(price?.final),
    priceWas: fromFormatted(price?.initial_formatted) ?? toMajorUnit(price?.initial),
    discountPercent: price?.discount_percent ?? 0,
    currency: price?.currency ?? "KRW",
    url: steamStoreUrl(appId),
  };
}
