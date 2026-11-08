import { hub } from '../../utils/hub'

// GM commands
export default defineEventHandler(async (event) => {
  const action = getRouterParam(event, 'action')
  const body = await readBody(event).catch(() => ({}))
  switch (action) {
    case 'select-game': hub.selectGame(body.game); return { ok: true }
    case 'select-category': hub.selectCategory(body.category); return { ok: true }
    case 'set-auto': hub.setAutoAdvance(body.on); return { ok: true }
    case 'set-reveal-on-answer': hub.setRevealOnAllAnswered(body.on); return { ok: true }
    case 'set-penalty': hub.setPenalizeWrong(body.on); return { ok: true }
    case 'pause': hub.togglePause(); return { ok: true }
    case 'skip': hub.skip(); return { ok: true }
    case 'replay': hub.replay(); return { ok: true }
    case 'adjust-score': hub.adjustScore(Number(body.id), body.delta); return { ok: true }
    case 'set-timer': hub.setTimer(body.seconds); return { ok: true }
    case 'set-option': hub.setOption(String(body.key), body.value); return { ok: true }
    case 'set-length': hub.setQuestionLimit(body.count); return { ok: true }
    case 'reset': hub.reset(); return { ok: true }
    case 'start': { const err = hub.start(); return { ok: !err, error: err } }
    case 'next': hub.next(); return { ok: true }
    case 'end': hub.end(); return { ok: true }
    case 'remove-player': hub.removePlayer(Number(body.id)); return { ok: true }
    default: return { ok: false, error: 'unknown action' }
  }
})
