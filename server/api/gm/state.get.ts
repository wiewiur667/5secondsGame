import { hub } from '../../utils/hub'

// GM dashboard view. The join URL uses the port the host browser actually
// reached us on, so dev (8080), Docker port mappings and PORT all just work.
export default defineEventHandler((event) => {
  const { port, protocol } = getRequestURL(event)
  return hub.gmState(port || (protocol === 'https:' ? 443 : 80))
})
