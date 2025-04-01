import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'

import client from './utils/sanityClient.js'
import Modal from 'react-modal'

Modal.setAppElement('#root')

const ADMIN_PASSWORD = 'admin123'

// Helper: Return midnight X days ago in Asia/Jerusalem
function getJerusalemMidnightXDaysAgo(daysAgo) {
  return moment.tz('Asia/Jerusalem')
    .startOf('day')
    .subtract(daysAgo, 'days')
    .toDate()
}

// 12-hour style + “12 AM (next day)” boundary
const HOUR_OPTIONS_12H = [
  { value: '0',  label: '12 AM' },
  { value: '1',  label: '1 AM'  },
  { value: '2',  label: '2 AM'  },
  { value: '3',  label: '3 AM'  },
  { value: '4',  label: '4 AM'  },
  { value: '5',  label: '5 AM'  },
  { value: '6',  label: '6 AM'  },
  { value: '7',  label: '7 AM'  },
  { value: '8',  label: '8 AM'  },
  { value: '9',  label: '9 AM'  },
  { value: '10', label: '10 AM' },
  { value: '11', label: '11 AM' },
  { value: '12', label: '12 PM' },
  { value: '13', label: '1 PM'  },
  { value: '14', label: '2 PM'  },
  { value: '15', label: '3 PM'  },
  { value: '16', label: '4 PM'  },
  { value: '17', label: '5 PM'  },
  { value: '18', label: '6 PM'  },
  { value: '19', label: '7 PM'  },
  { value: '20', label: '8 PM'  },
  { value: '21', label: '9 PM'  },
  { value: '22', label: '10 PM' },
  { value: '23', label: '11 PM' },
  { value: '24', label: '12 AM (next day)' }
]

// Convert 24-hour string => “12 AM,” etc.
function format24HourTo12(hourStr) {
  if (hourStr === '24') return '12 AM (next day)'
  const found = HOUR_OPTIONS_12H.find((opt) => opt.value === String(hourStr))
  return found ? found.label : `${hourStr}:00`
}

/**
 * AutoBlockControls: small UI for adding/removing auto-block rules
 */
