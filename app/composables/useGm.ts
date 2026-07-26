// Game-master state + actions. Polls /api/gm/state (1s) and posts GM commands.
export type GmState = {
  games: { id: string; name: string }[]
  gameId: string | null
  categories: { id: string; name: string }[]
  selected: string[]
  autoAdvance: boolean
  revealOnAllAnswered: boolean
  timerSeconds: number
  phase: 'lobby' | 'playing' | 'revealed'
  players: { id: number; name: string; gone: boolean }[]
  leaderboard: { id: number; name: string; score: number }[]
  joinUrl: string
}

export function useGm() {
  const gm = ref<GmState | null>(null)
  const startError = ref('')

  async function refresh() {
    try { gm.value = await $fetch<GmState>('/api/gm/state') } catch {}
  }
  async function post(action: string, body?: Record<string, unknown>) {
    const res = await $fetch<{ ok: boolean; error?: string }>(`/api/gm/${action}`, {
      method: 'POST',
      body: body ?? {},
    })
    if (action === 'start') startError.value = res.ok ? '' : res.error || 'Failed to start.'
    await refresh()
    return res
  }

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => { refresh(); timer = setInterval(refresh, 1000) })
  onUnmounted(() => clearInterval(timer))

  return { gm, startError, post, refresh }
}
