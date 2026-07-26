import { hub } from '../../utils/hub'

// GM commands
export default defineEventHandler(async (event) => {
  const action = getRouterParam(event, 'action')
  const body = await readBody(event).catch(() => ({}))
  switch (action) {
    case 'select-game': hub.selectGame(body.game); return { ok: true }
    case 'select-category': hub.selectCategory(body.category); return { ok: true }
    case 'set-auto': hub.setAutoAdvance(body.on); return { ok: true }
    case 'start': { const err = hub.start(); return { ok: !err, error: err } }
    case 'next': hub.next(); return { ok: true }
    case 'end': hub.end(); return { ok: true }
    default: return { ok: false, error: 'unknown action' }
  }
})
