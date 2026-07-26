import { hub } from '../utils/hub'

// Join lobby, get player id. Names must be unique per session:
// - name free                       -> register a new player
// - name taken, no live socket      -> conflict:'rejoin' (client confirms, resends with rejoinId)
// - name taken, live socket present -> conflict:'taken' (must pick a different name)
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const name = String(body?.name || '')
  const rejoinId = body?.rejoinId != null ? Number(body.rejoinId) : null

  const existing = hub.findByName(name)

  // Client already confirmed a rejoin — atomically claim the id so two
  // concurrent rejoin requests for the same name can't both be granted
  // (TOCTOU: `connected` doesn't flip true until the real WS attach()es,
  // which can be seconds after this HTTP call).
  if (rejoinId != null && existing?.id === rejoinId) {
    if (hub.claimRejoin(rejoinId)) return { id: rejoinId, rejoined: true }
    const now = hub.findByName(name) // state may have changed since `existing` was read
    return { conflict: now?.connected ? 'taken' : 'rejoin', id: now?.id ?? rejoinId }
  }

  if (existing) {
    return { conflict: existing.connected ? 'taken' : 'rejoin', id: existing.id }
  }

  return { id: hub.register(name) }
})
