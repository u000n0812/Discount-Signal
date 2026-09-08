/**
 * 브랜드 웹사이트(벨리에 등)를 읽어오는 어댑터.
 *
 * 사이트마다 HTML 구조가 달라서 선택자를 하드코딩하지 않는다. 대신
 *   1) robots.txt를 확인해 수집이 허용된 경로만 읽고
 *   2) 본문을 텍스트로 눌러서
 *   3) 세일 여부 판단은 match.ts의 AI 판정에 넘긴다.
 * 덕분에 사용자가 등록한 어떤 브랜드 URL이든 같은 코드로 감시할 수 있다.
 */

/** HTTP 헤더는 latin-1만 담을 수 있어 한글을 넣으면 요청 자체가 실패한다. */
const USER_AGENT = "SignalDealWatcher/0.1 (personal deal alert bot; respects robots.txt)";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 800_000;
/** AI에 넘길 본문 길이. 너무 길면 토큰만 쓰고 정확도는 나아지지 않는다. */
const MAX_TEXT_CHARS = 6_000;

export type PageSnapshot = {
  url: string;
  host: string;
  title: string;
  text: string;
  /** 본문에서 찾은 "30%" 같은 할인율 후보 중 가장 큰 값 */
  maxPercentHint: number | null;
};

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`이 사이트의 robots.txt가 ${url} 수집을 허용하지 않아요.`);
    this.name = "RobotsDisallowedError";
  }
}

async function getText(url: string, timeout = TIMEOUT_MS): Promise<string | null> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain,*/*" },
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
  }
  await reader.cancel().catch(() => {});

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk.subarray(0, Math.min(chunk.length, received - offset)), offset);
    offset += chunk.length;
    if (offset >= received) break;
  }
  return new TextDecoder("utf-8").decode(merged);
}

/**
 * robots.txt에서 우리에게 적용되는 규칙만 골라 경로 허용 여부를 본다.
 * 와일드카드까지 완벽히 해석하지는 않지만, 접두사 규칙은 지킨다.
 */
export async function isAllowedByRobots(target: URL): Promise<boolean> {
  let body: string | null = null;
  try {
    body = await getText(new URL("/robots.txt", target).toString(), 8_000);
  } catch {
    // robots.txt를 못 읽으면 명시적 금지가 없는 것으로 본다.
    return true;
  }
  if (!body) return true;

  const rules: string[] = [];
  let applies = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      applies = value === "*" || USER_AGENT.toLowerCase().includes(value.toLowerCase());
      continue;
    }
    if (applies && key === "disallow" && value) rules.push(value);
    if (applies && key === "allow" && value) rules.push(`!${value}`);
  }

  const path = target.pathname + target.search;
  let blocked = false;
  for (const rule of rules) {
    const allow = rule.startsWith("!");
    const prefix = (allow ? rule.slice(1) : rule).replace(/\*.*$/, "");
    if (prefix && path.startsWith(prefix)) blocked = !allow;
    if (prefix === "/" && !allow) blocked = true;
  }
  return !blocked;
}

/** HTML을 사람이 읽는 텍스트로 눌러 담는다. */
function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  return { title, text };
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function maxPercent(text: string): number | null {
  const found = [...text.matchAll(/(\d{1,2})\s?%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 5 && value <= 95);
  return found.length ? Math.max(...found) : null;
}

/** 감시 대상 페이지를 한 번 읽어 스냅샷으로 만든다. */
export async function fetchPageSnapshot(rawUrl: string): Promise<PageSnapshot> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("http(s) 주소만 감시할 수 있어요.");
  }

  if (!(await isAllowedByRobots(url))) {
    throw new RobotsDisallowedError(url.toString());
  }

  const html = await getText(url.toString());
  if (!html) throw new Error("페이지를 불러오지 못했어요.");

  const { title, text } = htmlToText(html);
  return {
    url: url.toString(),
    host: url.host,
    title: title || url.host,
    text: text.slice(0, MAX_TEXT_CHARS),
    maxPercentHint: maxPercent(text),
  };
}
