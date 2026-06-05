import { ImageResponse } from "next/og"

import { BRAND } from "@/config/brand"
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/config/pwa"

const ALLOWED_SIZES = [32, 180, 192, 512] as const

export type PwaIconSize = (typeof ALLOWED_SIZES)[number]

export function normalizePwaIconSize(value: number | string | null | undefined): PwaIconSize {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value
  if (n === 512) return 512
  if (n === 192) return 192
  if (n === 180) return 180
  return 32
}

/** Generuje PNG ikony (bez cache offline — tylko asset instalacji). */
export function createPwaIconImage(size: PwaIconSize) {
  const radius = Math.round(size * 0.22)
  const glyph = Math.round(size * 0.52)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PWA_THEME_COLOR,
          borderRadius: radius,
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2.5" stroke="#ffffff" strokeWidth="2" />
          <path d="M3 10h18" stroke="#ffffff" strokeWidth="2" />
          <path
            d="M8 2v4M16 2v4"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9 15l2 2 4-4"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    },
  )
}

export const pwaBrandName = BRAND.name
export const pwaBackgroundColor = PWA_BACKGROUND_COLOR
