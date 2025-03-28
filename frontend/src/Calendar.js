import React, { useEffect, useState, useRef } from 'react'
import { isIOS } from 'react-device-detect'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import './Calendar.css'

Modal.setAppElement('#root')

/**
 * Returns the current moment in Jerusalem time as a JS Date object.
 */
function getJerusalemNow() {
  const jerusalemString = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem'
  })
  return new Date(jerusalemString)
}

/**
 * Returns a Date for "X days ago at 00:00" in Jerusalem (helpful for blocking from that date).
 */
function getJerusalemMidnightXDaysAgo(daysAgo = 7) {
  const nowJerusalem = getJerusalemNow()
  // Move back 'daysAgo' days
  nowJerusalem.setDate(nowJerusalem.getDate() - daysAgo)
  // Set to midnight
  nowJerusalem.setHours(0, 0, 0, 0)
  return nowJerusalem
}

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const calendarRef = useRef(null)

  // Shorter press delay for non-iOS
  const platformDelay = isIOS ? 100 : 20

  // 1. Fetch events and blocked times
  useEffect(() => {
    // Fetch reservations
    client
      .fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
      .then((data) => {
        setEvents(
          data.map((res) => ({
            id: res._id,
            title: res.name,
            start: res.start,
            end: res.end
          }))
        )
      })

    // Fetch blocked times
    client.fetch(`*[_type == "blocked"]{start, end}`).then((data) => {
      setBlockedTimes(
        data.map((item) => ({
          start: new Date(item.start),
          end: new Date(item.end)
        }))
      )
    })
  }, [])

  // 2. Helpers to check blocked/reserved
  const isTimeBlocked = (start, end) => {
    return blockedTimes.some((block) => start < block.end && end > block.start)
  }

  const isSlotReserved = (start, end) => {
    return events.some((evt) => {
      if (evt.id.startsWith('blocked-') || evt.id === 'past-block') {
        return false
      }
      const evtStart = new Date(evt.start)
      const evtEnd = new Date(evt.end)
      return start < evtEnd && end > evtStart
    })
  }

  // 3. Pink background for everything from 7 days ago -> "rounded up" current hour
  useEffect(() => {
    function updatePastBlockEvent() {
      const earliest = getJerusalemMidnightXDaysAgo(7)
      const nowJerusalem = getJerusalemNow()

      // Round up to the next hour if we are mid-hour
      const endOfCurrentHour = new Date(nowJerusalem)
      if (
        endOfCurrentHour.getMinutes() !== 0 ||
        endOfCurrentHour.getSeconds() !== 0
      ) {
        endOfCurrentHour.setHours(endOfCurrentHour.getHours() + 1, 0, 0, 0)
      }

      setPastBlockEvent({
        id: 'past-block',
        start: earliest,
        end: endOfCurrentHour,
        display: 'background',
        color: '#ffcccc'
      })
    }

    updatePastBlockEvent()
    // Update every minute, in case new minutes become "past"
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // 4. Handle user selection for a new reservation
  const handleSelect = (info) => {
    const nowJerusalem = getJerusalemNow()
    const slotStart = new Date(info.startStr)
    const slotEnd = new Date(info.endStr)

    // If it's in the past or blocked, ignore
    if (slotStart < nowJerusalem) return
    if (isTimeBlocked(slotStart, slotEnd)) return

    // Store offset-aware strings for DB
    setSelectedInfo({
      startStr: info.startStr,
      endStr: info.endStr
    })

    setModalIsOpen(true)
  }

  // 5. Reservation submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !selectedInfo) return

    try {
      setIsSubmitting(true)
      // Create in Sanity
      const res = await client.create({
        _type: 'reservation',
        name: formData.name,
        phone: formData.phone,
        start: selectedInfo.startStr,
        end: selectedInfo.endStr
      })

      // Update local state
      setEvents((prev) => [
        ...prev,
        {
          id: res._id,
          title: formData.name,
          start: selectedInfo.startStr,
          end: selectedInfo.endStr
        }
      ])

      // Reset form + close modal
      setModalIsOpen(false)
      setFormData({ name: '', phone: '' })
    } catch (err) {
      console.error('Reservation creation failed:', err)
      alert('Error creating reservation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 6. Format time range in the modal
  const formatSelectedTime = () => {
    if (!selectedInfo) return ''
    const startDate = new Date(selectedInfo.startStr)
    const endDate = new Date(selectedInfo.endStr)

    const weekday = startDate.toLocaleDateString('en-US', { weekday: 'long' })
    const startTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
    return `${weekday} (${startTime} - ${endTime})`
  }

  // 7. Build validRange for ~7 days back to +30 days forward
  const nowJerusalem = getJerusalemNow()
  const validRangeStart = new Date(nowJerusalem)
  validRangeStart.setDate(validRangeStart.getDate() - 7)
  validRangeStart.setHours(0, 0, 0, 0)

  const validRangeEnd = new Date(nowJerusalem)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <>
      <div>
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
          validRange={{
            start: validRangeStart.toISOString(),
            end: validRangeEnd.toISOString()
          }}
          select={handleSelect}
          events={[
            // real reservations
            ...events,
            // block docs => background events
            ...blockedTimes.map((block, i) => ({
              id: `blocked-${i}`,
              start: block.start,
              end: block.end,
              display: 'background',
              color: '#ffcccc'
            })),
            // big "past-block" from 7 days ago -> endOfCurrentHour
            ...(pastBlockEvent ? [pastBlockEvent] : [])
          ]}
          selectAllow={(selectInfo) => {
            const slotStart = new Date(selectInfo.startStr)
            const slotEnd = new Date(selectInfo.endStr)
            const nowJerusalem = getJerusalemNow()

            // no selecting past or blocked/reserved
            if (slotStart < nowJerusalem) return false
            if (isTimeBlocked(slotStart, slotEnd)) return false
            if (isSlotReserved(slotStart, slotEnd)) return false

            // must be exactly 1 hour, same day
            const durationMs = slotEnd - slotStart
            const oneHourMs = 60 * 60 * 1000
            const isExactlyOneHour = durationMs === oneHourMs

            let isSameDay =
              slotStart.toDateString() === slotEnd.toDateString()

            // if it crosses midnight exactly
            if (!isSameDay && isExactlyOneHour) {
              if (
                slotEnd.getHours() === 0 &&
                slotEnd.getMinutes() === 0 &&
                slotEnd.getSeconds() === 0
              ) {
                isSameDay = true
              }
            }

            return isSameDay && isExactlyOneHour
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
            // hide text for background / "past-block" events
            if (arg.event.id.startsWith('blocked-') || arg.event.id === 'past-block') {
              return null
            }
            return <div>{arg.event.title}</div>
          }}
          height="auto"
        />
      </div>

      {/* Modal for reservation */}
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
