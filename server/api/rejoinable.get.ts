import { hub } from '../utils/hub'

// Players with no live connection — the register screen lists them so a
// returning phone can take its seat back with one tap.
export default defineEventHandler(() => hub.rejoinable())
