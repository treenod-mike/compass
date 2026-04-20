import type { IconifyIcon } from '@iconify/types'

/**
 * Erlenmeyer flask glyph used for the "실험 영향 (PRISM)" category.
 * Solar icon set lacks a flask; we hand-roll one as an IconifyIcon so it
 * slots into the same <Iconify icon={...} /> pipeline without special-casing.
 */
export const flaskBold: IconifyIcon = {
  body: `
    <path
      d="M9 3 H15 V7.2 L19.6 17.4 C20.4 19.2 19.2 21 17.2 21 H6.8 C4.8 21 3.6 19.2 4.4 17.4 L9 7.2 Z"
      fill="currentColor"
    />
    <rect x="8.5" y="2" width="7" height="1.6" rx="0.5" fill="currentColor" />
    <circle cx="10.5" cy="16" r="1" fill="#ffffff" opacity="0.85" />
    <circle cx="13.5" cy="18" r="0.7" fill="#ffffff" opacity="0.85" />
  `,
  width: 24,
  height: 24,
}
