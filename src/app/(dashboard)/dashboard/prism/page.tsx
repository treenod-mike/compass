"use client"

import { Icon as Iconify } from "@iconify/react"
import rocketBold from "@iconify-icons/solar/rocket-bold"
import chartSquareBold from "@iconify-icons/solar/chart-square-bold"
import testTubeBold from "@iconify-icons/solar/test-tube-bold"
import { flaskBold } from "@/shared/config/custom-icons"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"

type Stage = {
  icon: typeof rocketBold
  title: string
  description: string
  status: "planned" | "in-progress" | "connected"
}

const STAGES: Stage[] = [
  {
    icon: testTubeBold,
    title: "PRISM 실험 수신",
    description:
      "사내 실험 플랫폼 PRISM에서 진행 중인 A/B 실험 메타데이터와 노출 그룹을 주기적으로 수신합니다.",
    status: "planned",
  },
  {
    icon: rocketBold,
    title: "배포 파이프라인",
    description:
      "승리 배리언트를 Compass 판정과 함께 표시하고, 배포 승인 → 롤아웃 상태를 동기화합니다.",
    status: "planned",
  },
  {
    icon: chartSquareBold,
    title: "LTV 상승 계산",
    description:
      "PRISM에서 흘러온 실험 결과와 어트리뷰션 데이터를 결합해 Experiment ΔLTV 와 누적 포트폴리오 영향을 산출합니다.",
    status: "planned",
  },
]

const STATUS_LABEL: Record<Stage["status"], { label: string; tone: string }> = {
  planned: {
    label: "개발 예정",
    tone: "border-[var(--signal-caution)]/40 bg-[var(--signal-caution)]/10 text-[var(--signal-caution)]",
  },
  "in-progress": {
    label: "개발 중",
    tone: "border-primary/40 bg-primary/10 text-primary",
  },
  connected: {
    label: "연동 완료",
    tone: "border-[var(--signal-positive)]/40 bg-[var(--signal-positive)]/10 text-[var(--signal-positive)]",
  },
}

export default function PrismPage() {
  return (
    <PageTransition>
      {/* Hero */}
      <FadeInUp className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="inline-flex w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center text-primary flex-shrink-0">
              <Iconify icon={flaskBold} width={26} height={26} />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground leading-tight tracking-tight">
                PRISM 연동
              </h1>
              <p className="text-sm text-muted-foreground mt-1 break-keep max-w-2xl">
                PRISM은 사내 A/B 테스트 · 실험 플랫폼입니다. Compass는 이곳에서
                실험 배포 제어와 ΔLTV 산출을 연동할 예정이며, 현재는{" "}
                <span className="font-semibold text-foreground">개발 로드맵 단계</span>
                입니다.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--signal-caution)]/40 bg-[var(--signal-caution)]/10 px-2 py-1 text-xs font-bold text-[var(--signal-caution)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-caution)]" />
            ROADMAP
          </span>
        </div>
      </FadeInUp>

      {/* Roadmap stages */}
      <FadeInUp className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STAGES.map((stage) => {
            const badge = STATUS_LABEL[stage.status]
            return (
              <div
                key={stage.title}
                className="rounded-2xl border border-border bg-card p-5 h-full flex flex-col gap-3 transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex w-10 h-10 rounded-xl bg-primary/10 items-center justify-center text-primary">
                    <Iconify icon={stage.icon} width={22} height={22} />
                  </span>
                  <span
                    className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-bold ${badge.tone}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground leading-tight">
                    {stage.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed break-keep">
                    {stage.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </FadeInUp>

      {/* Scope note */}
      <FadeInUp>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex w-8 h-8 rounded-lg bg-[var(--bg-2)] items-center justify-center text-muted-foreground flex-shrink-0 mt-0.5">
              <Iconify icon={flaskBold} width={16} height={16} />
            </span>
            <div className="text-sm text-foreground/80 leading-relaxed break-keep">
              <p className="font-semibold text-foreground mb-2">
                이 페이지의 현재 역할
              </p>
              <ul className="list-disc pl-5 space-y-1 marker:text-muted-foreground">
                <li>PRISM 연동 범위 · 방향을 표시하는{" "}
                  <span className="font-semibold text-foreground">플레이스홀더</span>
                </li>
                <li>
                  실제 실험 목록 · 변이별 결과 · ΔLTV 계산 로직은{" "}
                  <span className="font-semibold text-foreground">후속 개발 대상</span>
                  이며, 연동 완료 시 이 자리에 차트 · 테이블이 배치됩니다.
                </li>
                <li>
                  기존 Experiments 섹션에서 사용하던 차트(Experiment ΔLTV, Variant
                  Impact, Rollout Timeline 등)는 Compass의{" "}
                  <code className="text-xs bg-[var(--bg-2)] px-1 py-0.5 rounded">
                    widgets/charts
                  </code>
                  에 보존되어 있어 바로 재사용 가능합니다.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </FadeInUp>
    </PageTransition>
  )
}
