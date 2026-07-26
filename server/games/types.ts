// The contract every game implements. The hub knows nothing game-specific —
// it only calls these methods. Adding a game = implement this + a config JSON +
// one Vue component keyed on `state.game`.

export type Leaderboard = Array<{ id: number; name: string; score: number }>

// The only thing a player's phone ever sees. Games attach their own fields.
export type PlayerView =
  | { phase: 'register' } // unknown/stale id — phone re-prompts for a name
  | { phase: 'waiting'; roster: string[]; isGm: boolean } // lobby; isGm → show /gm link
  | { phase: 'gameover'; leaderboard: Leaderboard; isGm: boolean } // final scores after a game ends
  | ({ phase: 'playing'; game: string; leaderboard: Leaderboard } & Record<string, any>)
  | ({ phase: 'revealed'; game: string; leaderboard: Leaderboard } & Record<string, any>)

export interface GameModule<S = any> {
  id: string
  name: string
  minPlayers: number
  configFile?: string // e.g. 'music.json' — loaded and passed to start() as cfg

  // Build round state. Return a string to reject (e.g. "Need 2 players") — mirrors
  // the current server.js startRound() error-string convention.
  start(playerIds: number[], cfg: any, opts?: any): S | string

  // Per-second advance. Return true once the round is over (triggers reveal + scoring).
  tick?(s: S, elapsedSec: number): boolean

  // GM "Next". Return false when there is nothing left → hub auto-ends. Default: no-op → end.
  next?(s: S): boolean

  // Seconds from round start at which the hub auto-advances (calls next). null = never.
  autoAdvanceAt?(s: S): number | null

  // Player action. The GAME enforces validity server-side (timing, count, dedupe).
  submit?(s: S, pid: number, payload: any, elapsedSec: number): void

  // Points earned THIS round, per player. Hub applies once on the playing→revealed edge.
  score?(s: S): Record<number, number>

  // What this specific player's phone renders. Never throw for an unknown pid.
  stateForPlayer(s: S, pid: number, elapsedSec: number): PlayerView
}
