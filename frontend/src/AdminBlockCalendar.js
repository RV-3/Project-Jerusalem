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

// Make sure modal is attached properly
Modal.setAppElement('#root')

const ADMIN_PASSWORD = 'admin123'

// Helper: get midnight in Jerusalem X days ago
function getJerusalemMidnightXDaysAgo(daysAgo) {
  return moment.tz('Asia/Jerusalem')
    .startOf('day')
    .subtract(daysAgo, 'days')
    .toDate()
}

// 12-hour style + "12 AM (next day)"
const HOUR_OPTIONS_12H = [
  { value: '0', label: '12 AM' },
  { value: '1', label: '1 AM' },
  { value: '2', label: '2 AM' },
  { value: '3', label: '3 AM' },
  { value: '4', label: '4 AM' },
  { value: '5', label: '5 AM' },
  { value: '6', label: '6 AM' },
  { value: '7', label: '7 AM' },
  { value: '8', label: '8 AM' },
  { value: '9', label: '9 AM' },
  { value: '10', label: '10 AM' },
  { value: '11', label: '11 AM' },
  { value: '12', label: '12 PM' },
  { value: '13', label: '1 PM' },
  { value: '14', label: '2 PM' },
  { value: '15', label: '3 PM' },
  { value: '16', label: '4 PM' },
  { value: '17', label: '5 PM' },
  { value: '18', label: '6 PM' },
  { value: '19', label: '7 PM' },
  { value: '20', label: '8 PM' },
  { value: '21', label: '9 PM' },
  { value: '22', label: '10 PM' },
  { value: '23', label: '11 PM' },
  { value: '24', label: '12 AM (next day)' }
]

// For short day labels displayed as chips
const DAY_SHORT_MAP = {
  Sunday: 'Su',
  Monday: 'M',
  Tuesday: 'T',
  Wednesday: 'W',
  Thursday: 'Th',
  Friday: 'F',
  Saturday: 'Sa'
}

// For toggles in the modal
const DAY_TOGGLES = [
  { full: 'Sunday',    short: 'Su' },
  { full: 'Monday',    short: 'Mo' },
  { full: 'Tuesday',   short: 'Tu' },
  { full: 'Wednesday', short: 'We' },
  { full: 'Thursday',  short: 'Th' },
  { full: 'Friday',    short: 'Fr' },
  { full: 'Saturday',  short: 'Sa' }
]

function format24HourTo12(hourStr) {
  if (hourStr === '24') {
    return '12 AM (next day)'
  }
  const found = HOUR_OPTIONS_12H.find((opt) => opt.value === String(hourStr))
  return found ? found.label : `${hourStr}:00`
}

