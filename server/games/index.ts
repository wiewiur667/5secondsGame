import type { GameModule } from './types'
import musicImpostor from './music-impostor'
import fiveSecondRule from './five-second-rule'

// The registry. Adding a game = one import + one line here.
export const games: Record<string, GameModule> = {
  [musicImpostor.id]: musicImpostor,
  [fiveSecondRule.id]: fiveSecondRule,
}

// Lightweight list for the GM game picker.
export const gameList = Object.values(games).map((g) => ({ id: g.id, name: g.name }))
