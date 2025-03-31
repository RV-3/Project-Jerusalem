import React, { useEffect, useState, useRef } from 'react'
import { isIOS } from 'react-device-detect'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'

// moment-timezone plugins
import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'

import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import './Calendar.css'

Modal.setAppElement('#root')

/**
 * Return the "next top-of-hour" in Jerusalem as a Moment,
 * so we can forbid selections earlier than that.
 */
function getJerusalemNextHourMoment() {
  const nowJer = moment.tz('Asia/Jerusalem')
  if (nowJer.minute() !== 0 || nowJer.second() !== 0) {
    nowJer.add(1, 'hour').startOf('hour')
  }
  return nowJer
}

/**
 * Check timeException logic in Asia/Jerusalem.
 */
function isHourExcepted(rule, hStart, hEnd) {
  const startJer = moment.tz(hStart, 'Asia/Jerusalem')
  const endJer   = moment.tz(hEnd,   'Asia/Jerusalem')

  // The local (Jerusalem) date as YYYY-MM-DD
  const dateStr = startJer.format('YYYY-MM-DD')
  const exceptions = rule.timeExceptions || []

  return exceptions.some((ex) => {
    if (!ex.date) return false
    // Skip if not the same local date
    if (ex.date.slice(0, 10) !== dateStr) return false

    // Build the exception start/end in Jerusalem
    const exDay   = startJer.clone().startOf('day')
    const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
    const exEnd   = exDay.clone().hour(parseInt(ex.endHour   || '0', 10))

    // Overlap check
    return startJer.isBefore(exEnd) && endJer.isAfter(exStart)
  })
}

/**
 * doesRuleCover => true if [hStart,hEnd) is within [rule.startHour, rule.endHour)
 * in Jerusalem time, and not excepted.
 */
function doesRuleCover(rule, hStart, hEnd) {
  const startJer = moment.tz(hStart, 'Asia/Jerusalem')
  const endJer   = moment.tz(hEnd,   'Asia/Jerusalem')

  // Anchor day to midnight in Jerusalem
  const dayAnchor = startJer.clone().startOf('day')
  const rStart    = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
  const rEnd      = dayAnchor.clone().hour(parseInt(rule.endHour, 10))

  // Must be inside [rStart..rEnd) and not excepted
  if (startJer.isBefore(rStart) || endJer.isAfter(rEnd)) {
    return false
  }
  if (isHourExcepted(rule, hStart, hEnd)) {
    return false
  }
  return true
}

/**
 * Build hour-by-hour auto-block slices in Jerusalem, for a single rule
 * within [dayStart..dayEnd).
 */
function getAutoBlockSlices(rule, dayStart, dayEnd) {
  const slices = []

  // Convert to Moments anchored in Jerusalem
  let cur = moment.tz(dayStart, 'Asia/Jerusalem').startOf('day')
  const end = moment.tz(dayEnd, 'Asia/Jerusalem').endOf('day')

  while (cur.isSameOrBefore(end, 'day')) {
    // For each hour in the rule’s range
    for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
      const sliceStart = cur.clone().hour(h)
      const sliceEnd   = sliceStart.clone().add(1, 'hour')

      // Skip if out of the overall [dayStart..dayEnd] range
      if (sliceEnd.isSameOrBefore(dayStart) || sliceStart.isSameOrAfter(dayEnd)) {
        continue
      }
      // Skip if excepted
      if (isHourExcepted(rule, sliceStart.toDate(), sliceEnd.toDate())) {
        continue
      }
      slices.push([sliceStart.toDate(), sliceEnd.toDate()])
    }
    // Move to next day in Jerusalem
    cur.add(1, 'day').startOf('day')
  }

  return mergeSlices(slices)
}

/**
 * Merge contiguous hour slices into bigger blocks.
 */
function mergeSlices(slices) {
  if (!slices.length) return []
  slices.sort((a, b) => a[0] - b[0])
  const merged = [slices[0]]
  for (let i = 1; i < slices.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = slices[i]
    // If they touch exactly
    if (prev[1].getTime() === curr[0].getTime()) {
      // Extend the previous block
      prev[1] = curr[1]
    } else {
      merged.push(curr)
    }
  }
  return merged
}

/**
 * Build background events from all auto-block rules within [viewStart..viewEnd].
 */
function buildAutoBlockEvents(autoRules, viewStart, viewEnd) {
  const events = []
  autoRules.forEach((rule) => {
    const slices = getAutoBlockSlices(rule, viewStart, viewEnd)
    slices.forEach(([s, e]) => {
      events.push({
        id: `auto-${rule._id}-${s.toISOString()}`,
        start: s,
        end: e,
        display: 'background',
        color: '#ffcccc'
      })
    })
  })
  return events
}

