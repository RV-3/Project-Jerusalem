// ManualBlockLogic.js
import moment from 'moment-timezone'
import client from '../utils/sanityClient.js'

/**
 * Checks if a given 1-hour range (UTC) is already manually blocked exactly.
 * We compare getTime() equality for that 1-hour chunk.
 * @param {Date} hStart - 1-hour chunk start in real UTC Date
 * @param {Date} hEnd   - 1-hour chunk end in real UTC Date
 * @param {Array} blocks - existing array of block docs from Sanity
 * @returns {boolean}
 */
export function isManuallyBlocked(hStart, hEnd, blocks) {
  const bStartTime = hStart.getTime()
  const bEndTime = hEnd.getTime()
  return blocks.some((b) => {
    const blockStart = new Date(b.start).getTime() // b.start should be UTC string
    const blockEnd = new Date(b.end).getTime()
    return blockStart === bStartTime && blockEnd === bEndTime
  })
}

/**
 * Creates 1-hour block docs in Sanity for a selected range, *including* the chapel reference,
 * parsing the calendar's selected range in the chapel's time zone (or fallback).
 *
 * @param {Object} info - FullCalendar "select" info with { start, end }
 * @param {Array} blocks - existing array of block docs from Sanity
 * @param {Function} t - translation helper
 * @param {Function} fetchData - callback to reload fresh data
 * @param {string} chapelId - the ID of the chapel doc (_id) to link blocks to
 * @param {string} chapelTimezone - e.g. 'Europe/Vienna' or fallback
 */
export async function handleBlock(info, blocks, t, fetchData, chapelId, chapelTimezone) {
  // Parse the selected range in the chapel’s time zone
  const slotStart = moment.tz(info.start, chapelTimezone)
  const slotEnd   = moment.tz(info.end,   chapelTimezone)

  // If the user somehow selected a past slot => disallow
  const nowLocal = moment.tz(chapelTimezone)
  if (slotStart.isBefore(nowLocal)) {
    alert(
      t({
        en: 'Cannot block a past slot.',
        de: 'Kann kein vergangenes Zeitfenster blockieren.',
        es: 'No se puede bloquear un intervalo pasado.'
      })
    )
    return
  }

  const docs = []
  const cursor = slotStart.clone() // moment in local chapel tz
  while (cursor.isBefore(slotEnd)) {
    const nextHour = cursor.clone().add(1, 'hour')

    // Convert these to real UTC Date objects (absolute time)
    const startUtc = cursor.utc().toDate()
    const endUtc = nextHour.utc().toDate()

    // only create a doc if it's not already blocked in that exact UTC hour
    if (!isManuallyBlocked(startUtc, endUtc, blocks)) {
      docs.push({
        _type: 'blocked',
        chapel: { _ref: chapelId, _type: 'reference' },
        // store final times as .toISOString() => UTC
        start: startUtc.toISOString(),
        end: endUtc.toISOString()
      })
    }
    cursor.add(1, 'hour')
  }

  if (!docs.length) {
    alert(
      t({
        en: 'All those hours are already blocked.',
        de: 'Alle diese Stunden sind bereits blockiert.',
        es: 'Todas esas horas ya están bloqueadas.'
      })
    )
    return
  }

  await Promise.all(docs.map((doc) => client.create(doc)))
  fetchData()
}

/**
 * Removes manual blocks (if any) and creates "timeException" patches for autoBlock.
 * Also parse the user’s selected range in the chapel’s time zone.
 *
 * @param {Object} info - FullCalendar "select" info with { start, end }
 * @param {Array} blocks - existing array of block docs from Sanity
 * @param {Array} autoBlockRules - array of autoBlockedHours docs
 * @param {Object} autoBlockDays - single doc for autoBlockedDays
 * @param {Function} t - translation helper
 * @param {Function} fetchData - callback to reload fresh data
 * @param {string} chapelTimezone - e.g. 'Europe/Vienna' or fallback
 */