export function AutoBlockControls({ autoBlockRules, setAutoBlockRules, reloadData }) {
  const [startHour, setStartHour] = useState('')
  const [endHour, setEndHour] = useState('')

  // Hover states for "Remove" / "Add" buttons
  const [hoverRemoveId, setHoverRemoveId] = useState(null)
  const [hoverAdd, setHoverAdd] = useState(false)

  // If startHour >= endHour => reset endHour
  useEffect(() => {
    if (
      startHour &&
      endHour &&
      parseInt(endHour, 10) <= parseInt(startHour, 10)
    ) {
      setEndHour('')
    }
  }, [startHour, endHour])

  const filteredEndOptions = !startHour
    ? HOUR_OPTIONS_12H
    : HOUR_OPTIONS_12H.filter(
        (opt) => parseInt(opt.value, 10) > parseInt(startHour, 10)
      )

  const isAddDisabled = !startHour || !endHour

  async function handleAddRule() {
    if (isAddDisabled) return
    try {
      const doc = {
        _type: 'autoBlockedHours',
        startHour,
        endHour,
        timeExceptions: []
      }
      const created = await client.create(doc)
      setAutoBlockRules((prev) => [...prev, created])
      setStartHour('')
      setEndHour('')
      reloadData()
    } catch (err) {
      console.error('Error adding auto-block rule:', err)
    }
  }

  async function handleRemoveRule(id) {
    try {
      await client.delete(id)
      setAutoBlockRules(autoBlockRules.filter((r) => r._id !== id))
      reloadData()
    } catch (err) {
      console.error('Error removing auto-block rule:', err)
    }
  }

  // Basic styles
  const containerStyle = {
    margin: '0.3rem auto',
    padding: '0.3rem',
    border: '1px solid #eee',
    borderRadius: '5px',
    backgroundColor: '#fafafa',
    maxWidth: '300px'
  }

  const listItemStyle = {
    marginBottom: '0.3rem',
    padding: '0.3rem',
    borderRadius: '4px',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    columnGap: '0.5rem'
  }

  // Remove button
  const removeBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '9999px',
    padding: '3px 6px',
    fontSize: '0.63rem',
    cursor: 'pointer',
    background: '#000',
    color: '#fff',
    transition: 'background 0.3s'
  }
  const removeBtnHover = {
    background: '#333'
  }
  const xIconStyle = {
    marginLeft: '4px',
    fontWeight: 'bold'
  }

  // Add Rule button => dark
  const addBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    borderRadius: '9999px',
    padding: '6px 14px',
    fontSize: '0.8rem',
    cursor: isAddDisabled ? 'default' : 'pointer',
    background: isAddDisabled ? '#999' : '#444',
    color: '#fff',
    transition: 'background 0.3s'
  }
  const addBtnHover = {
    background: isAddDisabled ? '#999' : '#222'
  }

  const selectStyle = {
    padding: '2px 4px',
    borderRadius: '3px',
    border: '1px solid #ccc',
    fontSize: '0.8rem'
  }

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem' }}>
        Auto-Block Hours
      </h3>

      <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: '0.5rem' }}>
        {autoBlockRules.map((rule) => {
          const isHovering = hoverRemoveId === rule._id
          return (
            <li key={rule._id} style={listItemStyle}>
              <span style={{ fontSize: '0.85rem' }}>
                Block {format24HourTo12(rule.startHour)} – {format24HourTo12(rule.endHour)}
              </span>
              <button
                onClick={() => handleRemoveRule(rule._id)}
                onMouseEnter={() => setHoverRemoveId(rule._id)}
                onMouseLeave={() => setHoverRemoveId(null)}
                style={{
                  ...removeBtnBase,
                  ...(isHovering ? removeBtnHover : {})
                }}
              >
                Remove<span style={xIconStyle}>×</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontWeight: '600', marginRight: '4px', fontSize:'0.8rem' }}>
            Start:
          </label>
          <select
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- Start --</option>
            {HOUR_OPTIONS_12H.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: '600', marginRight: '4px', fontSize:'0.8rem' }}>
            End:
          </label>
          <select
            value={endHour}
            onChange={(e) => setEndHour(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- End --</option>
            {filteredEndOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={handleAddRule}
            onMouseEnter={() => setHoverAdd(true)}
            onMouseLeave={() => setHoverAdd(false)}
            style={{
              ...addBtnBase,
              ...(hoverAdd ? addBtnHover : {})
            }}
            disabled={isAddDisabled}
          >
            Add Rule
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// MAIN AdminBlockCalendar
// --------------------------------------------------
export default function AdminBlockCalendar() {
  const [authenticated, setAuthenticated] = useState(
    localStorage.getItem('isAdmin') === 'true'
  )
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [autoBlockRules, setAutoBlockRules] = useState([])
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const calendarRef = useRef()

  // 1) Fetch data
  async function fetchData() {
    const calendarApi = calendarRef.current?.getApi()
    const currentViewDate = calendarApi?.getDate()

    // 1) Manual blocks
    const blocksData = await client.fetch(`*[_type == "blocked"]{_id, start, end}`)
    setBlocks(blocksData)

    // 2) Reservations
    const resData = await client.fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
    setReservations(resData)

    // 3) Auto-block hours
    const autoData = await client.fetch(`
      *[_type == "autoBlockedHours"]{
        _id,
        startHour,
        endHour,
        timeExceptions[]{ date, startHour, endHour }
      }
    `)
    setAutoBlockRules(autoData)

    if (calendarApi && currentViewDate) {
      calendarApi.gotoDate(currentViewDate)
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchData()
    }
  }, [authenticated])

  // Past-block overlay: 7 days ago -> now
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

  // ------------------------------------------
  // HELPER: Check if [start,end) is fully blocked
  // ------------------------------------------
  function isRangeCompletelyBlocked(info) {
    const slotStart = new Date(info.start)
    const slotEnd   = new Date(info.end)

    let cursor = slotStart
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      if (!isManuallyBlocked(cursor, nextHour) && !isAutoBlocked(cursor, nextHour)) {
        return false
      }
      cursor = nextHour
    }
    return true
  }

  function isManuallyBlocked(hStart, hEnd) {
    return blocks.some((b) => {
      const bStart = new Date(b.start).getTime()
      const bEnd   = new Date(b.end).getTime()
      return bStart === hStart.getTime() && bEnd === hEnd.getTime()
    })
  }

  function isAutoBlocked(hStart, hEnd) {
    return autoBlockRules.some((rule) => doesRuleCover(rule, hStart, hEnd))
  }

  function doesRuleCover(rule, hStart, hEnd) {
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem   = moment.tz(hEnd, 'Asia/Jerusalem')

    const dayAnchor = startJerusalem.clone().startOf('day')
    const rStart    = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
    const rEnd      = dayAnchor.clone().hour(parseInt(rule.endHour, 10))

    if (startJerusalem.isBefore(rStart) || endJerusalem.isAfter(rEnd)) {
      return false
    }
    if (isHourExcepted(rule, hStart, hEnd)) {
      return false
    }
    return true
  }

  function isHourExcepted(rule, hStart, hEnd) {
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem   = moment.tz(hEnd, 'Asia/Jerusalem')
    const dateStr = startJerusalem.format('YYYY-MM-DD')
    const exceptions = rule.timeExceptions || []

    return exceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0,10) !== dateStr) return false

      const exDay   = startJerusalem.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd   = exDay.clone().hour(parseInt(ex.endHour   || '0', 10))

      return startJerusalem.isBefore(exEnd) && endJerusalem.isAfter(exStart)
    })
  }

  // ------------------------------------------
  // BLOCK
  // ------------------------------------------
  async function handleBlock(info) {
    const slotStart = new Date(info.start)
    const slotEnd   = new Date(info.end)
    if (slotStart < new Date()) {
      alert('Cannot block a past slot.')
      return
    }

    const docs = []
    let cursorBlock = new Date(slotStart)
    while (cursorBlock < slotEnd) {
      const nextBlock = new Date(cursorBlock.getTime() + 3600000)
      if (!isManuallyBlocked(cursorBlock, nextBlock)) {
        docs.push({
          _type: 'blocked',
          start: cursorBlock.toISOString(),
          end: nextBlock.toISOString()
        })
      }
      cursorBlock = nextBlock
    }
    if (!docs.length) {
      alert('All those hours are already blocked.')
      return
    }
    await Promise.all(docs.map((doc) => client.create(doc)))
    fetchData()
  }

  // ------------------------------------------
  // UNBLOCK (lines ~447-448, 463-464 => fixed)
  // ------------------------------------------
  async function handleUnblock(info) {
    const slotStart = new Date(info.start)
    const slotEnd   = new Date(info.end)
    if (slotStart < new Date()) {
      alert('Cannot unblock past time.')
      return
    }

    // 1) Remove manual blocks
    const deletions = []
    let cursorBlock = new Date(slotStart)
    while (cursorBlock < slotEnd) {
      const nextBlock = new Date(cursorBlock.getTime() + 3600000)
      const existing = blocks.find((b) => {
        const bStart = new Date(b.start).getTime()
        const bEnd   = new Date(b.end).getTime()
        return bStart === cursorBlock.getTime() && bEnd === nextBlock.getTime()
      })
      if (existing) {
        deletions.push(client.delete(existing._id))
      }
      cursorBlock = nextBlock
    }

    // 2) Add timeExceptions for any auto-block rule covering that hour
    const patches = []
    let cursorException = new Date(slotStart)
    while (cursorException < slotEnd) {
      const nextException = new Date(cursorException.getTime() + 3600000)

      // local copies => no closure referencing loop variable
      const exceptionStart = new Date(cursorException)
      const exceptionEnd   = new Date(nextException)

      autoBlockRules.forEach((rule) => {
        if (doesRuleCover(rule, exceptionStart, exceptionEnd)) {
          const dateStr = moment.tz(exceptionStart, 'Asia/Jerusalem').format('YYYY-MM-DD')
          const startHr = moment.tz(exceptionStart, 'Asia/Jerusalem').hour()
          const endHr   = moment.tz(exceptionEnd, 'Asia/Jerusalem').hour()

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
      cursorException = nextException
    }

    if (!deletions.length && !patches.length) {
      alert('No matching blocks or auto-block found.')
      return
    }
    await Promise.all([...deletions, ...patches])
    fetchData()
  }

  // Create hour slices for auto-block
  function getAutoBlockSlices(rule, dayStart, dayEnd) {
    const slices = []
    let cursorDay = moment.tz(dayStart, 'Asia/Jerusalem').startOf('day')
    const endOfDay = moment.tz(dayEnd, 'Asia/Jerusalem').endOf('day')

    while (cursorDay.isSameOrBefore(endOfDay, 'day')) {
      for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
        const sliceStart = cursorDay.clone().hour(h)
        const sliceEnd   = sliceStart.clone().add(1, 'hour')

        if (sliceEnd.isSameOrBefore(dayStart) || sliceStart.isSameOrAfter(dayEnd)) {
          continue
        }
        if (isHourExcepted(rule, sliceStart.toDate(), sliceEnd.toDate())) {
          continue
        }
        slices.push([sliceStart.toDate(), sliceEnd.toDate()])
      }
      cursorDay.add(1, 'day').startOf('day')
    }
    return mergeSlices(slices)
  }

  function mergeSlices(slices) {
    if (!slices.length) return []
    slices.sort((a,b) => a[0] - b[0])
    const merged = [slices[0]]
    for (let i = 1; i < slices.length; i++) {
      const prev = merged[merged.length - 1]
      const curr = slices[i]
      if (prev[1].getTime() === curr[0].getTime()) {
        prev[1] = curr[1]
      } else {
        merged.push(curr)
      }
    }
    return merged
  }

  // Check if hour is fully covered by manual blocks
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

  // Load events => FullCalendar
  function loadEvents(fetchInfo, successCallback) {
    const { start, end } = fetchInfo
    const events = []

    // 1) Reservations => show name only
    reservations.forEach((r) => {
      events.push({
        id: r._id,
        title: r.name,
        start: r.start,
        end: r.end,
        color: '#3788d8'
      })
    })

    // 2) Manual blocks => background, dark grey
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

    // 3) Auto-block expansions => also dark grey
    autoBlockRules.forEach((rule) => {
      const slices = getAutoBlockSlices(rule, start, end)
      slices.forEach(([s, e]) => {
        if (!fullyCoveredByManual(s, e)) {
          events.push({
            id: `auto-${rule._id}-${s.toISOString()}`,
            title: 'Blocked',
            start: s,
            end: e,
            display: 'background',
            color: '#999999'
          })
        }
      })
    })

    // 4) Past-block overlay => #6e6e6e
    if (pastBlockEvent) {
      events.push(pastBlockEvent)
    }

    successCallback(events)
  }

  // Hide time => reservations show name only
  function handleEventContent(arg) {
    if (arg.event.display === 'background') {
      return null
    }
    return <div>{arg.event.title}</div>
  }

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

  // Auth guard
  if (!authenticated) {
    return (
      <div
        style={{
          display:'flex',
          flexDirection:'column',
          justifyContent:'center',
          alignItems:'center',
          height:'100vh',
          padding:'1rem',
          background:'#fff'
        }}
      >
        <h2 style={{ fontSize:'1.5rem', marginBottom:'1rem' }}>
          Enter Admin Password
        </h2>
        <input
          type="password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.target.value === ADMIN_PASSWORD) {
                localStorage.setItem('isAdmin','true')
                setAuthenticated(true)
              } else {
                alert('Incorrect password')
              }
            }
          }}
          placeholder="Admin password"
          style={{
            width:'100%',
            maxWidth:'300px',
            padding:'12px',
            fontSize:'1rem',
            marginBottom:'1rem',
            border:'1px solid #ccc',
            borderRadius:'5px'
          }}
        />
        <button
          onClick={() => {
            const input = document.querySelector('input[type="password"]')
            if (input.value === ADMIN_PASSWORD) {
              localStorage.setItem('isAdmin','true')
              setAuthenticated(true)
            } else {
              alert('Incorrect password')
            }
          }}
          style={{
            padding:'12px 24px',
            fontSize:'1rem',
            backgroundColor:'#1890ff',
            color:'#fff',
            border:'none',
            borderRadius:'5px'
          }}
        >
          Submit
        </button>
      </div>
    )
  }

  // Valid range => 7 days back -> 30 days ahead
  const now = new Date()
  const validRangeStart = new Date(now)
  validRangeStart.setHours(0, 0, 0, 0)
  validRangeStart.setDate(validRangeStart.getDate() - 7)

  const validRangeEnd = new Date(now)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <div>
      <h2 style={{ textAlign:'center', marginBottom:'1rem' }}>
        Admin Panel
      </h2>

      <AutoBlockControls
        autoBlockRules={autoBlockRules}
        setAutoBlockRules={setAutoBlockRules}
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
        dayHeaderFormat={{
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
          omitCommas: true
        }}
        stickyHeaderDates
        stickyFooterScrollbar={false}
        dayMinWidth={120}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        height="auto"
        longPressDelay={100}
        selectLongPressDelay={100}
        eventLongPressDelay={100}
        validRange={{
          start: validRangeStart.toISOString(),
          end: validRangeEnd.toISOString()
        }}
        selectable
        selectAllow={(selectInfo) => new Date(selectInfo.startStr) >= new Date()}
        select={(info) => {
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
        eventContent={handleEventContent}   // Show name for reservations, none for blocked
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
      />

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Reservation Info"
        style={{
          overlay: {
            backgroundColor:'rgba(0,0,0,0.4)',
            zIndex:1000
          },
          content: {
            top:'50%',
            left:'50%',
            transform:'translate(-50%,-50%)',
            padding:'25px',
            borderRadius:'8px',
            background:'white',
            width:'300px'
          }
        }}
      >
        <h3>Reservation Details</h3>
        {selectedReservation && (
          <div>
            <p><strong>Name:</strong> {selectedReservation.name}</p>
            <p><strong>Phone:</strong> {selectedReservation.phone}</p>
          </div>
        )}
        <div style={{display:'flex', justifyContent:'flex-end', marginTop:'20px'}}>
          <button
            onClick={handleDeleteReservation}
            style={{
              marginRight:'10px',
              color:'#fff',
              background:'#d9534f',
              border:'none',
              padding:'8px 12px',
              borderRadius:'4px',
              cursor:'pointer'
            }}
          >
            Delete
          </button>
          <button
            onClick={() => setModalIsOpen(false)}
            style={{ padding:'8px 12px', cursor:'pointer' }}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
