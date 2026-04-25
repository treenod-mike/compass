/**
 * Game Settings Store — per-game (country, genre) preferences.
 *
 * Scope: Persists each game's CPI benchmark filter context to localStorage so
 * the user's last-selected (country, genre) survives reloads. Defaults seed
 * only `poco = (JP, merge)` because sample games were removed in T1.
 *
 * SSR safety: `skipHydration: true` defers the localStorage read until the
 * client calls `useGameSettings.persist.rehydrate()` (or relies on a `mounted`
 * flag in the consumer). This avoids hydration mismatch when the server
 * renders the default state before the browser reconciles.
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CountryCode, Genre } from "@/shared/api/cpi-benchmarks"

export interface GameSettings {
  country: CountryCode
  genre: Genre
}

export const DEFAULT_GAME_SETTINGS: Record<string, GameSettings> = {
  poco: { country: "JP", genre: "merge" },
}

interface GameSettingsStore {
  settings: Record<string, GameSettings>
  updateSettings: (gameId: string, partial: Partial<GameSettings>) => void
}

export const useGameSettings = create<GameSettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_GAME_SETTINGS,
      updateSettings: (gameId, partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [gameId]: {
              ...(state.settings[gameId] ?? { country: "JP", genre: "merge" }),
              ...partial,
            },
          },
        })),
    }),
    {
      name: "compass:game-settings",
      // Skip hydration on server to avoid SSR mismatch; client reconciles on mount.
      skipHydration: true,
    },
  ),
)
