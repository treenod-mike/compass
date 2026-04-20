"use client"

import { useRef, useState } from "react"
import { Icon as Iconify } from "@iconify/react"
import uploadBold from "@iconify-icons/solar/upload-bold"
import checkCircleBold from "@iconify-icons/solar/check-circle-bold"
import paperclipBold from "@iconify-icons/solar/paperclip-bold"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import {
  CustomTabs,
  CustomTabsList,
  CustomTabsTrigger,
} from "@/shared/ui/custom-tabs"
import { cn } from "@/shared/lib/utils"
import type { Connection } from "@/shared/api/mock-connections"

type ConnectionDialogProps = {
  connection: Connection | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionDialog({
  connection,
  open,
  onOpenChange,
}: ConnectionDialogProps) {
  const [tab, setTab] = useState<"csv" | "api">("csv")
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<{ rows: number; columns: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!connection) return null

  const handleFile = (f: File) => {
    setFile(f)
    // Mock parse — 실제 파싱은 2차 구현
    const fakeRows = Math.floor(Math.random() * 5000) + 200
    const fakeCols = connection.csvSchema?.length ?? 6
    setTimeout(() => setParsed({ rows: fakeRows, columns: fakeCols }), 400)
  }

  const reset = () => {
    setFile(null)
    setParsed(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0"
              style={{ backgroundColor: connection.brandColor }}
              aria-hidden
            >
              {connection.initials}
            </span>
            <span>{connection.brand} 연동</span>
          </DialogTitle>
          <DialogDescription>
            {connection.description}
          </DialogDescription>
        </DialogHeader>

        <CustomTabs value={tab} onValueChange={(v) => setTab(v as "csv" | "api")}>
          <CustomTabsList>
            <CustomTabsTrigger value="csv">
              <Iconify icon={uploadBold} width={14} height={14} />
              CSV 업로드 (권장)
            </CustomTabsTrigger>
            <CustomTabsTrigger value="api">API 연동</CustomTabsTrigger>
          </CustomTabsList>
        </CustomTabs>

        {tab === "csv" ? (
          <div className="flex flex-col gap-4">
            {/* 스키마 안내 */}
            {connection.csvSchema && (
              <div className="rounded-xl bg-muted/40 border border-border/60 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  기대 컬럼 · 필수 {connection.csvSchema.filter((s) => s.required).length}개
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  {connection.csvSchema.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-baseline gap-3"
                    >
                      <code
                        className={cn(
                          "font-mono text-[11px] px-1.5 py-0.5 rounded bg-background border border-border",
                          s.required
                            ? "text-primary font-bold"
                            : "text-muted-foreground",
                        )}
                      >
                        {s.name}
                      </code>
                      <span className="text-muted-foreground">{s.type}</span>
                      {s.example && (
                        <span className="text-foreground/50 italic truncate">
                          예: {s.example}
                        </span>
                      )}
                      {s.required && (
                        <span className="ml-auto text-[10px] font-bold text-primary flex-shrink-0">
                          필수
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 파일 드롭/선택 영역 */}
            <label
              htmlFor="csv-input"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors cursor-pointer",
                "px-6 py-10 text-center",
                parsed
                  ? "border-success/40 bg-success/5"
                  : "border-border hover:border-primary hover:bg-primary/5",
              )}
            >
              {parsed ? (
                <>
                  <Iconify icon={checkCircleBold} width={32} height={32} className="text-success" />
                  <div className="text-base font-bold text-foreground">
                    {file?.name}
                  </div>
                  <div
                    className="text-sm text-muted-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {parsed.rows.toLocaleString()}행 · {parsed.columns}컬럼 파싱 완료
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      reset()
                      fileInputRef.current?.click()
                    }}
                    className="text-xs font-semibold text-primary underline mt-1"
                  >
                    다른 파일 선택
                  </button>
                </>
              ) : file ? (
                <>
                  <Iconify icon={paperclipBold} width={28} height={28} className="text-muted-foreground animate-pulse" />
                  <div className="text-sm font-semibold text-foreground">
                    {file.name}
                  </div>
                  <div className="text-xs text-muted-foreground">파싱 중...</div>
                </>
              ) : (
                <>
                  <Iconify icon={uploadBold} width={32} height={32} className="text-primary" />
                  <div className="text-base font-bold text-foreground">
                    CSV 파일을 선택하거나 드래그
                  </div>
                  <div className="text-xs text-muted-foreground">
                    .csv / .tsv · 최대 50MB · UTF-8 인코딩
                  </div>
                </>
              )}
              <input
                id="csv-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
                className="hidden"
              />
            </label>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-muted-foreground italic">
                * 1차 MVP — 실제 파싱은 클라이언트에서 mock 동작합니다
              </p>
              <button
                type="button"
                disabled={!parsed}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-bold",
                  parsed
                    ? "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.97] transition-transform"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                업로드 완료
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <div className="text-sm font-bold text-foreground mb-2">
                OAuth / API Key 연동
              </div>
              <p className="text-xs text-muted-foreground break-keep">
                {connection.brand} 계정으로 로그인하면 실시간 sync가 활성화됩니다.
                <br />
                1차 MVP에서는 미구현 — CSV 탭에서 파일 업로드로 우회 가능.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="w-full rounded-full px-5 py-2.5 text-sm font-bold bg-muted text-muted-foreground cursor-not-allowed"
            >
              {connection.brand} 로그인 (준비 중)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
