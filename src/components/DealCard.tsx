"use client";

import { type AlertRow, formatTime, formatWon } from "@/components/types";

/** 프로토타입의 딜 카드 — 출처·제목·할인율·가격·매칭 근거·액션 순서 그대로. */
export default function DealCard({
  alert,
  onDismiss,
}: {
  alert: AlertRow;
  onDismiss: (id: string) => void;
}) {
  const strong = alert.matchScore >= 70;

  return (
    <li className="card-shadow rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wide text-ink-faint">
            {alert.source} · {formatTime(alert.createdAt)}
          </p>
          <p className="mt-1 text-[14.5px] font-bold text-ink">{alert.title}</p>
        </div>
        {alert.discountPercent !== null && (
          <span className="shrink-0 font-mono text-[15px] font-bold text-accent">
            -{alert.discountPercent}%
          </span>
        )}
      </div>

      {(alert.priceWas !== null || alert.priceNow !== null) && (
        <p className="mt-2 flex items-baseline gap-2 font-mono text-[13px]">
          {alert.priceWas !== null && (
            <span className="text-ink-faint line-through">{formatWon(alert.priceWas)}</span>
          )}
          {alert.priceNow !== null && (
            <span className="text-[15px] font-bold text-ink">{formatWon(alert.priceNow)}</span>
          )}
        </p>
      )}

      <div
        className={`mt-2.5 flex items-start gap-[7px] rounded-[9px] px-[11px] py-[9px] text-xs ${
          strong ? "bg-match-soft text-match" : "bg-surface-2 text-ink-soft"
        }`}
      >
        <span aria-hidden>{strong ? "🎯" : "ℹ️"}</span>
        <span>
          <b className="font-bold">일치율 {alert.matchScore}%</b> — {alert.reason}
        </span>
      </div>

      <div className="mt-[9px] flex items-center justify-between">
        {alert.url ? (
          <a
            href={alert.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-accent hover:underline"
          >
            보러 가기 →
          </a>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className="flex h-[30px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-ink-soft hover:border-ink-faint"
        >
          <span aria-hidden>✕</span>
          관심없음
        </button>
      </div>
    </li>
  );
}
