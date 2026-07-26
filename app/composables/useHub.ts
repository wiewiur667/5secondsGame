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

  function acceptId(newId: number) {
    id.value = newId
    localStorage.setItem('mi_id', String(newId))
    if (send && statusRef?.value === 'OPEN') send(hello())
  }

  type RegisterResult = { ok: true } | { ok: false; reason: 'taken' | 'declined' }

  // Names must be unique. If the name belongs to a player with no live
  // socket, offer to rejoin as them (confirm-gated); otherwise reject.
  async function register(name: string): Promise<RegisterResult> {
    type Res = { id?: number; conflict?: 'taken' | 'rejoin' }
    const res = await $fetch<Res>('/api/register', { method: 'POST', body: { name } })
    if (res.id != null) {
      acceptId(res.id)
      return { ok: true }
    }
    if (res.conflict === 'rejoin' && res.id != null) {
      const existingId = res.id
      const wantsRejoin = confirm(`"${name}" is already in the game but not connected. Rejoin as them?`)
      if (wantsRejoin) {
        const res2 = await $fetch<Res>('/api/register', {
          method: 'POST',
          body: { name, rejoinId: existingId },
        })
        if (res2.id != null) {
          acceptId(res2.id)
          return { ok: true }
        }
      }
      return { ok: false, reason: 'declined' }
    }
    return { ok: false, reason: 'taken' }
  }

  function submit(payload: any) {
    if (send && statusRef?.value === 'OPEN') send(JSON.stringify({ type: 'submit', payload }))
  }
  function action(type: string) {
    if (send && statusRef?.value === 'OPEN') send(JSON.stringify({ type }))
  }
  function logout() {
    action('logout') // tell the server to drop this player (frees the GM role)
    if (import.meta.client) localStorage.removeItem('mi_id')
    id.value = null
    state.value = { phase: 'register' }
  }

  if (import.meta.client) {
    const stored = localStorage.getItem('mi_id')
    if (stored) id.value = Number(stored)

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = useWebSocket(`${proto}://${location.host}/ws`, {
      // Keep retrying forever, but with a 2s gap so a brief outage (e.g. Nitro
      // dev HMR reload) doesn't flood the upgrade endpoint. Poll covers the gap.
      autoReconnect: { retries: () => true, delay: 2000 },
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

    // Phones lock/background constantly at a party; mobile browsers delay the
    // native `close` event until the tab resumes, so the passive reconnect can
    // sit stale for a while. Force a reconnect the instant the tab is visible.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws.status.value !== 'OPEN') ws.open()
    }
    document.addEventListener('visibilitychange', onVisible)
    onScopeDispose(() => document.removeEventListener('visibilitychange', onVisible))
  }

  return {
    state,
    id,
    register,
    submit,
    startTimer: () => action('start-timer'),
    reveal: () => action('reveal'),
    continueRound: () => action('continue'),
    logout,
  }
}
