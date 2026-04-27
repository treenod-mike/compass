"use client"

import type { CountryCode, Genre, Platform } from "@/shared/api/cpi-benchmarks"
import type { MarketingSimState } from "../lib/use-marketing-sim"

const COUNTRIES: { value: CountryCode; label: string }[] = [
  { value: "JP", label: "JP — 일본" },
  { value: "US", label: "US — 미국" },
  { value: "KR", label: "KR — 한국" },
  { value: "DE", label: "DE — 독일" },
  { value: "GB", label: "GB — 영국" },
  { value: "FR", label: "FR — 프랑스" },
  { value: "CN", label: "CN — 중국" },
  { value: "TW", label: "TW — 대만" },
  { value: "HK", label: "HK — 홍콩" },
  { value: "SG", label: "SG — 싱가포르" },
  { value: "TH", label: "TH — 태국" },
  { value: "ID", label: "ID — 인도네시아" },
  { value: "VN", label: "VN — 베트남" },
  { value: "BR", label: "BR — 브라질" },
  { value: "MX", label: "MX — 멕시코" },
  { value: "CA", label: "CA — 캐나다" },
  { value: "AU", label: "AU — 호주" },
  { value: "IN", label: "IN — 인도" },
  { value: "RU", label: "RU — 러시아" },
  { value: "TR", label: "TR — 튀르키예" },
  { value: "ES", label: "ES — 스페인" },
  { value: "IT", label: "IT — 이탈리아" },
  { value: "NL", label: "NL — 네덜란드" },
  { value: "SE", label: "SE — 스웨덴" },
  { value: "PL", label: "PL — 폴란드" },
]

const GENRES: { value: Genre; label: string }[] = [
  { value: "merge", label: "Merge" },
  { value: "puzzle", label: "Puzzle" },
  { value: "rpg", label: "RPG" },
  { value: "casual", label: "Casual" },
  { value: "strategy", label: "Strategy" },
  { value: "idle", label: "Idle" },
  { value: "simulation", label: "Simulation" },
  { value: "arcade", label: "Arcade" },
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
]

type Props = {
  state: MarketingSimState
  onChange: (next: MarketingSimState) => void
  cpiUsd: number | null
  cpiUsedFallback: boolean
}

export function MarketingSimControls({ state, onChange, cpiUsd, cpiUsedFallback }: Props) {
  const update = <K extends keyof MarketingSimState>(key: K, value: MarketingSimState[K]) => {
    onChange({ ...state, [key]: value })
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--fg-2)]">
        시뮬레이션 입력
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Country">
          <select
            value={state.country}
            onChange={(e) => update("country", e.target.value as CountryCode)}
            className={selectClass}
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Genre">
          <select
            value={state.genre}
            onChange={(e) => update("genre", e.target.value as Genre)}
            className={selectClass}
          >
            {GENRES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Platform">
          <select
            value={state.platform}
            onChange={(e) => update("platform", e.target.value as Platform)}
            className={selectClass}
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-[var(--radius-inline)] bg-[var(--bg-2)] px-3 py-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[var(--fg-2)]">CPI</span>
          {cpiUsd === null ? (
            <span className="font-bold text-[var(--signal-risk)]">데이터 없음</span>
          ) : (
            <span className="font-bold text-[var(--fg-0)] tabular-nums">
              ${cpiUsd.toFixed(2)}
              {cpiUsedFallback && (
                <span className="ml-1 text-[10px] font-medium text-[var(--signal-caution)]">
                  ⚠ fallback
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <SliderRow
        label="UA budget"
        suffix="USD/day"
        value={state.uaBudgetUsdPerDay}
        min={100}
        max={50000}
        step={100}
        format={(v) => `$${v.toLocaleString()}`}
        onChange={(v) => update("uaBudgetUsdPerDay", v)}
      />

      <SliderRow
        label="목표 ARPDAU"
        suffix="USD"
        value={state.targetArpdauUsd}
        min={0.05}
        max={3.0}
        step={0.01}
        format={(v) => `$${v.toFixed(2)}`}
        onChange={(v) => update("targetArpdauUsd", v)}
      />
    </div>
  )
}

const selectClass =
  "w-full rounded-[var(--radius-inline)] border border-[var(--bg-3)] bg-[var(--bg-0)] px-2 py-1.5 text-xs text-[var(--fg-0)] focus:border-[var(--brand)] focus:outline-none"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-2)]">
        {label}
      </span>
      {children}
    </label>
  )
}

function SliderRow({
  label,
  suffix,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-2)]">
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums text-[var(--fg-0)]">
          {format(value)}
          <span className="ml-1 text-[10px] font-medium text-[var(--fg-2)]">{suffix}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--brand)]"
      />
    </div>
  )
}
