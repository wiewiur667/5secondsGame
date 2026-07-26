import { hub } from '../utils/hub'

// join lobby, get player id
export default defineEventHandler(async (event) => {
  const { name } = await readBody(event)
  return { id: hub.register(name) }
})
