"use client"

/*
  CompassLogo — project compass wordmark.
  ----------------------------------------
  Mark: compass rose (outer ring + inner needle fletching) in brand purple.
  One unified mark across status bar, sidebar, login, future surfaces.
*/

type CompassLogoProps = {
  /** sm = sidebar icon+label (12px icon, 14px text) | md = compact bar (14/18) | lg = status bar (18/24) | xl = login/marketing (22/30) */
  size?: "sm" | "md" | "lg" | "xl"
  /** "icon" hides the wordmark for tight spaces */
  variant?: "full" | "icon"
  /** Optional className passthrough on the outer span */
  className?: string
}

const SIZES = {
  sm: { icon: 12, text: 14, gap: 6 },
  md: { icon: 14, text: 18, gap: 8 },
  lg: { icon: 18, text: 24, gap: 9 },
  xl: { icon: 22, text: 30, gap: 10 },
} as const

export function CompassLogo({
  size = "md",
  variant = "full",
  className,
}: CompassLogoProps) {
  const s = SIZES[size]

  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      style={{ gap: s.gap }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={s.icon}
        height={s.icon}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path
          fill="var(--brand)"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.5 8a6.5 6.5 0 1 1-13 0a6.5 6.5 0 0 1 13 0M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M7.186 5.605L12 4l-1.605 4.814a2.5 2.5 0 0 1-1.58 1.581L4 12l1.605-4.814a2.5 2.5 0 0 1 1.58-1.581ZM9 8a1 1 0 1 1-2 0a1 1 0 0 1 2 0"
        />
      </svg>
      {variant === "full" && (
        <span
          className="text-[var(--fg-0)]"
          style={{
            fontFamily: 'var(--font-instrument-serif), "Noto Serif KR", Georgia, serif',
            fontSize: s.text,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            fontStyle: "italic",
          }}
        >
          PROJECT COMPASS
        </span>
      )}
    </span>
  )
}
