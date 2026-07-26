import { hub } from '../../utils/hub'

// GM dashboard view
export default defineEventHandler(() => hub.gmState())
