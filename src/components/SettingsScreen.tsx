"use client";

import { useState } from "react";
import { describeWatch, type SettingRow, type WatchRow } from "@/components/types";

function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[23px] w-10 shrink-0 rounded-full border transition-colors ${
        on ? "border-accent bg-accent" : "border-line bg-surface-2"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] h-[17px] w-[17px] rounded-full bg-surface shadow transition-transform ${
          on ? "translate-x-[17px] bg-white" : ""
        }`}
      />
    </button>
  );
}

export default function SettingsScreen({
  setting,
  watches,
  onChange,
}: {
  setting: SettingRow;
  watches: WatchRow[];
  onChange: (next: Partial<SettingRow>) => void;
}) {
  // 슬라이더는 손에서 놓을 때 저장한다. 끄는 동안 매번 저장하면 요청만 늘어난다.
  const [draftScore, setDraftScore] = useState(setting.minScore);

  return (
    <div>
      <p className="mb-3.5 font-mono text-xs tracking-[0.06em] text-ink-faint uppercase">
        알림 설정
      </p>

      <section className="mb-6">
        <h3 className="mb-2.5 font-mono text-[11px] tracking-[0.06em] text-ink-faint uppercase">
          알림 채널
        </h3>
        <div className="flex items-center justify-between border-b border-line py-3">
          <div>
            <p className="text-[13.5px] font-semibold text-ink">브라우저 알림</p>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">탭이 열려 있을 때 바로 띄워요</p>
          </div>
          <Toggle
            label="브라우저 알림"
            on={setting.browserNotify}
            onChange={(next) => onChange({ browserNotify: next })}
          />
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-[13.5px] font-semibold text-ink">이메일 · 카카오톡</p>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">추후 지원 예정</p>
          </div>
          <Toggle label="이메일 알림" on={false} disabled onChange={() => {}} />
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2.5 font-mono text-[11px] tracking-[0.06em] text-ink-faint uppercase">
          매칭 민감도
        </h3>
        <p className="text-[11.5px] text-ink-faint">
          낮을수록 더 많이, 높을수록 확실한 것만{" "}
          <span className="font-mono font-bold text-accent">{draftScore}%</span>
        </p>
        <input
          type="range"
          min={30}
          max={95}
          value={draftScore}
          aria-label="매칭 민감도"
          onChange={(event) => setDraftScore(Number(event.target.value))}
          onPointerUp={() => onChange({ minScore: draftScore })}
          onKeyUp={() => onChange({ minScore: draftScore })}
          className="mt-2 w-full"
        />
      </section>

      <section>
        <h3 className="mb-2.5 font-mono text-[11px] tracking-[0.06em] text-ink-faint uppercase">
          등록된 관심사
        </h3>
        <div className="flex flex-wrap gap-2">
          {watches.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">관심사 탭에서 먼저 등록해보세요.</p>
          ) : (
            watches.map((watch) => (
              <span
                key={watch.id}
                className="rounded-full bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink-soft"
              >
                {watch.label} · {describeWatch(watch)}
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
