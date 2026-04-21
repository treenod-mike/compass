"use client"

import { Icon as Iconify } from "@iconify/react"
import altArrowRightBold from "@iconify-icons/solar/alt-arrow-right-bold"
import type {
  Connection,
  ConnectionStatus,
} from "@/shared/api/mock-connections"
import { cn } from "@/shared/lib/utils"
import snapshotJson from "@/shared/api/data/appsflyer/snapshot.json"
import {
  deriveCardFromSnapshot,
  EMPTY_CARD,
} from "@/shared/api/appsflyer/snapshot-derive"
import { SnapshotSchema } from "@/shared/api/appsflyer/types"

function getAppsFlyerLiveCard() {
  const parsed = SnapshotSchema.safeParse(snapshotJson)
  if (!parsed.success) return EMPTY_CARD
  if (Date.parse(parsed.data.fetchedAt) <= 0) return EMPTY_CARD
  return deriveCardFromSnapshot(parsed.data)
}

type ConnectionCardProps = {
  connection: Connection
  onClick: () => void
}

const STATUS_STYLE: Record<
  ConnectionStatus,
  { label: string; dot: string; pill: string }
> = {
  connected: {
    label: "연결됨",
    dot: "bg-success",
    pill: "bg-success/15 text-success",
  },
  warn: {
    label: "검토 필요",
    dot: "bg-warning",
    pill: "bg-warning/20 text-warning",
  },
  error: {
    label: "에러",
    dot: "bg-destructive",
    pill: "bg-destructive/15 text-destructive",
  },
  disconnected: {
    label: "미연결",
    dot: "bg-muted-foreground/60",
    pill: "bg-muted text-muted-foreground",
  },
}

const PRIMARY_CTA: Record<ConnectionStatus, string> = {
  connected: "관리",
  warn: "재인증",
  error: "확인",
  disconnected: "연결하기",
}

export function ConnectionCard({ connection, onClick }: ConnectionCardProps) {
  const live =
    connection.id === "appsflyer" ? getAppsFlyerLiveCard() : null

  const effective: Connection = live
    ? {
        ...connection,
        status: live.status,
        lastSync: live.lastSync,
        metrics: live.metrics.length > 0 ? live.metrics : connection.metrics,
      }
    : connection

  const style = STATUS_STYLE[effective.status]
  const cta = PRIMARY_CTA[effective.status]
  const isActive = effective.status !== "disconnected"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-2xl border border-border bg-card p-5",
        "transition-all hover:border-primary hover:shadow-sm",
      )}
    >
      {/* 1행 — 브랜드 + 상태 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-white text-sm"
            style={{ backgroundColor: connection.brandColor }}
            aria-hidden
          >
            {connection.initials}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-foreground text-base leading-tight truncate">
              {connection.brand}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0",
            style.pill,
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
          {style.label}
        </span>
      </div>

      {/* 2행 — 설명 */}
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed break-keep line-clamp-2">
        {connection.description}
      </p>

      {/* 3행 — 메트릭 + 마지막 동기화 */}
      {(effective.metrics || effective.lastSync) && (
        <div className="flex items-center gap-4 mt-4 text-[11px]">
          {effective.metrics?.map((m) => (
            <div key={m.label} className="flex items-baseline gap-1">
              <span
                className="font-bold text-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {m.value}
              </span>
              <span className="text-muted-foreground">{m.label}</span>
            </div>
          ))}
          {effective.lastSync && (
            <span className="text-muted-foreground ml-auto">
              · {effective.lastSync}
            </span>
          )}
        </div>
      )}

      {/* 4행 — CTA */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {isActive ? "설정 · CSV 업로드" : "연동 시작"}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-1.5 transition-all">
          {cta}
          <Iconify icon={altArrowRightBold} width={14} height={14} />
        </span>
      </div>
    </button>
  )
}
