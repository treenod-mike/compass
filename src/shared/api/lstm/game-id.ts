// Internal Compass game IDs (`useSelectedGame`, `mock-data`) follow project
// shorthand. The LSTM snapshot is keyed by the AppsFlyer registered app id,
// which uses a different convention. Map here so callers don't have to know.
const SNAPSHOT_KEY_BY_GAME_ID: Record<string, string> = {
  poco: "poko_merge",
}

export function resolveSnapshotGameId(gameId: string): string {
  return SNAPSHOT_KEY_BY_GAME_ID[gameId] ?? gameId
}
