"use client"
import { useState } from "react"
import { RegisterRequestSchema } from "@/shared/api/appsflyer"

export type RegisterModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: (appId: string) => void
}

type FormState = {
  dev_token: string
  app_id: string
  app_label: string
  game_key: "match-league" | "weaving-fairy" | "dig-infinity" | "portfolio"
  home_currency: "KRW" | "USD" | "JPY" | "EUR"
}

const INITIAL: FormState = {
  dev_token: "",
  app_id: "",
  app_label: "",
  game_key: "match-league",
  home_currency: "KRW",
}

export function RegisterModal({ open, onClose, onSuccess }: RegisterModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = RegisterRequestSchema.safeParse(form)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string
        errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/appsflyer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.appId) {
        onSuccess(body.appId)
        setForm(INITIAL)
      } else {
        const msg =
          body.error === "credential_invalid"
            ? "토큰이 유효하지 않습니다 (invalid token)"
            : body.error === "app_missing"
            ? "App ID를 찾을 수 없습니다 (app not found)"
            : body.error === "app_already_registered"
            ? "이미 등록된 App ID 입니다"
            : (body.message ?? `Error ${res.status}`)
        setError(msg)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[var(--radius-card)] bg-[var(--bg-1)] p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--fg-0)]">
          AppsFlyer 연동 추가
        </h2>

        <div className="space-y-3">
          <Field
            htmlFor="rf-dev-token"
            label="Dev Token"
            error={fieldErrors.dev_token}
          >
            <input
              id="rf-dev-token"
              type="password"
              value={form.dev_token}
              onChange={(e) => update("dev_token", e.target.value)}
              className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-3)] bg-[var(--bg-0)] px-2 py-1 text-sm text-[var(--fg-0)]"
            />
          </Field>

          <Field
            htmlFor="rf-app-id"
            label="App ID"
            error={fieldErrors.app_id}
          >
            <input
              id="rf-app-id"
              value={form.app_id}
              onChange={(e) => update("app_id", e.target.value)}
              placeholder="com.example.app"
              className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-3)] bg-[var(--bg-0)] px-2 py-1 text-sm text-[var(--fg-0)]"
            />
          </Field>

          <Field
            htmlFor="rf-app-label"
            label="레이블 (Label)"
            error={fieldErrors.app_label}
          >
            <input
              id="rf-app-label"
              value={form.app_label}
              onChange={(e) => update("app_label", e.target.value)}
              className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-3)] bg-[var(--bg-0)] px-2 py-1 text-sm text-[var(--fg-0)]"
            />
          </Field>

          <Field
            htmlFor="rf-game-key"
            label="게임 (Game)"
            error={fieldErrors.game_key}
          >
            <select
              id="rf-game-key"
              value={form.game_key}
              onChange={(e) =>
                update("game_key", e.target.value as FormState["game_key"])
              }
              className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-3)] bg-[var(--bg-0)] px-2 py-1 text-sm text-[var(--fg-0)]"
            >
              <option value="match-league">Match League</option>
              <option value="weaving-fairy">Weaving Fairy</option>
              <option value="dig-infinity">Dig Infinity</option>
              <option value="portfolio">Portfolio (aggregate)</option>
            </select>
          </Field>

          <Field
            htmlFor="rf-home-currency"
            label="통화 (Currency)"
            error={fieldErrors.home_currency}
          >
            <select
              id="rf-home-currency"
              value={form.home_currency}
              onChange={(e) =>
                update(
                  "home_currency",
                  e.target.value as FormState["home_currency"]
                )
              }
              className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-3)] bg-[var(--bg-0)] px-2 py-1 text-sm text-[var(--fg-0)]"
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>

        {error && (
          <div className="mt-3 rounded-[var(--radius-inline)] border border-[var(--signal-risk)] bg-[var(--signal-risk)]/10 px-2 py-1 text-xs text-[var(--signal-risk)]">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[var(--radius-inline)] px-3 py-1 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-2)]"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-[var(--radius-inline)] bg-[var(--brand)] px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  htmlFor,
  label,
  error,
  children,
}: {
  htmlFor: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs text-[var(--fg-2)]"
      >
        {label}
      </label>
      {children}
      {error && (
        <span className="mt-0.5 block text-xs text-[var(--signal-risk)]">
          {error}
        </span>
      )}
    </div>
  )
}
