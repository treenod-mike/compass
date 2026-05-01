"use client"

import { useEffect, useRef, useState } from "react"
import { OfferSchema, type Offer } from "@/shared/api/vc-simulation"

const HASH_KEY = "offer"

function encode(offer: Offer): string {
  try {
    const json = JSON.stringify(offer)
    return typeof btoa === "function" ? btoa(json) : ""
  } catch {
    return ""
  }
}

function decode(encoded: string): Offer | null {
  if (!encoded) return null
  try {
    const json = typeof atob === "function" ? atob(encoded) : ""
    if (!json) return null
    return OfferSchema.parse(JSON.parse(json))
  } catch {
    return null
  }
}

function readHash(): Offer | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash.replace(/^#/, "")
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const encoded = params.get(HASH_KEY)
  return encoded ? decode(encoded) : null
}

/**
 * URL-hash backed offer sync. On mount, if URL contains a valid encoded offer,
 * returns it via `hydratedOffer` (caller responsible for setting state).
 * Provides a `buildShareUrl()` helper to serialize an offer to a copyable URL.
 *
 * Hash format: #offer=<base64-json>
 */
export function useShareableOffer() {
  const [hydratedOffer] = useState<Offer | null>(() => readHash())
  const consumed = useRef(false)

  // After consumer reads `hydratedOffer`, clear hash to keep URL clean.
  useEffect(() => {
    if (hydratedOffer && !consumed.current) {
      consumed.current = true
      // Use replaceState so the back button doesn't replay the hash
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href)
        url.hash = ""
        window.history.replaceState({}, "", url.toString())
      }
    }
  }, [hydratedOffer])

  const buildShareUrl = (offer: Offer): string => {
    if (typeof window === "undefined") return ""
    const encoded = encode(offer)
    if (!encoded) return window.location.href
    const url = new URL(window.location.href)
    url.hash = `${HASH_KEY}=${encoded}`
    return url.toString()
  }

  return { hydratedOffer, buildShareUrl }
}
