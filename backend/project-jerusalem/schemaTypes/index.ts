import reservation from './reservation'

// Import other schemas
import chapel from '../../schemas/chapel.mjs'
import calendarPassword from '../../schemas/calendarPassword.mjs'
import autoBlockedHours from '../../schemas/autoBlockedHours.mjs'
import autoBlockedDays from '../../schemas/autoBlockedDays.mjs'
import blocked from '../../schemas/blocked.mjs'

export const schemaTypes = [
  reservation,
  chapel,
  calendarPassword,
  autoBlockedHours,
  autoBlockedDays,
  blocked
]
