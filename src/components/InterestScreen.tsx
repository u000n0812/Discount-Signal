"use client";

import { useEffect, useRef, useState } from "react";
import { describeWatch, formatTime, type WatchRow } from "@/components/types";

type SteamItem = {
  appId: number;
  name: string;
  priceNow: number | null;
  discountPercent: number | null;
};

/** 벨리에처럼 자주 쓰는 곳은 버튼 한 번으로 채운다. */
const QUICK_ADDS = [
  { kind: "WEB" as const, label: "벨리에 공식몰", url: "https://belier.co.kr/" },
  { kind: "WEB" as const, label: "벨리에 (무신사)", url: "https://www.musinsa.com/brand/belier" },
  { kind: "STEAM" as const, label: "스팀 게임 검색", url: null },
];

const inputClass =
  "w-full rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none";

export default function InterestScreen({
  watches,
  onCreated,
  onToggle,
  onRemove,
  onGoFeed,
}: {
  watches: WatchRow[];
  onCreated: (watch: WatchRow) => void;
  onToggle: (watch: WatchRow) => void;
  onRemove: (id: string) => void;
  onGoFeed: () => void;
}) {
  const [kind, setKind] = useState<"STEAM" | "WEB">("STEAM");
  const [minDiscount, setMinDiscount] = useState("30");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [term, setTerm] = useState("");
  const [items, setItems] = useState<SteamItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SteamItem | null>(null);

  const [url, setUrl] = useState("");
  const [brandLabel, setBrandLabel] = useState("");

  const searchSeq = useRef(0);

  useEffect(() => {
    if (kind !== "STEAM" || picked || term.trim().length < 2) return;

    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/steam-search?q=${encodeURIComponent(term.trim())}`);
        const data = (await response.json()) as { items?: SteamItem[] };
        // 입력이 그 사이 또 바뀌었으면 늦게 온 결과는 버린다.
        if (seq === searchSeq.current) setItems(data.items ?? []);
      } catch {
        if (seq === searchSeq.current) setItems([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [term, kind, picked]);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          steamAppId: kind === "STEAM" ? picked?.appId : undefined,
          label: kind === "STEAM" ? picked?.name : brandLabel || undefined,
          url: kind === "WEB" ? url : undefined,
          condition: condition || undefined,
          minDiscount: minDiscount ? Number(minDiscount) : undefined,
          targetPrice: targetPrice ? Number(targetPrice) : undefined,
        }),
      });
      const data = (await response.json()) as { watch?: WatchRow; error?: string };
      if (!response.ok || !data.watch) throw new Error(data.error ?? "등록에 실패했어요.");

      onCreated(data.watch);
      setPicked(null);
      setTerm("");
      setUrl("");
      setBrandLabel("");
      setCondition("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = kind === "STEAM" ? Boolean(picked) : url.trim().length > 3;
  // 검색어를 지우거나 게임을 고르면 이전 결과는 화면에서 감춘다.
  const visibleItems = kind === "STEAM" && !picked && term.trim().length >= 2 ? items : [];

  return (
    <div>
      <p className="mb-3.5 font-mono text-xs tracking-[0.06em] text-ink-faint uppercase">
        관심사 등록
      </p>

      <p className="text-[13px] font-semibold text-ink">무엇을 지켜볼까요?</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        스팀 게임은 이름으로, 브랜드는 주소로 등록해요.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { key: "STEAM", label: "스팀 게임" },
            { key: "WEB", label: "브랜드 사이트" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setKind(tab.key);
              setError(null);
            }}
            className={`rounded-full border px-3 py-[7px] font-mono text-xs transition-colors ${
              kind === tab.key
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-ink-soft hover:border-accent hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {kind === "STEAM" ? (
        <div className="mt-3">
          {picked ? (
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-accent bg-accent-soft px-3 py-2.5">
              <span className="truncate text-[13.5px] font-semibold text-ink">{picked.name}</span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="shrink-0 text-xs text-ink-soft hover:text-ink"
              >
                변경
              </button>
            </div>
          ) : (
            <>
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="예: Hollow Knight, 발더스 게이트"
                aria-label="게임 이름으로 찾기"
                className={inputClass}
              />
              {searching && <p className="mt-2 text-xs text-ink-faint">검색 중…</p>}
              {visibleItems.length > 0 && (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[10px] border border-line">
                  {visibleItems.map((item) => (
                    <li key={item.appId}>
                      <button
                        type="button"
                        onClick={() => setPicked(item)}
                        className="flex w-full items-center justify-between gap-3 bg-surface px-3 py-2.5 text-left hover:bg-surface-2"
                      >
                        <span className="truncate text-[13px] text-ink">{item.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                          {item.priceNow === null
                            ? "가격 미정"
                            : `${item.priceNow.toLocaleString("ko-KR")}원`}
                          {item.discountPercent ? ` · -${item.discountPercent}%` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://belier.co.kr/"
            aria-label="감시할 주소"
            className={inputClass}
          />
          <input
            value={brandLabel}
            onChange={(event) => setBrandLabel(event.target.value)}
            placeholder="목록에 표시할 이름 (예: 벨리에)"
            aria-label="목록에 표시할 이름"
            className={inputClass}
          />
        </div>
      )}

      <p className="mt-5 text-[13px] font-semibold text-ink">빠른 추가</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_ADDS.map((quick) => (
          <button
            key={quick.label}
            type="button"
            onClick={() => {
              setKind(quick.kind);
              setError(null);
              if (quick.url) {
                setUrl(quick.url);
                setBrandLabel(quick.label);
              }
            }}
            className="rounded-full border border-line bg-surface px-3 py-[7px] font-mono text-xs text-ink-soft transition-colors hover:border-accent hover:text-ink"
          >
            {quick.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[13px] font-semibold text-ink">알림 조건</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        둘 중 하나만 충족해도 알려드려요. 비우면 할인이 시작될 때 알려드려요.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint">최소 할인율 (%)</span>
          <input
            inputMode="numeric"
            value={minDiscount}
            onChange={(event) => setMinDiscount(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="30"
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint">목표가 (원)</span>
          <input
            inputMode="numeric"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="선택"
            className={`${inputClass} font-mono`}
          />
        </label>
      </div>
      <input
        value={condition}
        onChange={(event) => setCondition(event.target.value)}
        placeholder="추가 조건 (선택) — 예: 아우터만, DLC 말고 본편"
        aria-label="추가 조건"
        className={`${inputClass} mt-2`}
      />

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit || saving}
        onClick={submit}
        className="mt-4 w-full rounded-[10px] bg-accent py-3 font-display text-sm font-bold text-white transition-opacity disabled:opacity-40"
      >
        {saving ? "등록하는 중…" : "관심사 추가"}
      </button>

      <p className="mt-6 text-[13px] font-semibold text-ink">
        등록된 관심사 <span className="font-mono text-accent">{watches.length}</span>
      </p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {watches.length === 0 && (
          <li className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-xs text-ink-faint">
            아직 등록한 관심사가 없어요.
          </li>
        )}
        {watches.map((watch) => (
          <li
            key={watch.id}
            className={`card-shadow rounded-[14px] border border-line bg-surface px-4 py-3 ${
              watch.active ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-ink">
                  <span className="mr-1.5 font-mono text-[10px] text-ink-faint">
                    {watch.kind === "STEAM" ? "STEAM" : "WEB"}
                  </span>
                  {watch.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                  {describeWatch(watch)} · {formatTime(watch.lastCheckedAt)}
                </p>
                {watch.lastError && (
                  <p className="mt-1 text-[11px] text-danger">확인 실패: {watch.lastError}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(watch)}
                  className="text-xs text-ink-soft hover:text-ink"
                >
                  {watch.active ? "끄기" : "켜기"}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(watch.id)}
                  aria-label={`${watch.label} 관심사 삭제`}
                  className="text-xs text-ink-soft hover:text-danger"
                >
                  삭제
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {watches.length > 0 && (
        <button
          type="button"
          onClick={onGoFeed}
          className="mt-5 w-full rounded-[10px] bg-surface-2 py-3 font-display text-sm font-bold text-ink"
        >
          피드에서 매칭 결과 보기 →
        </button>
      )}
    </div>
  );
}
