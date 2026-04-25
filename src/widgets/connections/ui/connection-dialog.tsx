"use client"

import { useRef, useState } from "react"
import { Icon as Iconify } from "@iconify/react"
import uploadBold from "@iconify-icons/solar/upload-bold"
import checkCircleBold from "@iconify-icons/solar/check-circle-bold"
import paperclipBold from "@iconify-icons/solar/paperclip-bold"
import cloudBold from "@iconify-icons/solar/cloud-bold"
import plugCircleBold from "@iconify-icons/solar/plug-circle-bold"
import refreshBold from "@iconify-icons/solar/refresh-bold"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { cn } from "@/shared/lib/utils"
import type { ApiField, Connection } from "@/shared/api/mock-connections"

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
  if (!connection) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <DialogDescription>{connection.description}</DialogDescription>
        </DialogHeader>

        {connection.primaryMethod === "api" ? (
          <ApiConnectionForm connection={connection} onDone={() => onOpenChange(false)} />
        ) : (
          <FileConnectionForm connection={connection} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ────────────────────────────────────────────────────────────────
   API 연동 폼 (AppsFlyer 등 SaaS)
   ──────────────────────────────────────────────────────────────── */
function ApiConnectionForm({
  connection,
  onDone,
}: {
  connection: Connection
  onDone: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    connection.apiFields?.forEach((f) => {
      if (f.defaultValue) init[f.name] = f.defaultValue
    })
    return init
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<null | "ok" | "fail">(null)

  const hasApiFields = Boolean(connection.apiFields && connection.apiFields.length > 0)

  const allRequiredFilled =
    connection.apiFields?.every((f) => !f.required || (values[f.name] ?? "").trim() !== "") ?? false

  const postSync = async (dryRun: boolean) => {
    const res = await fetch("/api/appsflyer/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dev_token: values.dev_token ?? "",
        home_currency: values.home_currency ?? "KRW",
        app_ids: values.app_ids ?? "",
        sync_frequency: values.sync_frequency ?? "1h",
        dry_run: dryRun,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean }
    return { ok: res.ok && data.ok === true }
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { ok } = await postSync(true)
      setTestResult(ok ? "ok" : "fail")
    } catch {
      setTestResult("fail")
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      const { ok } = await postSync(false)
      if (ok) onDone()
      else setTestResult("fail")
    } catch {
      setTestResult("fail")
    }
  }

  if (!hasApiFields) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <Iconify icon={plugCircleBold} width={28} height={28} className="text-muted-foreground mx-auto mb-2" />
          <div className="text-sm font-bold text-foreground mb-1">
            OAuth / API Key 연동
          </div>
          <p className="text-xs text-muted-foreground break-keep">
            {connection.brand} 계정으로 로그인하면 실시간 sync가 활성화됩니다.
            <br />
            1차 MVP에서는 미구현.
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
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {connection.syncCadence && (
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary w-fit">
          <Iconify icon={refreshBold} width={12} height={12} />
          {connection.syncCadence}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {connection.apiFields!.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
          />
        ))}
      </div>

      {testResult === "ok" && (
        <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/25 p-3">
          <Iconify icon={checkCircleBold} width={18} height={18} className="text-success mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-success">연결 테스트 성공</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              AppsFlyer 토큰 유효 · 저장 시 스냅샷 업데이트
            </div>
          </div>
        </div>
      )}
      {testResult === "fail" && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/25 p-3">
          <div>
            <div className="text-sm font-bold text-destructive">연결 실패</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              토큰 또는 app_id를 다시 확인하세요
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 gap-3">
        <button
          type="button"
          onClick={runTest}
          disabled={!allRequiredFilled || testing}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-bold border transition-colors",
            allRequiredFilled && !testing
              ? "border-border bg-card text-foreground hover:border-primary"
              : "border-border bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {testing ? "테스트 중..." : "연결 테스트"}
        </button>
        <button
          type="button"
          disabled={!allRequiredFilled || testResult !== "ok"}
          onClick={handleSave}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-bold",
            allRequiredFilled && testResult === "ok"
              ? "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.97] transition-transform"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          저장 · 연동 시작
        </button>
      </div>
    </div>
  )
}

function FormField({
  field,
  value,
  onChange,
}: {
  field: ApiField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "rounded-lg border border-border bg-card px-3 py-2 text-sm",
            "focus:outline-none focus:border-primary transition-colors",
          )}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn(
            "rounded-lg border border-border bg-card px-3 py-2 text-sm",
            "focus:outline-none focus:border-primary transition-colors",
            "placeholder:text-muted-foreground/60",
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
      )}
      {field.hint && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{field.hint}</p>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   파일 업로드 폼 (재무 CSV + Google Drive)
   ──────────────────────────────────────────────────────────────── */
function FileConnectionForm({
  connection,
  onDone,
}: {
  connection: Connection
  onDone: () => void
}) {
  const [source, setSource] = useState<"csv" | "drive">("csv")
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<{ rows: number; columns: number } | null>(null)
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveFiles, setDriveFiles] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setParsed(null)
    const fakeRows = Math.floor(Math.random() * 5000) + 200
    const fakeCols = connection.csvSchema?.length ?? 6
    setTimeout(() => setParsed({ rows: fakeRows, columns: fakeCols }), 400)
  }

  const connectDrive = () => {
    setDriveConnected(true)
    setTimeout(() => setDriveFiles(12), 600)
  }

  const ready =
    (source === "csv" && parsed !== null) ||
    (source === "drive" && driveConnected && driveFiles !== null)

  return (
    <div className="flex flex-col gap-4">
      {/* Source 선택 (토글 2개) */}
      {connection.supportsGoogleDrive && (
        <div className="inline-flex rounded-full bg-muted p-1 gap-1 w-fit">
          <SourceButton
            active={source === "csv"}
            onClick={() => setSource("csv")}
            icon={uploadBold}
            label="CSV 업로드"
          />
          <SourceButton
            active={source === "drive"}
            onClick={() => setSource("drive")}
            icon={cloudBold}
            label="Google Drive"
          />
        </div>
      )}

      {/* 스키마 안내 */}
      {connection.csvSchema && (
        <div className="rounded-xl bg-muted/40 border border-border/60 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
            기대 컬럼 · 필수 {connection.csvSchema.filter((s) => s.required).length}개
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            {connection.csvSchema.map((s) => (
              <div key={s.name} className="flex items-baseline gap-3">
                <code
                  className={cn(
                    "font-mono text-[11px] px-1.5 py-0.5 rounded bg-background border border-border",
                    s.required ? "text-primary font-bold" : "text-muted-foreground",
                  )}
                >
                  {s.name}
                </code>
                <span className="text-muted-foreground">{s.type}</span>
                {s.example && (
                  <span className="text-foreground/50 italic truncate">예: {s.example}</span>
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

      {source === "csv" ? (
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
              <div className="text-base font-bold text-foreground">{file?.name}</div>
              <div className="text-sm text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                {parsed.rows.toLocaleString()}행 · {parsed.columns}컬럼 파싱 완료
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setFile(null)
                  setParsed(null)
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
              <div className="text-sm font-semibold text-foreground">{file.name}</div>
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
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors",
            "px-6 py-10 text-center",
            driveConnected && driveFiles
              ? "border-success/40 bg-success/5"
              : "border-border",
          )}
        >
          {driveConnected && driveFiles !== null ? (
            <>
              <Iconify icon={checkCircleBold} width={32} height={32} className="text-success" />
              <div className="text-base font-bold text-foreground">
                Google Drive 연결됨
              </div>
              <div className="text-sm text-muted-foreground">
                📁 재무 폴더 — {driveFiles}개 CSV 파일 감지
              </div>
              <div className="text-xs text-muted-foreground italic">
                매일 00:00 KST 에 폴더 자동 스캔 · 신규 파일 자동 병합
              </div>
            </>
          ) : (
            <>
              <Iconify icon={cloudBold} width={32} height={32} className="text-primary" />
              <div className="text-base font-bold text-foreground">
                Google Drive 폴더 연결
              </div>
              <div className="text-xs text-muted-foreground break-keep max-w-sm">
                지정한 폴더 안의 모든 CSV 를 자동 탐지하고 매일 새 파일이 추가되면 반영합니다.
              </div>
              <button
                type="button"
                onClick={connectDrive}
                className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold bg-primary text-primary-foreground"
              >
                <Iconify icon={cloudBold} width={14} height={14} />
                Google 계정으로 연결
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-muted-foreground italic">
          * 1차 MVP — 실제 파싱·Drive API는 mock 동작
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={onDone}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-bold",
            ready
              ? "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.97] transition-transform"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          저장 · 연동 완료
        </button>
      </div>
    </div>
  )
}

function SourceButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof uploadBold
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Iconify icon={icon} width={14} height={14} />
      {label}
    </button>
  )
}