// ---------------------------------------------------------------------
// AUTO-BLOCK CONTROLS with Toggles
// ---------------------------------------------------------------------
export function AutoBlockControls({
  autoBlockRules,
  setAutoBlockRules,
  autoBlockDays,
  setAutoBlockDays,
  reloadData
}) {
  // Toggles for the Hours and Days sections
  const [showHours, setShowHours] = useState(false)
  const [showDays, setShowDays]   = useState(false)

  // Keep track of previous day selection so we can detect newly added days
  const [selectedDays, setSelectedDays] = useState([])
  useEffect(() => {
    if (autoBlockDays?.daysOfWeek) {
      setSelectedDays(autoBlockDays.daysOfWeek)
    } else {
      setSelectedDays([])
    }
  }, [autoBlockDays])

  // ---------------------------
  // HOURS LOGIC
  // ---------------------------
  const [startHour, setStartHour]       = useState('')
  const [endHour, setEndHour]           = useState('')
  const [hoverRemoveId, setHoverRemoveId] = useState(null)
  const [hoverAdd, setHoverAdd]         = useState(false)

  useEffect(() => {
    if (startHour && endHour && parseInt(endHour, 10) <= parseInt(startHour, 10)) {
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

  // ---------------------------
  // DAYS LOGIC (pop-up with toggles)
  // ---------------------------
  const [daysModalOpen, setDaysModalOpen] = useState(false)

  // Remove a single day => immediate doc update
  async function removeDay(dayFull) {
    const newArr = selectedDays.filter((d) => d !== dayFull)
    await saveDaysToSanity(newArr)
  }

  // Toggling inside the modal
  function toggleDay(dayFull) {
    setSelectedDays((prev) =>
      prev.includes(dayFull)
        ? prev.filter((d) => d !== dayFull)
        : [...prev, dayFull]
    )
  }

  async function handleSaveDaysModal() {
    // Detect newly added days => remove timeExceptions for those
    // so that re-adding a day overrides any previous unblocking
    const oldDays = autoBlockDays?.daysOfWeek || []
    const newlyAddedDays = selectedDays.filter((d) => !oldDays.includes(d))

    await saveDaysToSanity(selectedDays, newlyAddedDays)
    alert('Blocked days saved.')
    setDaysModalOpen(false)
  }

  // Shared doc saver
  async function saveDaysToSanity(daysArr, newlyAddedDays = []) {
    try {
      const docId = autoBlockDays?._id || 'autoBlockedDaysSingleton'
      // build doc
      const docToSave = {
        _id: docId,
        _type: 'autoBlockedDays',
        daysOfWeek: daysArr,
        timeExceptions: autoBlockDays?.timeExceptions || []
      }

      // --------------- OVERRIDE FIX ---------------
      // For each newly added day, remove any timeExceptions that
      // match that day in the future so re-applying day-block
      // truly overrides older manual unblocking.
      if (newlyAddedDays.length && docToSave.timeExceptions?.length) {
        // filter out exceptions that match these day(s)
        const filteredEx = docToSave.timeExceptions.filter((ex) => {
          if (!ex.date) return true // keep if no date?

          const exDayName = moment.tz(ex.date, 'Asia/Jerusalem').format('dddd')
          // if it's a day that was newly added, remove that exception
          if (newlyAddedDays.includes(exDayName)) {
            return false
          }
          return true
        })
        docToSave.timeExceptions = filteredEx
      }
      // --------------- END OVERRIDE FIX ------------

      // save doc
      await client.createOrReplace(docToSave)
      reloadData()
    } catch (err) {
      console.error('Error saving day-block doc:', err)
      alert('Could not save blocked days. See console.')
    }
  }

  // ---------------------------
  // STYLES
  // ---------------------------
  const containerStyle = {
    margin: '1rem auto',
    padding: '1rem',
    border: '2px solid #eee',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
    maxWidth: '600px',
    fontSize: '1.2rem'
  }

  const toggleHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '0.5rem 0',
    fontSize: '1.3rem',
    fontWeight: 'bold'
  }

  const listItemStyle = {
    marginBottom: '0.8rem',
    padding: '0.8rem',
    borderRadius: '6px',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    columnGap: '1rem'
  }

  const removeBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #000',
    borderRadius: '9999px',
    padding: '0.5px 10px',
    fontSize: '1rem',
    cursor: 'pointer',
    background: '#eeeeee',
    color: '#000000',
    transition: 'background 0.3s, color 0.3s, border-color 0.3s'
  }
  const removeBtnHover = {
    background: '#333',
    color: '#fff'
  }

  const xIconStyle = {
    marginLeft: '5px',
    fontWeight: 'normal',
    fontSize: '2rem'
  }

  const addBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    borderRadius: '9999px',
    padding: '8px 16px',
    fontSize: '1rem',
    cursor: isAddDisabled ? 'default' : 'pointer',
    background: isAddDisabled ? '#999' : '#444',
    color: '#fff',
    transition: 'background 0.3s'
  }
  const addBtnHover = {
    background: isAddDisabled ? '#999' : '#222'
  }

  const selectStyle = {
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '1rem'
  }

  const chipStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    background: '#ddd',
    borderRadius: '4px',
    marginRight: '6px',
    fontSize: '1rem'
  }

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div style={containerStyle}>
      {/* ================= HOURS TOGGLE ================= */}
      <div
        style={toggleHeaderStyle}
        onClick={() => setShowHours((prev) => !prev)}
      >
        <span>Auto-Block Hours</span>
        <span style={{ fontSize: '1rem' }}>
          {showHours ? '▲ Hide' : '▼ Show'}
        </span>
      </div>
      {showHours && (
        <div style={{ marginBottom: '2rem' }}>
          <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: '1rem' }}>
            {autoBlockRules.map((rule) => {
              const isHovering = hoverRemoveId === rule._id
              return (
                <li key={rule._id} style={listItemStyle}>
                  <span>
                    <strong>Block:</strong>{' '}
                    {format24HourTo12(rule.startHour)} – {format24HourTo12(rule.endHour)}
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

          <div
            style={{
              display: 'flex',
              gap: '0.8rem',
              flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}
          >
            <div>
              <label
                style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}
              >
                Start Hour:
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
              <label
                style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}
              >
                End Hour:
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
      )}

      {/* ================= DAYS TOGGLE ================= */}
      <div
        style={toggleHeaderStyle}
        onClick={() => setShowDays((prev) => !prev)}
      >
        <span>Auto-Block Days</span>
        <span style={{ fontSize: '1rem' }}>
          {showDays ? '▲ Hide' : '▼ Show'}
        </span>
      </div>
      {showDays && (
        <div>
          {/* Show existing days as chips */}
          <div style={{ margin: '0.5rem 0' }}>
            {(!autoBlockDays?.daysOfWeek || autoBlockDays.daysOfWeek.length === 0) ? (
              <em>No days blocked</em>
            ) : (
              autoBlockDays.daysOfWeek.map((day) => (
                <span key={day} style={chipStyle}>
                  {DAY_SHORT_MAP[day] || day}
                  <button
                    onClick={() => removeDay(day)}
                    style={{
                      marginLeft: '6px',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1rem'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Button => opens modal with toggles */}
          <button
            onClick={() => setDaysModalOpen(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '1px solid #555',
              backgroundColor: '#eee',
              cursor: 'pointer'
            }}
          >
            Block Days
          </button>

          <Modal
            isOpen={daysModalOpen}
            onRequestClose={() => setDaysModalOpen(false)}
            contentLabel="Block Days Modal"
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
                width:'400px'
              }
            }}
          >
            <h3 style={{ marginBottom: '1rem' }}>Select which days to block</h3>
            <div
              style={{
                display:'flex',
                justifyContent:'center',
                flexWrap:'wrap',
                gap:'1rem',
                marginBottom:'1.5rem'
              }}
            >
              {DAY_TOGGLES.map(({ full, short }) => {
                const active = selectedDays.includes(full)
                return (
                  <button
                    key={full}
                    onClick={() => toggleDay(full)}
                    style={{
                      minWidth:'45px',
                      padding:'8px',
                      borderRadius:'6px',
                      border:'1px solid #444',
                      background: active ? '#444' : '#fff',
                      color: active ? '#fff' : '#444',
                      cursor:'pointer',
                      fontSize:'1rem'
                    }}
                  >
                    {short}
                  </button>
                )
              })}
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:'1rem' }}>
              <button
                onClick={handleSaveDaysModal}
                style={{
                  backgroundColor:'#28a745',
                  color:'#fff',
                  border:'none',
                  padding:'8px 12px',
                  borderRadius:'4px',
                  cursor:'pointer',
                  fontSize:'1rem'
                }}
              >
                Save
              </button>
              <button
                onClick={() => setDaysModalOpen(false)}
                style={{
                  padding:'8px 12px',
                  cursor:'pointer',
                  fontSize:'1rem'
                }}
              >
                Cancel
              </button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
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
    const slotEnd   = new Date(info.end)
    let cursor = slotStart
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      const localHourStart = new Date(cursor.getTime())
      const localHourEnd   = new Date(nextHour.getTime())

      if (!isManuallyBlocked(localHourStart, localHourEnd) && !isAutoBlocked(localHourStart, localHourEnd)) {
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
    const endJerusalem   = moment.tz(hEnd,   'Asia/Jerusalem')
    const dateStr = startJerusalem.format('YYYY-MM-DD')

    return autoBlockDays.timeExceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false

      const exDay   = startJerusalem.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd   = exDay.clone().hour(parseInt(ex.endHour || '0', 10))

      return startJerusalem.isBefore(exEnd) && endJerusalem.isAfter(exStart)
    })
  }

  function doesRuleCoverHourRule(rule, hStart, hEnd) {
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem   = moment.tz(hEnd,   'Asia/Jerusalem')

    const dayAnchor = startJerusalem.clone().startOf('day')
    const rStart = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
    const rEnd   = dayAnchor.clone().hour(parseInt(rule.endHour,   10))

    if (startJerusalem.isBefore(rStart) || endJerusalem.isAfter(rEnd)) {
      return false
    }
    if (isHourRuleExcepted(rule, hStart, hEnd)) {
      return false
    }
    return true
  }

  function isHourRuleExcepted(rule, hStart, hEnd) {
    const startJerusalem = moment.tz(hStart, 'Asia/Jerusalem')
    const endJerusalem   = moment.tz(hEnd,   'Asia/Jerusalem')
    const dateStr = startJerusalem.format('YYYY-MM-DD')
    const exceptions = rule.timeExceptions || []

    return exceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false

      const exDay   = startJerusalem.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd   = exDay.clone().hour(parseInt(ex.endHour || '0', 10))

      return startJerusalem.isBefore(exEnd) && endJerusalem.isAfter(exStart)
    })
  }

  async function handleBlock(info) {
    const slotStart = new Date(info.start)
    const slotEnd   = new Date(info.end)
    if (slotStart < new Date()) {
      alert('Cannot block a past slot.')
      return
    }

    const docs = []
    let cursor = new Date(slotStart)
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      const localHourStart = new Date(cursor.getTime())
      const localHourEnd   = new Date(nextHour.getTime())

      if (!isManuallyBlocked(localHourStart, localHourEnd)) {
        docs.push({
          _type: 'blocked',
          start: localHourStart.toISOString(),
          end:   localHourEnd.toISOString()
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

  async function handleUnblock(info) {
    const slotStart = new Date(info.start)
    const slotEnd   = new Date(info.end)
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
      const localHourEnd   = new Date(nextHour.getTime())

      const existing = blocks.find((b) => {
        const bStart = new Date(b.start).getTime()
        const bEnd   = new Date(b.end).getTime()
        return bStart === localHourStart.getTime() && bEnd === localHourEnd.getTime()
      })
      if (existing) {
        deletions.push(client.delete(existing._id))
      }
      cursor = nextHour
    }

    // 2) If covered by day/hour rules => add timeExceptions
    const patches = []
    let exCursor = new Date(slotStart)
    while (exCursor < slotEnd) {
      const nextHr = new Date(exCursor.getTime() + 3600000)
      const localSlotStart = new Date(exCursor.getTime())
      const localSlotEnd   = new Date(nextHr.getTime())

      // hour-based
      autoBlockRules.forEach((rule) => {
        if (doesRuleCoverHourRule(rule, localSlotStart, localSlotEnd)) {
          const dateStr = moment.tz(localSlotStart, 'Asia/Jerusalem').format('YYYY-MM-DD')
          const startHr = moment.tz(localSlotStart, 'Asia/Jerusalem').hour()
          const endHr   = moment.tz(localSlotEnd,   'Asia/Jerusalem').hour()

          const ex = {
            _type: 'timeException',
            date: dateStr,
            startHour: String(startHr),
            endHour:   String(endHr)
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
          const endHr   = moment.tz(localSlotEnd,   'Asia/Jerusalem').hour()

          const ex = {
            _type: 'timeException',
            date: dateStr,
            startHour: String(startHr),
            endHour:   String(endHr)
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

  function getAutoBlockSlices(rule, dayStart, dayEnd) {
    const slices = []
    let cursorDay = moment.tz(dayStart, 'Asia/Jerusalem').startOf('day')
    const endOfDay = moment.tz(dayEnd, 'Asia/Jerusalem').endOf('day')

    while (cursorDay.isSameOrBefore(endOfDay, 'day')) {
      for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
        const sliceStart = cursorDay.clone().hour(h)
        const sliceEnd   = sliceStart.clone().add(1, 'hour')
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
      if (prev[1].getTime() === curr[0].getTime()) {
        prev[1] = curr[1]
      } else {
        merged.push(curr)
      }
    }
    return merged
  }

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

  const now = new Date()
  const validRangeStart = new Date(now)
  validRangeStart.setHours(0,0,0,0)
  validRangeStart.setDate(validRangeStart.getDate() - 7)

  const validRangeEnd = new Date(now)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <div>
      <h2 style={{ textAlign:'center', marginBottom:'1rem', fontSize:'1.8rem' }}>
        Admin Panel
      </h2>

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
        longPressDelay={100}
        selectLongPressDelay={100}
        eventLongPressDelay={100}
        validRange={{
          start: validRangeStart.toISOString(),
          end:   validRangeEnd.toISOString()
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
            width:'400px'
          }
        }}
      >
        <h3 style={{ fontSize:'1.4rem', marginBottom:'0.5rem' }}>
          Reservation Details
        </h3>
        {selectedReservation && (
          <div style={{ fontSize:'1rem' }}>
            <p>
              <strong>Name:</strong> {selectedReservation.name}
            </p>
            <p>
              <strong>Phone:</strong> {selectedReservation.phone}
            </p>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
          <button
            onClick={handleDeleteReservation}
            style={{
              marginRight:'10px',
              color:'#fff',
              background:'#d9534f',
              border:'none',
              padding:'8px 12px',
              borderRadius:'4px',
              cursor:'pointer',
              fontSize:'1rem'
            }}
          >
            Delete
          </button>
          <button
            onClick={() => setModalIsOpen(false)}
            style={{
              padding:'8px 12px',
              cursor:'pointer',
              fontSize:'1rem'
            }}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
