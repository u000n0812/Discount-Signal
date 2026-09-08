/**
 * "이 소식이 내가 기다리던 할인인가?"를 판정하는 부분.
 *
 * 스팀처럼 숫자가 그대로 오는 소스는 규칙으로 계산하고,
 * 브랜드 웹페이지처럼 문장으로만 오는 소스는 Gemini에게 읽혀서 판정한다.
 * Gemini 키가 없거나 실패하면 키워드 기반으로 물러난다(fallback).
 */

import { generateJson } from "@/lib/gemini";
import type { PageSnapshot } from "@/lib/web";
import type { SteamPrice } from "@/lib/steam";

export type MatchInput = {
  label: string;
  condition: string | null;
  minDiscount: number | null;
  targetPrice: number | null;
};

export type MatchResult = {
  matched: boolean;
  /** 0~100. 알림을 보낼지 정하는 일치율 */
  score: number;
  reason: string;
  title: string;
  priceNow: number | null;
  priceWas: number | null;
  discountPercent: number | null;
  /** 같은 세일을 두 번 알리지 않기 위한 식별자 */
  signature: string;
};

const SALE_WORDS = [
  "세일",
  "할인",
  "특가",
  "프로모션",
  "시즌오프",
  "단독가",
  "sale",
  "off",
  "discount",
  "promotion",
];

/** 조건이 하나도 없으면 "할인이 시작되면 알려줘"로 본다. */
function describeCondition(input: MatchInput): string {
  const parts: string[] = [];
  if (input.minDiscount) parts.push(`할인율 ${input.minDiscount}% 이상`);
  if (input.targetPrice) parts.push(`가격 ${input.targetPrice.toLocaleString("ko-KR")}원 이하`);
  if (input.condition) parts.push(input.condition);
  return parts.length ? parts.join(", ") : "할인 시작 여부";
}

/** 스팀은 숫자가 정확히 오므로 AI 없이 규칙으로 판정한다. */
export function matchSteam(price: SteamPrice, input: MatchInput): MatchResult {
  const signature = `steam:${price.appId}:${price.discountPercent}:${price.priceNow ?? "na"}`;
  const reasons: string[] = [];
  const misses: string[] = [];

  const hasCondition = Boolean(input.minDiscount || input.targetPrice);
  const discountOk = input.minDiscount ? price.discountPercent >= input.minDiscount : null;
  const priceOk =
    input.targetPrice && price.priceNow !== null ? price.priceNow <= input.targetPrice : null;

  if (discountOk === true) reasons.push(`할인율 ${price.discountPercent}%로 조건(${input.minDiscount}%↑) 충족`);
  if (discountOk === false) misses.push(`할인율 ${price.discountPercent}%로 조건(${input.minDiscount}%↑) 미달`);
  if (priceOk === true)
    reasons.push(
      `현재가 ${price.priceNow?.toLocaleString("ko-KR")}원으로 목표가(${input.targetPrice?.toLocaleString("ko-KR")}원) 이하`
    );
  if (priceOk === false)
    misses.push(
      `현재가 ${price.priceNow?.toLocaleString("ko-KR")}원으로 목표가(${input.targetPrice?.toLocaleString("ko-KR")}원)보다 높음`
    );

  // 조건을 하나도 안 걸었으면 할인이 시작된 것만으로 알린다.
  const matched = hasCondition
    ? discountOk === true || priceOk === true
    : price.discountPercent > 0;

  if (!hasCondition && matched) reasons.push(`할인 시작 (${price.discountPercent}% 인하)`);
  if (!hasCondition && !matched) misses.push("아직 정가 판매 중");

  const score = matched
    ? Math.min(100, 70 + Math.round(price.discountPercent * 0.3) + (discountOk && priceOk ? 10 : 0))
    : Math.min(60, price.discountPercent);

  return {
    matched,
    score,
    reason: (matched ? reasons : misses).join(" · ") || "판정할 정보가 부족해요.",
    title: price.name,
    priceNow: price.priceNow,
    priceWas: price.priceWas,
    discountPercent: price.discountPercent,
    signature,
  };
}

type GeminiVerdict = {
  isSale?: boolean;
  headline?: string;
  discountPercent?: number | null;
  matched?: boolean;
  score?: number;
  reason?: string;
};