export default function Calendar() {
  const [events, setEvents] = useState([])             // reservations
  const [blockedTimes, setBlockedTimes] = useState([])  // manual-block docs
  const [autoBlockRules, setAutoBlockRules] = useState([])
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const calendarRef = useRef(null)
  const platformDelay = isIOS ? 100 : 10

  // -----------------------------------------------------
  // 1) FETCH data from Sanity (reservations, blocks, auto-rules)
  // -----------------------------------------------------
  useEffect(() => {
    // Reservations
    client
      .fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
      .then((data) => {
        // Let FullCalendar parse the date strings with moment-timezone
        const parsed = data.map((res) => ({
          id: res._id,
          title: res.name,
          start: res.start,
          end: res.end
        }))
        setEvents(parsed)
      })
      .catch((err) => console.error('Error fetching reservations:', err))

    // Manual blocks
    client
      .fetch(`*[_type == "blocked"]{_id, start, end}`)
      .then((data) => {
        const blocks = data.map((item) => ({
          _id: item._id,
          start: item.start,
          end: item.end
        }))
        setBlockedTimes(blocks)
      })
      .catch((err) => console.error('Error fetching blocked times:', err))

    // Auto-block rules
    client
      .fetch(`*[_type == "autoBlockedHours"]{
        _id,
        startHour,
        endHour,
        timeExceptions[]{ date, startHour, endHour }
      }`)
      .then((rules) => {
        setAutoBlockRules(rules)
      })
      .catch((err) => console.error('Error fetching auto-block rules:', err))
  }, [])

  // -----------------------------------------------------
  // 2) Check if a timeslot is blocked by manual blocks
  // -----------------------------------------------------
  function isTimeBlockedByManual(start, end) {
    const startMs = moment.tz(start, 'Asia/Jerusalem').valueOf()
    const endMs   = moment.tz(end,   'Asia/Jerusalem').valueOf()

    return blockedTimes.some((b) => {
      if (!b.start || !b.end) return false
      const blkStart = moment.tz(b.start, 'Asia/Jerusalem').valueOf()
      const blkEnd   = moment.tz(b.end,   'Asia/Jerusalem').valueOf()
      return startMs < blkEnd && endMs > blkStart
    })
  }

  // -----------------------------------------------------
  // 3) Check if a timeslot is auto-blocked
  // -----------------------------------------------------
  function isTimeBlockedByAuto(start, end) {
    return autoBlockRules.some((rule) => doesRuleCover(rule, start, end))
  }

  // -----------------------------------------------------
  // 4) Check if a timeslot is already reserved
  // -----------------------------------------------------
  function isSlotReserved(slotStart, slotEnd) {
    const sMs = moment.tz(slotStart, 'Asia/Jerusalem').valueOf()
    const eMs = moment.tz(slotEnd,   'Asia/Jerusalem').valueOf()

    return events.some((evt) => {
      // skip background events
      if (
        evt.id.startsWith('auto-') ||
        evt.id.startsWith('blocked-') ||
        evt.id === 'past-block'
      ) {
        return false
      }
      const evtStart = moment.tz(evt.start, 'Asia/Jerusalem').valueOf()
      const evtEnd   = moment.tz(evt.end,   'Asia/Jerusalem').valueOf()
      return sMs < evtEnd && eMs > evtStart
    })
  }

  // -----------------------------------------------------
  // 5) Past-block overlay: from midnight to "now" every minute
  // -----------------------------------------------------
  useEffect(() => {
    function updatePastBlockEvent() {
      const nowJer = moment.tz('Asia/Jerusalem')
      const startOfTodayJer = nowJer.clone().startOf('day')
      setPastBlockEvent({
        id: 'past-block',
        start: startOfTodayJer.toISOString(),
        end: nowJer.toISOString(),
        display: 'background',
        color: '#ffcccc'
      })
    }
    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // -----------------------------------------------------
  // 6) Handle user selection => open modal if free
  // -----------------------------------------------------
  const handleSelect = (info) => {
    const { startStr, endStr } = info

    if (isTimeBlockedByManual(startStr, endStr)) return
    if (isTimeBlockedByAuto(startStr, endStr)) return
    if (isSlotReserved(startStr, endStr)) return

    // Store in component state => open modal
    setSelectedInfo({
      start: startStr,
      end: endStr
    })
    setModalIsOpen(true)
  }

  // -----------------------------------------------------
  // 7) Submit reservation => store in Sanity
  // -----------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !selectedInfo) return

    try {
      setIsSubmitting(true)

      const reservationDoc = {
        _type: 'reservation',
        name: formData.name,
        phone: formData.phone,
        start: selectedInfo.start,
        end: selectedInfo.end
      }

      const created = await client.create(reservationDoc)

      // Add to local state so it shows up immediately
      setEvents((prev) => [
        ...prev,
        {
          id: created._id,
          title: formData.name,
          start: selectedInfo.start,
          end: selectedInfo.end
        }
      ])

      setModalIsOpen(false)
      setFormData({ name: '', phone: '' })
      setSelectedInfo(null)
    } catch (err) {
      console.error('Error creating reservation:', err)
      alert('Failed to create reservation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // -----------------------------------------------------
  // 8) Format the chosen times in the modal for display
  // -----------------------------------------------------
  const formatSelectedTime = () => {
    if (!selectedInfo) return ''
    const calendarApi = calendarRef.current?.getApi()
    if (!calendarApi) return ''

    const startTxt = calendarApi.formatDate(selectedInfo.start, {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'long'
    })
    const endTxt = calendarApi.formatDate(selectedInfo.end, {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      minute: '2-digit'
    })
    return `${startTxt} - ${endTxt}`
  }

  // -----------------------------------------------------
  // 9) FullCalendar loads events
  // -----------------------------------------------------
  function loadEvents(fetchInfo, successCallback) {
    const { start, end } = fetchInfo
    const loaded = []

    // A) Normal reservations
    events.forEach((evt) => {
      loaded.push({
        id: evt.id,
        title: evt.title,
        start: evt.start,
        end: evt.end,
        color: '#3788d8'
      })
    })

    // B) Manual blocks => background
    blockedTimes.forEach((b, i) => {
      loaded.push({
        id: `blocked-${i}`,
        start: b.start,
        end: b.end,
        display: 'background',
        color: '#ffcccc'
      })
    })

    // C) Auto-block expansions
    const autoEvents = buildAutoBlockEvents(autoBlockRules, start, end)
    autoEvents.forEach((ev) => loaded.push(ev))

    // D) Past-block overlay
    if (pastBlockEvent) {
      loaded.push(pastBlockEvent)
    }

    successCallback(loaded)
  }

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  return (
    <>
      <div>
        <FullCalendar
          ref={calendarRef}
          // moment-timezone plugins
          plugins={[
            timeGridPlugin,
            scrollGridPlugin,
            interactionPlugin,
            momentPlugin,
            momentTimezonePlugin
          ]}
          // Use named timeZone so user selections also occur in Jerusalem
          timeZone="Asia/Jerusalem"

          initialView="timeGrid30Day"
          views={{
            timeGrid30Day: {
              type: 'timeGrid',
              duration: { days: 30 },
              dayCount: 30,
              buttonText: '30 days'
            }
          }}
          dayMinWidth={200}
          dayHeaderFormat={{
            weekday: 'short',
            month: 'numeric',
            day: 'numeric',
            omitCommas: true
          }}
          stickyHeaderDates
          stickyFooterScrollbar={false}
          longPressDelay={platformDelay}
          selectLongPressDelay={platformDelay}
          eventLongPressDelay={platformDelay}
          selectable
          themeSystem="standard"

          // Limit user to 7 days back -> 30 days ahead
          validRange={{
            start: moment().tz('Asia/Jerusalem').subtract(7, 'days').format(),
            end:   moment().tz('Asia/Jerusalem').add(30, 'days').format()
          }}

          events={loadEvents}
          select={handleSelect}

          selectAllow={(selectInfo) => {
            const selStart = moment.tz(selectInfo.startStr, 'Asia/Jerusalem')
            const selEnd   = moment.tz(selectInfo.endStr,   'Asia/Jerusalem')

            // 1) Forbid times < next hour
            const nextHour = getJerusalemNextHourMoment()
            if (selStart.isBefore(nextHour)) {
              return false
            }

            // 2) Forbid if blocked/reserved
            if (isTimeBlockedByManual(selStart, selEnd)) return false
            if (isTimeBlockedByAuto(selStart, selEnd)) return false
            if (isSlotReserved(selStart, selEnd)) return false

            // 3) Must be exactly 1 hour
            const duration = selEnd.diff(selStart, 'hours', true)
            const isExactlyOneHour = (duration === 1)

            // 4) Typically require same day...
            let sameDay = selStart.isSame(selEnd, 'day')

            // 4b) ...But if it ends exactly at 00:00 local time,
            //     allow it (23:00 -> 00:00).
            if (!sameDay && isExactlyOneHour) {
              if (
                selEnd.hour() === 0 &&
                selEnd.minute() === 0 &&
                selEnd.second() === 0
              ) {
                sameDay = true
              }
            }

            return sameDay && isExactlyOneHour
          }}

          allDaySlot={false}
          slotDuration="01:00:00"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"

          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''
          }}

          eventContent={(arg) => {
            // Hide text for background/past-block/auto-block events
            if (
              arg.event.id.startsWith('blocked-') ||
              arg.event.id === 'past-block' ||
              arg.event.id.startsWith('auto-')
            ) {
              return null
            }
            return <div>{arg.event.title}</div>
          }}

          height="auto"
        />
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => {
          setModalIsOpen(false)
          setIsSubmitting(false)
        }}
        contentLabel="Reservation Form"
        style={{
          overlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000 },
          content: {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '30px',
            borderRadius: '10px',
            background: 'white',
            maxWidth: '400px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }
        }}
      >
        <h2>Reserve a Time Slot</h2>
        <p style={{ marginBottom: '15px', fontStyle: 'italic' }}>
          {formatSelectedTime()}
        </p>
        <form onSubmit={handleSubmit}>
          <label>Name:</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
            style={{ width: '100%', marginBottom: '10px', padding: '6px' }}
          />
          <label>Phone:</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            required
            style={{ width: '100%', marginBottom: '20px', padding: '6px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ marginRight: '10px' }}
            >
              {isSubmitting ? 'Reserving...' : 'Reserve'}
            </button>
            <button
              type="button"
              onClick={() => setModalIsOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