export async function handleUnblock(
  info,
  blocks,
  autoBlockRules,
  autoBlockDays,
  t,
  fetchData,
  chapelTimezone
) {
  const slotStart = moment.tz(info.start, chapelTimezone)
  const slotEnd   = moment.tz(info.end,   chapelTimezone)

  const nowLocal = moment.tz(chapelTimezone)
  if (slotStart.isBefore(nowLocal)) {
    alert(
      t({
        en: 'Cannot unblock past time.',
        de: 'Kann vergangene Zeit nicht freigeben.',
        es: 'No se puede desbloquear un tiempo pasado.'
      })
    )
    return
  }

  // 1) Remove manual blocks in that range
  const deletions = []
  const cursor = slotStart.clone()
  while (cursor.isBefore(slotEnd)) {
    const nextHour = cursor.clone().add(1, 'hour')

    // Compare in UTC
    const hourStartUtc = cursor.utc().toDate().getTime()
    const hourEndUtc   = nextHour.utc().toDate().getTime()

    const existing = blocks.find((b) => {
      const bStart = new Date(b.start).getTime() // b.start is stored UTC
      const bEnd = new Date(b.end).getTime()
      return bStart === hourStartUtc && bEnd === hourEndUtc
    })
    if (existing) {
      deletions.push(client.delete(existing._id))
    }
    cursor.add(1, 'hour')
  }

  // 2) Add timeExceptions if needed (so auto-block won't re-block this hour)
  const patches = []
  const exCursor = slotStart.clone()
  while (exCursor.isBefore(slotEnd)) {
    const nextHr = exCursor.clone().add(1, 'hour')
    // We'll use the local chapel tz for figuring out day/hours
    autoBlockRules.forEach((rule) => {
      if (doesRuleCoverHourRule(rule, exCursor.toDate(), nextHr.toDate(), chapelTimezone)) {
        const dateStr = exCursor.format('YYYY-MM-DD')
        const startHr = exCursor.hour()
        const endHr   = nextHr.hour()
        const exObj = {
          _type: 'timeException',
          date: dateStr,
          startHour: String(startHr),
          endHour: String(endHr)
        }
        patches.push(
          client
            .patch(rule._id)
            .setIfMissing({ timeExceptions: [] })
            .append('timeExceptions', [exObj])
            .commit()
        )
      }
    })

    // day-based
    if (autoBlockDays?.daysOfWeek?.length) {
      const dayName = exCursor.format('dddd')
      if (autoBlockDays.daysOfWeek.includes(dayName)) {
        const dateStr = exCursor.format('YYYY-MM-DD')
        const startHr = exCursor.hour()
        const endHr   = nextHr.hour()
        const exObj = {
          _type: 'timeException',
          date: dateStr,
          startHour: String(startHr),
          endHour: String(endHr)
        }
        patches.push(
          client
            .patch(autoBlockDays._id)
            .setIfMissing({ timeExceptions: [] })
            .append('timeExceptions', [exObj])
            .commit()
        )
      }
    }
    exCursor.add(1, 'hour')
  }

  await Promise.all([...deletions, ...patches])
  fetchData()
}

/**
 * Helper to check if an hour-based rule covers a given 1-hour slot,
 * when interpreting local times in the chapel’s timezone.
 */
function doesRuleCoverHourRule(rule, hStart, hEnd, chapelTimezone) {
  const s = moment.tz(hStart, chapelTimezone)
  const e = moment.tz(hEnd,   chapelTimezone)
  const dayAnchor = s.clone().startOf('day')
  const rStart = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
  const rEnd   = dayAnchor.clone().hour(parseInt(rule.endHour, 10))

  if (s.isBefore(rStart) || e.isAfter(rEnd)) return false
  if (isHourRuleExcepted(rule, hStart, hEnd, chapelTimezone)) return false
  return true
}

/**
 * Helper to check if a 1-hour slot is in a rule's timeExceptions,
 * also using the chapel's timezone to match date/hours properly.
 */
function isHourRuleExcepted(rule, hStart, hEnd, chapelTimezone) {
  const s = moment.tz(hStart, chapelTimezone)
  const e = moment.tz(hEnd,   chapelTimezone)
  const exceptions = rule.timeExceptions || []
  return exceptions.some((ex) => {
    if (!ex.date) return false
    // ex.date is typically "YYYY-MM-DD"
    const dayAnchor = s.clone().startOf('day')
    if (ex.date.slice(0, 10) !== dayAnchor.format('YYYY-MM-DD')) return false

    const exStart = dayAnchor.clone().hour(parseInt(ex.startHour || '0', 10))
    const exEnd   = dayAnchor.clone().hour(parseInt(ex.endHour   || '0', 10))
    return s.isBefore(exEnd) && e.isAfter(exStart)
  })
}