/** 브랜드 페이지 본문을 Gemini에게 읽혀 세일 여부와 조건 충족을 판정한다. */
export async function matchWebPage(
  snapshot: PageSnapshot,
  input: MatchInput
): Promise<MatchResult> {
  const conditionText = describeCondition(input);

  let verdict: GeminiVerdict | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      verdict = (await generateJson(
        `당신은 쇼핑몰 페이지를 읽고 "지금 세일 중인지"를 판정하는 분석기입니다.

감시 대상: ${input.label}
사용자가 등록한 알림 조건: ${conditionText}

아래는 ${snapshot.host} 페이지에서 추출한 텍스트입니다.
"""
${snapshot.text}
"""

판정 지침
- 페이지에 실제로 적힌 내용만 근거로 삼고, 없는 할인율이나 품목을 지어내지 마세요.
- 상시 노출되는 메뉴 이름(예: SALE 카테고리 링크)만 있고 실제 할인 안내가 없으면 isSale은 false입니다.
- discountPercent는 페이지에 적힌 최대 할인율의 숫자만 넣고, 없으면 null로 두세요.
- matched는 위 알림 조건을 충족했을 때만 true로 하세요.
- reason은 한국어 한 문장으로, 어떤 근거로 그렇게 판정했는지 적으세요.

아래 JSON 형식으로만 답하세요. 다른 설명이나 마크다운은 절대 포함하지 마세요.
{
  "isSale": true 또는 false,
  "headline": "세일을 한 줄로 요약 (없으면 빈 문자열)",
  "discountPercent": 숫자 또는 null,
  "matched": true 또는 false,
  "score": 0에서 100 사이 정수,
  "reason": "판정 근거 한 문장"
}`,
        0.2
      )) as GeminiVerdict;
    } catch (error) {
      console.error("[signal] Gemini 판정 실패, 키워드 판정으로 대체", error);
    }
  }

  if (verdict && typeof verdict.matched === "boolean") {
    const discount = typeof verdict.discountPercent === "number" ? verdict.discountPercent : null;
    const headline = verdict.headline?.trim() || snapshot.title;
    return {
      matched: verdict.matched && Boolean(verdict.isSale),
      score: clampScore(verdict.score, verdict.matched ? 75 : 30),
      reason: verdict.reason?.trim() || "AI 판정 근거를 받지 못했어요.",
      title: headline,
      priceNow: null,
      priceWas: null,
      discountPercent: discount,
      signature: `web:${snapshot.host}:${discount ?? "na"}:${normalize(headline)}`,
    };
  }

  return keywordFallback(snapshot, input);
}

function clampScore(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Gemini를 못 쓸 때: 세일 단어 + 할인율 숫자만으로 판정한다. */
function keywordFallback(snapshot: PageSnapshot, input: MatchInput): MatchResult {
  const haystack = `${snapshot.title}\n${snapshot.text}`.toLowerCase();
  const hits = SALE_WORDS.filter((word) => haystack.includes(word));
  const discount = snapshot.maxPercentHint;
  const meetsDiscount = input.minDiscount ? (discount ?? 0) >= input.minDiscount : true;
  const matched = hits.length > 0 && meetsDiscount;

  const reason = matched
    ? `페이지에서 '${hits.slice(0, 3).join("', '")}' 문구${discount ? `와 최대 ${discount}% 표기` : ""}를 확인 (키워드 판정)`
    : hits.length === 0
      ? "페이지에서 할인 관련 문구를 찾지 못했어요. (키워드 판정)"
      : `할인 문구는 있지만 ${input.minDiscount}% 조건에는 못 미쳐요. (키워드 판정)`;

  // 할인율 숫자까지 조건을 만족하면 확신이 더 크다. 기본 민감도(70%)를
  // 넘지 못하면 키가 없는 설치에서는 알림이 영영 가지 않으므로 여기서 갈라준다.
  const score = matched ? (discount !== null && input.minDiscount ? 80 : 70) : 20;

  return {
    matched,
    score,
    reason,
    title: snapshot.title,
    priceNow: null,
    priceWas: null,
    discountPercent: discount,
    signature: `web:${snapshot.host}:${discount ?? "na"}:${hits.join(",")}`,
  };
}
