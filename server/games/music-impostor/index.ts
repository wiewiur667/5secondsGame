import type { GameModule, PlayerView } from '../types'

const ROUND_SECONDS = 150 // 2:30 — auto-reveal, unchanged from original

// Extract the 11-char YouTube video id from a watch/share URL.
function videoId(url: string): string | null {
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface Round {
  mainId: string
  impId: string
  impostorPid: number
  impostorName: string
  players: number[]
}

// cfg = music.json (array of YouTube URL strings). opts.names = { pid: name }.
const musicImpostor: GameModule<Round> = {
  id: 'music-impostor',
  name: 'Music Impostor',
  minPlayers: 2,
  configFile: 'music.json',

  start(playerIds, cfg: string[], opts?: { names?: Record<number, string> }) {
    if (playerIds.length < 2) return 'Need at least 2 players.'
    const videoIds = (cfg || []).map(videoId).filter(Boolean) as string[]
    if (videoIds.length < 2) return 'Need at least 2 links in music.json.'
    const mainId = pick(videoIds)
    let impId = mainId
    while (impId === mainId) impId = pick(videoIds)
    const impostorPid = pick(playerIds)
    return {
      mainId,
      impId,
      impostorPid,
      impostorName: opts?.names?.[impostorPid] || '(left)',
      players: playerIds,
    }
  },

  tick(s, elapsedSec) {
    return elapsedSec >= ROUND_SECONDS
  },

  // No `next` / `score` — GM "Next" makes the hub start a fresh round; no points.

  stateForPlayer(s, pid, elapsedSec): PlayerView {
    const remaining = Math.max(0, Math.ceil(ROUND_SECONDS - elapsedSec))
    if (elapsedSec >= ROUND_SECONDS) {
      return {
        phase: 'revealed',
        game: this.id,
        leaderboard: [],
        impostorName: s.impostorName,
        youWereImpostor: pid === s.impostorPid,
      }
    }
    const vid = pid === s.impostorPid ? s.impId : s.mainId
    return { phase: 'playing', game: this.id, leaderboard: [], videoId: vid, remaining }
  },
}

export default musicImpostor
