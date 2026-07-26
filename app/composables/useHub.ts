import { useWebSocket } from '@vueuse/core'

// The only thing a phone ever sees (mirrors server/games/types.ts PlayerView).
export type Leaderboard = Array<{ id: number; name: string; score: number }>
export interface PlayerView {
  phase: 'register' | 'waiting' | 'gameover' | 'playing' | 'revealed'
  [k: string]: any
}

// Real-time hub: WS push with a 2s polling fallback. Client-only (guards SSR).
export function useHub() {
  const state = ref<PlayerView | null>(null)
  const id = ref<number | null>(null)

  let send: ((d: string) => void) | null = null
  let statusRef: { value: string } | null = null

  const hello = () => JSON.stringify({ type: 'hello', id: id.value })

  function apply(v: PlayerView) {
    state.value = v
    if (v.phase === 'register') {
      localStorage.removeItem('mi_id')
      id.value = null
    }
  }

  async function register(name: string) {
    const { id: newId } = await $fetch<{ id: number }>('/api/register', {
      method: 'POST',
      body: { name },
    })
    id.value = newId
    localStorage.setItem('mi_id', String(newId))
    if (send && statusRef?.value === 'OPEN') send(hello())
  }

  function submit(payload: any) {
    if (send && statusRef?.value === 'OPEN') send(JSON.stringify({ type: 'submit', payload }))
  }
  function action(type: string) {
    if (send && statusRef?.value === 'OPEN') send(JSON.stringify({ type }))
  }
  function logout() {
    if (import.meta.client) localStorage.removeItem('mi_id')
    id.value = null
    state.value = { phase: 'register' }
  }

  if (import.meta.client) {
    const stored = localStorage.getItem('mi_id')
    if (stored) id.value = Number(stored)

    const ws = useWebSocket(`ws://${location.host}/ws`, {
      autoReconnect: true,
      onConnected() { if (id.value != null) ws.send(hello()) },
    })
    send = ws.send
    statusRef = ws.status
    watch(ws.data, (d) => {
      if (!d) return
      try { apply(JSON.parse(d)) } catch {}
    })

    // Fallback poll only when the socket isn't carrying us.
    const timer = setInterval(async () => {
      if (ws.status.value === 'OPEN' || id.value == null) return
      try { apply(await $fetch<PlayerView>('/api/state', { query: { id: id.value } })) } catch {}
    }, 2000)
    onScopeDispose(() => clearInterval(timer))
  }

  return {
    state,
    id,
    register,
    submit,
    startTimer: () => action('start-timer'),
    reveal: () => action('reveal'),
    logout,
  }
}
