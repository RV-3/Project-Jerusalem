import React, { useEffect, useState, useRef } from 'react'
import { isIOS } from 'react-device-detect'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import sanityClient from '@sanity/client'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import './Calendar.css'

Modal.setAppElement('#root')

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const calendarRef = useRef(null)

  // Define different delays for iOS vs. other devices
  const platformDelay = isIOS ? 100 : 20

  // Fetch events and blocked times
  useEffect(() => {
    client
      .fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
      .then((data) =>
        setEvents(
          data.map((res) => ({
            id: res._id,
            title: res.name,
            start: res.start,
            end: res.end
          }))
        )
      )

    client.fetch(`*[_type == "blocked"]{start, end}`).then((data) =>
      setBlockedTimes(
        data.map((item) => ({
          start: new Date(item.start),
          end: new Date(item.end)
        }))
      )
    )
  }, [])

  // Check if a time range is blocked
  const isTimeBlocked = (start, end) => {
    return blockedTimes.some((block) => start < block.end && end > block.start)
  }

  // Helper: Check if slot already has a reservation
  // i.e., does it overlap with any non-blocked (foreground) event?
  const isSlotReserved = (start, end) => {
    return events.some((evt) => {
      // ignore background "blocked-" or "past-block"
      if (evt.id.startsWith('blocked-') || evt.id === 'past-block') {
        return false
      }
      // check overlap
      const evtStart = new Date(evt.start)
      const evtEnd = new Date(evt.end)
      return start < evtEnd && end > evtStart
    })
  }

  // Past background event
  useEffect(() => {
    function updatePastBlockEvent() {
      const now = new Date()
      const todayMidnight = new Date(now)
      todayMidnight.setHours(0, 0, 0, 0)

      setPastBlockEvent({
        id: 'past-block',
        start: todayMidnight,
        end: now,
        display: 'background',
        color: '#ffcccc'
      })
    }

    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Handle select
  const handleSelect = (info) => {
    const isPast = info.start < new Date()
    if (isPast || isTimeBlocked(info.start, info.end)) return

    setSelectedInfo(info)
    setModalIsOpen(true)
  }

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !selectedInfo) return

    try {
      setIsSubmitting(true)
      const res = await client.create({
        _type: 'reservation',
        name: formData.name,
        phone: formData.phone,
        start: selectedInfo.startStr,
        end: selectedInfo.endStr
      })

      setEvents((prev) => [
        ...prev,
        {
          id: res._id,
          title: formData.name,
          start: selectedInfo.startStr,
          end: selectedInfo.endStr
        }
      ])

      setModalIsOpen(false)
      setFormData({ name: '', phone: '' })
    } catch (err) {
      console.error('Reservation creation failed:', err)
      alert('Error creating reservation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatSelectedTime = () => {
    if (!selectedInfo) return ''
    const startDate = new Date(selectedInfo.start)
    const endDate = new Date(selectedInfo.end)
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

  return (
    <>
      <div>
        <FullCalendar
          ref={calendarRef}
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
          // Use our platformDelay instead of a static 100
          longPressDelay={platformDelay}
          selectLongPressDelay={platformDelay}
          eventLongPressDelay={platformDelay}
          selectable
          themeSystem="standard"
          validRange={{
            start: new Date(
              new Date().setDate(new Date().getDate() - 7)
            ).toISOString(),
            end: new Date(
              new Date().setDate(new Date().getDate() + 30)
            ).toISOString()
          }}
          select={handleSelect}
          events={[
            ...events,
            ...blockedTimes.map((block, i) => ({
              id: `blocked-${i}`,
              start: block.start,
              end: block.end,
              display: 'background',
              color: '#ffcccc'
            })),
            ...(pastBlockEvent ? [pastBlockEvent] : [])
          ]}
          // Only allow 1-hour same-day selections if NOT reserved, NOT blocked, etc.
          selectAllow={(selectInfo) => {
            const isPast = selectInfo.start < new Date()
            if (isPast) return false

            const isBlocked = isTimeBlocked(selectInfo.start, selectInfo.end)
            if (isBlocked) return false

            // new check: if already reserved, disallow
            const alreadyReserved = isSlotReserved(selectInfo.start, selectInfo.end)
            if (alreadyReserved) return false

            // standard same-day + exactly 1 hour check
            let isSameDay =
              selectInfo.start.toDateString() ===
              selectInfo.end.toDateString()

            // exactly 1 hour?
            const durationMs = selectInfo.end - selectInfo.start
            const oneHourMs = 60 * 60 * 1000
            const isExactlyOneHour = durationMs === oneHourMs

            // "midnight fix": if end is exactly midnight next day
            if (!isSameDay && isExactlyOneHour) {
              const endDate = new Date(selectInfo.end)
              if (
                endDate.getHours() === 0 &&
                endDate.getMinutes() === 0 &&
                endDate.getSeconds() === 0
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
            // hide text for background or past-block events
            if (arg.event.id.startsWith('blocked-') || arg.event.id === 'past-block') {
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
            <button type="button" onClick={() => setModalIsOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
