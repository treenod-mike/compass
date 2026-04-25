"use client"

import { useState } from "react"
import { Icon as Iconify } from "@iconify/react"
import plugCircleBold from "@iconify-icons/solar/plug-circle-bold"
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  mockConnections,
  type Connection,
} from "@/shared/api/mock-connections"
import { ConnectionCard, ConnectionDialog } from "@/widgets/connections"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"

export default function ConnectionsPage() {
  const [active, setActive] = useState<Connection | null>(null)

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    id: cat,
    label: CATEGORY_LABEL[cat],
    items: mockConnections.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0)

  const connectedCount = mockConnections.filter(
    (c) => c.status === "connected",
  ).length
  const warnCount = mockConnections.filter((c) => c.status === "warn").length
  const errorCount = mockConnections.filter((c) => c.status === "error").length

  return (
    <PageTransition>
      {/* Hero */}
      <FadeInUp className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="inline-flex w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center text-primary flex-shrink-0">
              <Iconify icon={plugCircleBold} width={26} height={26} />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground leading-tight tracking-tight">
                데이터 연결
              </h1>
              <p className="text-sm text-muted-foreground mt-1 break-keep">
                외부 시스템과 연동해 실시간 분석 정확도를 높이세요 ·{" "}
                <span className="font-semibold text-foreground">
                  1차 MVP: CSV 업로드 지원
                </span>
              </p>
            </div>
          </div>

          {/* 상태 요약 pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill color="bg-success" label={`연결 ${connectedCount}`} />
            {warnCount > 0 && (
              <StatusPill color="bg-warning" label={`검토 ${warnCount}`} />
            )}
            {errorCount > 0 && (
              <StatusPill color="bg-destructive" label={`에러 ${errorCount}`} />
            )}
          </div>
        </div>
      </FadeInUp>

      {/* 카테고리별 섹션 */}
      {byCategory.map((group) => (
        <FadeInUp key={group.id} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {group.label}
            </h2>
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">
              {group.items.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.items.map((c) =>
              c.id === "appsflyer" ? (
                <ConnectionCard
                  key={c.id}
                  connection={c}
                  href="/dashboard/connections/appsflyer"
                />
              ) : (
                <ConnectionCard
                  key={c.id}
                  connection={c}
                  onClick={() => setActive(c)}
                />
              ),
            )}
          </div>
        </FadeInUp>
      ))}

      <ConnectionDialog
        connection={active}
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
      />
    </PageTransition>
  )
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-muted text-foreground">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
