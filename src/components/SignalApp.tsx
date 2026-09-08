"use client";

import { useState } from "react";
import DealCard from "@/components/DealCard";
import InterestScreen from "@/components/InterestScreen";
import SettingsScreen from "@/components/SettingsScreen";
import { formatTime, type AlertRow, type SettingRow, type WatchRow } from "@/components/types";

type Screen = "interest" | "feed" | "settings";

const TABS = [
  { key: "interest" as const, icon: "＋", label: "관심사" },
  { key: "feed" as const, icon: "▤", label: "피드" },
  { key: "settings" as const, icon: "⚙", label: "설정" },
];

export default function SignalApp({
  initialWatches,
  initialAlerts,
  initialSetting,
}: {
  initialWatches: WatchRow[];
  initialAlerts: AlertRow[];
  initialSetting: SettingRow;
}) {
  const [screen, setScreen] = useState<Screen>(initialWatches.length ? "feed" : "interest");
  const [watches, setWatches] = useState(initialWatches);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [setting, setSetting] = useState(initialSetting);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const lastChecked = watches
    .map((watch) => watch.lastCheckedAt)
    .filter((value): value is Date | string => Boolean(value))
    .sort()
    .at(-1);

  async function checkNow() {
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/check", { method: "POST" });
      const data = (await response.json()) as {
        summary?: { checked: number; created: number; failed: number };
        watches?: WatchRow[];
        alerts?: AlertRow[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "확인에 실패했어요.");

      if (data.watches) setWatches(data.watches);
      if (data.alerts) setAlerts(data.alerts);

      const created = data.summary?.created ?? 0;
      const failed = data.summary?.failed ?? 0;
      setMessage(
        created > 0
          ? `조건에 맞는 할인 ${created}건을 찾았어요.`
          : `${data.summary?.checked ?? 0}건을 확인했지만 조건에 맞는 할인은 없었어요.` +
              (failed ? ` (${failed}건 확인 실패)` : "")
      );
      if (created > 0 && setting.browserNotify) notifyNewDeals(created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "확인에 실패했어요.");
    } finally {
      setChecking(false);
    }
  }

  /** 탭이 열려 있는 동안에는 브라우저 알림으로도 알려준다. */
  function notifyNewDeals(count: number) {
    if (typeof Notification === "undefined") return;
    const show = () => new Notification("시그널", { body: `조건에 맞는 할인 ${count}건이 있어요.` });
    if (Notification.permission === "granted") show();
    else if (Notification.permission === "default") {
      Notification.requestPermission().then((result) => {
        if (result === "granted") show();
      });
    }
  }

  async function dismissAlert(id: string) {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function toggleWatch(watch: WatchRow) {
    const next = !watch.active;
    setWatches((current) =>
      current.map((item) => (item.id === watch.id ? { ...item, active: next } : item))
    );
    await fetch(`/api/watches/${watch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    }).catch(() => {});
  }

  async function removeWatch(id: string) {
    setWatches((current) => current.filter((watch) => watch.id !== id));
    // 관심사를 지우면 그 관심사가 만든 알림도 함께 사라진다(DB에서도 cascade 삭제).
    setAlerts((current) => current.filter((alert) => alert.watchId !== id));
    await fetch(`/api/watches/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function saveSetting(next: Partial<SettingRow>) {
    setSetting((current) => ({ ...current, ...next }));
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[460px] flex-col border-line bg-surface sm:my-8 sm:min-h-[720px] sm:rounded-[28px] sm:border sm:shadow-[0_1px_2px_rgba(20,24,20,.04),0_8px_24px_-12px_rgba(20,24,20,.18)]">
      <div className="flex items-center justify-between px-5 pt-4 font-mono text-[11px] text-ink-faint">
        <span>{lastChecked ? `마지막 확인 ${formatTime(lastChecked)}` : "확인 전"}</span>
        <span>SIGNAL</span>
      </div>

      <header className="flex items-center justify-between border-b border-line px-5 pt-1.5 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="h-[7px] w-[7px] rounded-full bg-accent shadow-[0_0_0_4px_var(--color-accent-soft)]" />
          <span className="font-display text-base font-bold text-ink">시그널</span>
        </div>
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-sm">
          <span aria-hidden>🔔</span>
          {alerts.length > 0 && (
            <span className="absolute -top-[3px] -right-[3px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-white">
              {alerts.length}
            </span>
          )}
          <span className="sr-only">읽지 않은 알림 {alerts.length}건</span>
        </div>
      </header>

      <main className="flex-1 px-5 pt-4.5 pb-6">
        {screen === "feed" && (
          <div>
            <p className="mb-3.5 font-mono text-xs tracking-[0.06em] text-ink-faint uppercase">
              오늘의 매칭 ({alerts.length})
            </p>

            <button
              type="button"
              onClick={checkNow}
              disabled={checking || watches.length === 0}
              className="mb-2 w-full rounded-[10px] bg-accent py-3 font-display text-sm font-bold text-white transition-opacity disabled:opacity-40"
            >
              {checking ? "확인하는 중…" : "지금 확인"}
            </button>
            {message && <p className="mb-3 text-xs text-ink-soft">{message}</p>}

            {alerts.length === 0 ? (
              <p className="mt-3 rounded-[14px] border border-dashed border-line px-5 py-10 text-center text-xs text-ink-faint">
                {watches.length === 0
                  ? "관심사 탭에서 지켜볼 게임이나 브랜드를 먼저 등록해주세요."
                  : "아직 조건에 맞는 할인이 없어요. 조건에 맞을 때만 여기에 쌓입니다."}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {alerts.map((alert) => (
                  <DealCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
                ))}
              </ul>
            )}
          </div>
        )}

        {screen === "interest" && (
          <InterestScreen
            watches={watches}
            onCreated={(watch) => setWatches((current) => [watch, ...current])}
            onToggle={toggleWatch}
            onRemove={removeWatch}
            onGoFeed={() => setScreen("feed")}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen setting={setting} watches={watches} onChange={saveSetting} />
        )}
      </main>

      <nav className="sticky bottom-0 flex border-t border-line bg-surface sm:rounded-b-[28px]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setScreen(tab.key)}
            aria-current={screen === tab.key ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-3 font-display text-[11px] font-semibold transition-colors ${
              screen === tab.key ? "text-accent" : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            <span className="text-[17px]" aria-hidden>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
