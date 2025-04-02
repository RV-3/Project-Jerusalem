import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import { isIOS } from 'react-device-detect'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'

// Import your newly separated AutoBlockControls component
import { AutoBlockControls } from './admin/AutoBlockControls.js'

// Make sure modal is attached properly
Modal.setAppElement('#root')

// Simple admin password check (for demo)
const ADMIN_PASSWORD = 'admin123'

// Helper: get midnight in Jerusalem X days ago
function getJerusalemMidnightXDaysAgo(daysAgo) {
  return moment.tz('Asia/Jerusalem')
    .startOf('day')
    .subtract(daysAgo, 'days')
    .toDate()
}

// ---------------------------------------------------------------------
// MAIN AdminBlockCalendar COMPONENT
// ---------------------------------------------------------------------
export default function AdminBlockCalendar() {
  const [authenticated, setAuthenticated] = useState(
    localStorage.getItem('isAdmin') === 'true'
  )
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [autoBlockRules, setAutoBlockRules] = useState([])
  const [autoBlockDays, setAutoBlockDays] = useState(null)
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const calendarRef = useRef()
  const platformDelay = isIOS ? 100 : 47

  // Fetch from Sanity
  async function fetchData() {
    const calendarApi = calendarRef.current?.getApi()
    const currentViewDate = calendarApi?.getDate()

    // 1) Manual blocks
    const blocksData = await client.fetch(`*[_type == "blocked"]{_id, start, end}`)
    setBlocks(blocksData)

    // 2) Reservations
    const resData = await client.fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
    setReservations(resData)

    // 3) Hour-based auto-block
    const autoData = await client.fetch(`
      *[_type == "autoBlockedHours"]{
        _id,
        startHour,
        endHour,
        timeExceptions[]{ date, startHour, endHour }
      }
    `)
    setAutoBlockRules(autoData)

    // 4) Day-based auto-block
    const daysDoc = await client.fetch(`
      *[_type == "autoBlockedDays"]{
        _id,
        daysOfWeek,
        timeExceptions[]{ date, startHour, endHour }
      }
    `)
    setAutoBlockDays(daysDoc.length ? daysDoc[0] : null)

    if (calendarApi && currentViewDate) {
      calendarApi.gotoDate(currentViewDate)
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchData()
    }
  }, [authenticated])

  // Past-block overlay: from 7 days ago -> now
  useEffect(() => {
    function updatePastBlockEvent() {
      const earliest = getJerusalemMidnightXDaysAgo(7)
      const now = new Date()
      setPastBlockEvent({
        id: 'past-block',
        start: earliest,
        end: now,
        display: 'background',
        color: '#6e6e6e'
      })
    }
    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Utility: check if entire selection is blocked hour-by-hour
  function isRangeCompletelyBlocked(info) {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    let cursor = slotStart
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      const localHourStart = new Date(cursor.getTime())
      const localHourEnd = new Date(nextHour.getTime())

      if (
        !isManuallyBlocked(localHourStart, localHourEnd) &&
        !isAutoBlocked(localHourStart, localHourEnd)
      ) {
        return false
      }
      cursor = nextHour
    }
    return true
  }

  function isManuallyBlocked(hStart, hEnd) {
    return blocks.some((b) => {
      const bStart = new Date(b.start).getTime()
      const bEnd = new Date(b.end).getTime()
      return bStart === hStart.getTime() && bEnd === hEnd.getTime()
    })
  }

  // High-level check for day-based or hour-based auto-block
  function isAutoBlocked(hStart, hEnd) {
    // 1) day-based
    if (autoBlockDays?.daysOfWeek?.length) {
      const dayName = moment.tz(hStart, 'Asia/Jerusalem').format('dddd')
      if (autoBlockDays.daysOfWeek.includes(dayName)) {
        if (!isDayLevelExcepted(hStart, hEnd)) {
          return true
        }
      }
    }
    // 2) hour-based
    return autoBlockRules.some((rule) => doesRuleCoverHourRule(rule, hStart, hEnd))
  }

  function isDayLevelExcepted(hStart, hEnd) {
    if (!autoBlockDays?.timeExceptions?.length) return false
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem = moment.tz(hEnd, 'Asia/Jerusalem')
    const dateStr = startJerusalem.format('YYYY-MM-DD')

    return autoBlockDays.timeExceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false

      const exDay = startJerusalem.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd = exDay.clone().hour(parseInt(ex.endHour || '0', 10))

      return startJerusalem.isBefore(exEnd) && endJerusalem.isAfter(exStart)
    })
  }

  function doesRuleCoverHourRule(rule, hStart, hEnd) {
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem = moment.tz(hEnd, 'Asia/Jerusalem')

    const dayAnchor = startJerusalem.clone().startOf('day')
    const rStart = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
    const rEnd = dayAnchor.clone().hour(parseInt(rule.endHour, 10))

    // Must be within the rule’s hour range
    if (startJerusalem.isBefore(rStart) || endJerusalem.isAfter(rEnd)) {
      return false
    }
    // Also ensure not excepted
    if (isHourRuleExcepted(rule, hStart, hEnd)) {
      return false
    }
    return true
  }

  function isHourRuleExcepted(rule, hStart, hEnd) {
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem = moment.tz(hEnd, 'Asia/Jerusalem')
    const dateStr = startJerusalem.format('YYYY-MM-DD')
    const exceptions = rule.timeExceptions || []

    return exceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false

      const exDay = startJerusalem.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd = exDay.clone().hour(parseInt(ex.endHour || '0', 10))

      return startJerusalem.isBefore(exEnd) && endJerusalem.isAfter(exStart)
    })
  }

  // Blocking a new time range
  async function handleBlock(info) {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    if (slotStart < new Date()) {
      alert('Cannot block a past slot.')
      return
    }

    const docs = []
    let cursor = new Date(slotStart)
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      const localHourStart = new Date(cursor.getTime())
      const localHourEnd = new Date(nextHour.getTime())

      if (!isManuallyBlocked(localHourStart, localHourEnd)) {
        docs.push({
          _type: 'blocked',
          start: localHourStart.toISOString(),
          end: localHourEnd.toISOString()
        })
      }
      cursor = nextHour
    }
    if (!docs.length) {
      alert('All those hours are already blocked.')
      return
    }
    await Promise.all(docs.map((doc) => client.create(doc)))
    fetchData()
  }

  // Unblocking a time range => remove manual blocks + add exceptions if needed
  async function handleUnblock(info) {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    if (slotStart < new Date()) {
      alert('Cannot unblock past time.')
      return
    }

    // 1) Remove manual blocks
    const deletions = []
    let cursor = new Date(slotStart)
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      const localHourStart = new Date(cursor.getTime())
      const localHourEnd = new Date(nextHour.getTime())

      const existing = blocks.find((b) => {
        const bStart = new Date(b.start).getTime()
        const bEnd = new Date(b.end).getTime()
        return bStart === localHourStart.getTime() && bEnd === localHourEnd.getTime()
      })
      if (existing) {
        deletions.push(client.delete(existing._id))
      }
      cursor = nextHour
    }

    // 2) Add timeExceptions to hour/day rules, if they cover this slot
    const patches = []
    let exCursor = new Date(slotStart)
    while (exCursor < slotEnd) {
      const nextHr = new Date(exCursor.getTime() + 3600000)
      const localSlotStart = new Date(exCursor.getTime())
      const localSlotEnd = new Date(nextHr.getTime())

      // hour-based
      autoBlockRules.forEach((rule) => {
        if (doesRuleCoverHourRule(rule, localSlotStart, localSlotEnd)) {
          const dateStr = moment.tz(localSlotStart, 'Asia/Jerusalem').format('YYYY-MM-DD')
          const startHr = moment.tz(localSlotStart, 'Asia/Jerusalem').hour()
          const endHr = moment.tz(localSlotEnd, 'Asia/Jerusalem').hour()

          const ex = {
            _type: 'timeException',
            date: dateStr,
            startHour: String(startHr),
            endHour: String(endHr)
          }
          patches.push(
            client
              .patch(rule._id)
              .setIfMissing({ timeExceptions: [] })
              .append('timeExceptions', [ex])
              .commit()
          )
        }
      })

      // day-based
      if (autoBlockDays?.daysOfWeek?.length) {
        const dayName = moment.tz(localSlotStart, 'Asia/Jerusalem').format('dddd')
        if (autoBlockDays.daysOfWeek.includes(dayName)) {
          const dateStr = moment.tz(localSlotStart, 'Asia/Jerusalem').format('YYYY-MM-DD')
          const startHr = moment.tz(localSlotStart, 'Asia/Jerusalem').hour()
          const endHr = moment.tz(localSlotEnd, 'Asia/Jerusalem').hour()

          const ex = {
            _type: 'timeException',
            date: dateStr,
            startHour: String(startHr),
            endHour: String(endHr)
          }
          patches.push(
            client
              .patch(autoBlockDays._id)
              .setIfMissing({ timeExceptions: [] })
              .append('timeExceptions', [ex])
              .commit()
          )
        }
      }
      exCursor = nextHr
    }

    await Promise.all([...deletions, ...patches])
    fetchData()
  }

  // Used by loadEvents() to build background "blocked" events from auto rules
  function getAutoBlockSlices(rule, dayStart, dayEnd) {
    const slices = []
    let cursorDay = moment.tz(dayStart, 'Asia/Jerusalem').startOf('day')
    const endOfDay = moment.tz(dayEnd, 'Asia/Jerusalem').endOf('day')

    while (cursorDay.isSameOrBefore(endOfDay, 'day')) {
      for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
        const sliceStart = cursorDay.clone().hour(h)
        const sliceEnd = sliceStart.clone().add(1, 'hour')
        if (sliceEnd <= dayStart || sliceStart >= dayEnd) {
          continue
        }
        if (isHourRuleExcepted(rule, sliceStart.toDate(), sliceEnd.toDate())) {
          continue
        }
        slices.push([sliceStart.toDate(), sliceEnd.toDate()])
      }
      cursorDay.add(1, 'day').startOf('day')
    }
    return mergeSlices(slices)
  }

  function getDayBlockSlices(dayDoc, rangeStart, rangeEnd) {
    const slices = []
    if (!dayDoc.daysOfWeek?.length) return slices

    let current = new Date(rangeStart)
    current.setHours(0, 0, 0, 0)
    while (current < rangeEnd) {
      const dayName = moment.tz(current, 'Asia/Jerusalem').format('dddd')
      if (dayDoc.daysOfWeek.includes(dayName)) {
        for (let h = 0; h < 24; h++) {
          const sliceStart = moment
            .tz(current, 'Asia/Jerusalem')
            .hour(h)
            .toDate()
          const sliceEnd = new Date(sliceStart.getTime() + 3600000)

          if (sliceEnd <= rangeStart || sliceStart >= rangeEnd) continue
          if (isDayLevelExcepted(sliceStart, sliceEnd)) continue

          slices.push([sliceStart, sliceEnd])
        }
      }
      current.setDate(current.getDate() + 1)
    }
    return mergeSlices(slices)
  }

  function mergeSlices(slices) {
    if (!slices.length) return []
    slices.sort((a, b) => a[0] - b[0])
    const merged = [slices[0]]
    for (let i = 1; i < slices.length; i++) {
      const prev = merged[merged.length - 1]
      const curr = slices[i]
      // If current slice starts exactly when previous ends => merge them
      if (prev[1].getTime() === curr[0].getTime()) {
        prev[1] = curr[1]
      } else {
        merged.push(curr)
      }
    }
    return merged
  }

  // Check if a block is fully covered by manual blocks
  function fullyCoveredByManual(start, end) {
    let cursorCheck = new Date(start)
    while (cursorCheck < end) {
      const nxt = new Date(cursorCheck.getTime() + 3600000)
      if (!isManuallyBlocked(cursorCheck, nxt)) {
        return false
      }
      cursorCheck = nxt
    }
    return true
  }

  // Called by FullCalendar to load events
  function loadEvents(fetchInfo, successCallback) {
    const { start, end } = fetchInfo
    const events = []

    // 1) Reservations => normal events
    reservations.forEach((r) => {
      events.push({
        id: r._id,
        title: r.name,
        start: r.start,
        end: r.end,
        color: '#3788d8'
      })
    })

    // 2) Manual blocks => background
    blocks.forEach((b) => {
      events.push({
        id: b._id,
        title: 'Blocked',
        start: b.start,
        end: b.end,
        display: 'background',
        color: '#999999'
      })
    })

    // 3) Day-based expansions => hour slices
    if (autoBlockDays) {
      const daySlices = getDayBlockSlices(autoBlockDays, start, end)
      daySlices.forEach(([s, e]) => {
        if (!fullyCoveredByManual(s, e)) {
          events.push({
            id: `auto-day-${autoBlockDays._id}-${s.toISOString()}`,
            title: 'Blocked',
            start: s,
            end: e,
            display: 'background',
            color: '#999999'
          })
        }
      })
    }

    // 4) Hour-based expansions => background
    autoBlockRules.forEach((rule) => {
      const slices = getAutoBlockSlices(rule, start, end)
      slices.forEach(([s, e]) => {
        if (!fullyCoveredByManual(s, e)) {
          events.push({
            id: `auto-hour-${rule._id}-${s.toISOString()}`,
            title: 'Blocked',
            start: s,
            end: e,
            display: 'background',
            color: '#999999'
          })
        }
      })
    })

    // 5) Past-block overlay
    if (pastBlockEvent) {
      events.push(pastBlockEvent)
    }

    successCallback(events)
  }

  // Only show text label for non-background events
  function handleEventContent(arg) {
    if (arg.event.display === 'background') {
      return null
    }
    return <div>{arg.event.title}</div>
  }

  // Click a reservation => open modal
  function handleEventClick(clickInfo) {
    const r = reservations.find((x) => x._id === clickInfo.event.id)
    if (r) {
      setSelectedReservation(r)
      setModalIsOpen(true)
    }
  }

  async function handleDeleteReservation() {
    if (!selectedReservation) return
    if (!window.confirm('Delete this reservation?')) return
    await client.delete(selectedReservation._id)
    fetchData()
    setModalIsOpen(false)
    setSelectedReservation(null)
  }

  // Simple password gate
  if (!authenticated) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '1rem',
          background: '#fff'
        }}
      >
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Enter Admin Password
        </h2>
        <input
          type="password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.target.value === ADMIN_PASSWORD) {
                localStorage.setItem('isAdmin', 'true')
                setAuthenticated(true)
              } else {
                alert('Incorrect password')
              }
            }
          }}
          placeholder="Admin password"
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '12px',
            fontSize: '1rem',
            marginBottom: '1rem',
            border: '1px solid #ccc',
            borderRadius: '5px'
          }}
        />
        <button
          onClick={() => {
            const input = document.querySelector('input[type="password"]')
            if (input.value === ADMIN_PASSWORD) {
              localStorage.setItem('isAdmin', 'true')
              setAuthenticated(true)
            } else {
              alert('Incorrect password')
            }
          }}
          style={{
            padding: '12px 24px',
            fontSize: '1rem',
            backgroundColor: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          Submit
        </button>
      </div>
    )
  }

  const now = new Date()
  const validRangeStart = new Date(now)
  validRangeStart.setHours(0, 0, 0, 0)
  validRangeStart.setDate(validRangeStart.getDate() - 7)

  const validRangeEnd = new Date(now)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.8rem' }}>
        Admin Panel
      </h2>

      {/* Auto-block subcomponent (moved out to AutoBlockControls.js) */}
      <AutoBlockControls
        autoBlockRules={autoBlockRules}
        setAutoBlockRules={setAutoBlockRules}
        autoBlockDays={autoBlockDays}
        setAutoBlockDays={setAutoBlockDays}
        reloadData={fetchData}
      />

      <FullCalendar
        ref={calendarRef}
        plugins={[
          timeGridPlugin,
          scrollGridPlugin,
          interactionPlugin,
          momentPlugin,
          momentTimezonePlugin
        ]}
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
        dayMinWidth={240}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        height="auto"
        stickyHeaderDates
        stickyFooterScrollbar={false}
        longPressDelay={platformDelay}
        selectLongPressDelay={platformDelay}
        eventLongPressDelay={platformDelay}
        validRange={{
          start: validRangeStart.toISOString(),
          end: validRangeEnd.toISOString()
        }}
        selectable
        selectAllow={(selectInfo) => new Date(selectInfo.startStr) >= new Date()}
        select={(info) => {
          // If fully blocked => ask to unblock
          if (isRangeCompletelyBlocked(info)) {
            if (window.confirm('Unblock this time slot?')) {
              handleUnblock(info)
            }
          } else {
            if (window.confirm('Block this time slot?')) {
              handleBlock(info)
            }
          }
        }}
        events={loadEvents}
        eventContent={handleEventContent}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
        dayHeaderFormat={{
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
          omitCommas: true
        }}
      />

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Reservation Info"
        style={{
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 1000
          },
          content: {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            padding: '25px',
            borderRadius: '8px',
            background: 'white',
            width: '400px'
          }
        }}
      >
        <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          Reservation Details
        </h3>
        {selectedReservation && (
          <div style={{ fontSize: '1rem' }}>
            <p>
              <strong>Name:</strong> {selectedReservation.name}
            </p>
            <p>
              <strong>Phone:</strong> {selectedReservation.phone}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={handleDeleteReservation}
            style={{
              marginRight: '10px',
              color: '#fff',
              background: '#d9534f',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Delete
          </button>
          <button
            onClick={() => setModalIsOpen(false)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
