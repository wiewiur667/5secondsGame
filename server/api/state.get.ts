import { hub } from '../utils/hub'

// polling fallback for player view
export default defineEventHandler((event) => {
  const id = Number(getQuery(event).id)
  return hub.stateFor(id)
})
