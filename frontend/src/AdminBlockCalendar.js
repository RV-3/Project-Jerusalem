import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'

Modal.setAppElement('#root')

const ADMIN_PASSWORD = 'admin123'

// Return current moment in Jerusalem as a Date
function getJerusalemNow() {
  const jerusalemStr = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem'
  })
  return new Date(jerusalemStr)
}

// Return midnight X days ago (in Jerusalem)
function getJerusalemMidnightXDaysAgo(daysAgo = 7) {
  const now = getJerusalemNow()
  now.setDate(now.getDate() - daysAgo)
  now.setHours(0, 0, 0, 0)
  return now
}

export default function AdminBlockCalendar() {
  const [authenticated, setAuthenticated] = useState(
    localStorage.getItem('isAdmin') === 'true'
  )
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)

  const calendarRef = useRef()

  useEffect(() => {
    if (authenticated) {
      fetchData()
    }
  }, [authenticated])

  // Fetch block+reservation data
  const fetchData = async () => {
    const calendarApi = calendarRef.current?.getApi()
    const currentViewDate = calendarApi?.getDate()

    const blocksData = await client.fetch(`*[_type == "blocked"]{_id, start, end}`)
    const resData = await client.fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)

    setBlocks(blocksData)
    setReservations(resData)

    // Restore view date if the user was on a different day
    if (calendarApi && currentViewDate) {
      calendarApi.gotoDate(currentViewDate)
    }
  }

  // Create "past-block" from 7 days ago to now (Jerusalem)
  useEffect(() => {
    function updatePastBlockEvent() {
      const earliest = getJerusalemMidnightXDaysAgo(7)
      const now = getJerusalemNow()

      setPastBlockEvent({
        id: 'past-block',
        start: earliest,
        end: now,
        display: 'background',
        color: '#ffcccc'
      })
    }

    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Check if every hour is blocked
  const isEverySlotInRangeBlocked = (slot) => {
    const slotStart = new Date(slot.start)
    const slotEnd = new Date(slot.end)

    while (slotStart < slotEnd) {
      const nextHour = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const match = blocks.find((b) =>
        new Date(b.start).getTime() === slotStart.getTime() &&
        new Date(b.end).getTime() === nextHour.getTime()
      )
      if (!match) return false
      slotStart.setHours(slotStart.getHours() + 1)
    }
    return true
  }

  const handleBlock = async (info) => {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    // Extra check if needed, but we'll rely on selectAllow now
    if (slotStart < getJerusalemNow()) {
      alert('Cannot block a past time slot.')
      return
    }

    const blocksToCreate = []
    while (slotStart < slotEnd) {
      const nextHour = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const alreadyBlocked = blocks.some(
        (b) =>
          new Date(b.start).getTime() === slotStart.getTime() &&
          new Date(b.end).getTime() === nextHour.getTime()
      )
      if (!alreadyBlocked) {
        blocksToCreate.push({
          _type: 'blocked',
          start: slotStart.toISOString(),
          end: nextHour.toISOString()
        })
      }
      slotStart.setHours(slotStart.getHours() + 1)
    }

    if (blocksToCreate.length) {
      await Promise.all(blocksToCreate.map((b) => client.create(b)))
      fetchData()
    } else {
      alert('All those slots are already blocked.')
    }
  }

  const handleUnblock = async (info) => {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    // Extra check if needed, but we'll rely on selectAllow now
    if (slotStart < getJerusalemNow()) {
      alert('Cannot unblock a past time slot.')
      return
    }

    const deletes = []
    while (slotStart < slotEnd) {
      const nextHour = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const match = blocks.find(
        (b) =>
          new Date(b.start).getTime() === slotStart.getTime() &&
          new Date(b.end).getTime() === nextHour.getTime()
      )
      if (match) {
        deletes.push(client.delete(match._id))
      }
      slotStart.setHours(slotStart.getHours() + 1)
    }

    if (!deletes.length) {
      alert('No matching blocked slots found.')
      return
    }

    await Promise.all(deletes)
    fetchData()
  }

  // If it's a reservation event => open modal
  const handleEventClick = (clickInfo) => {
    const res = reservations.find((r) => r._id === clickInfo.event.id)
    if (res) {
      setSelectedReservation(res)
      setModalIsOpen(true)
    }
  }

  // Delete reservation
  const handleDeleteReservation = async () => {
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
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '1rem',
          boxSizing: 'border-box',
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

  // Setup valid range ~7 days back -> 30 days ahead
  const nowJerusalem = getJerusalemNow()
  const validRangeStart = new Date(nowJerusalem)
  validRangeStart.setDate(validRangeStart.getDate() - 7)
  validRangeStart.setHours(0, 0, 0, 0)

  const validRangeEnd = new Date(nowJerusalem)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
        Admin Panel - View &amp; Block Time Slots
      </h2>

      <FullCalendar
        ref={calendarRef}
        timeZone="Asia/Jerusalem"
        plugins={[timeGridPlugin, interactionPlugin, scrollGridPlugin]}
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

        // Tapping speed
        longPressDelay={100}
        selectLongPressDelay={100}
        eventLongPressDelay={100}

        validRange={{
          start: validRangeStart.toISOString(),
          end: validRangeEnd.toISOString()
        }}

        selectable={true}
        /* Using 'selectAllow' to outright disallow any selection that starts in the past. */
        selectAllow={(selectInfo) => {
          const slotStart = new Date(selectInfo.startStr)
          return slotStart >= getJerusalemNow()
        }}
        select={(info) => {
          // If the entire range is blocked => attempt to unblock
          if (isEverySlotInRangeBlocked(info)) {
            if (window.confirm('Unblock this time slot?')) {
              handleUnblock(info)
            }
          } else {
            // otherwise attempt to block
            if (window.confirm('Block this time slot?')) {
              handleBlock(info)
            }
          }
        }}

        events={[
          // Show reservations
          ...reservations.map((res) => ({
            id: res._id,
            title: res.name,
            start: res.start,
            end: res.end,
            color: '#3788d8'
          })),
          // Show blocked (background)
          ...blocks.map((b) => ({
            id: b._id,
            title: 'Blocked',
            start: b.start,
            end: b.end,
            display: 'background',
            color: '#ffcccc'
          })),
          // Show big past block event
          ...(pastBlockEvent ? [pastBlockEvent] : [])
        ]}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
      />

      {/* Modal for reservation details */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Reservation Info"
        style={{
          overlay: { backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1000 },
          content: {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '25px',
            borderRadius: '8px',
            background: 'white',
            width: '300px'
          }
        }}
      >
        <h3>Reservation Details</h3>
        {selectedReservation && (
          <div>
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
              color: 'white',
              background: '#cc0000',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px'
            }}
          >
            Delete
          </button>
          <button
            onClick={() => setModalIsOpen(false)}
            style={{ padding: '8px 12px' }}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
