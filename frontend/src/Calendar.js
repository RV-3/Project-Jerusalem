import React, { useEffect, useState, useRef } from 'react'
import { isIOS } from 'react-device-detect'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
// Removed: import { formatDate } from '@fullcalendar/core'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import './Calendar.css'

Modal.setAppElement('#root')

/**
 * Returns the **next** top-of-hour in Jerusalem.
 */
function getJerusalemNextHour() {
  const jerusalemString = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem'
  })
  const dateObj = new Date(jerusalemString)
  if (dateObj.getMinutes() !== 0 || dateObj.getSeconds() !== 0) {
    dateObj.setHours(dateObj.getHours() + 1, 0, 0, 0)
  }
  return dateObj
}

// Force parse as UTC
function parseAsUTC(isoString) {
  // If it ends with 'Z' or has +/- in it, assume the offset is there
  if (!isoString.match(/[zZ]|[+-]\d{2}:\d{2}$/)) {
    return new Date(isoString + 'Z')
  }
  return new Date(isoString)
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
  const platformDelay = isIOS ? 100 : 10

  // 1) Fetch reservations & blocked times
  useEffect(() => {
    // 1) Reservations
    client.fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
      .then((data) => {
        console.log('[DEBUG] Fetched reservations:', data)
        const parsed = data.map((res) => ({
          id: res._id,
          title: res.name,
          start: parseAsUTC(res.start),
          end: parseAsUTC(res.end)
        }))
        setEvents(parsed)
      })

    // 2) Blocked
    client.fetch(`*[_type == "blocked"]{start, end}`).then((data) => {
      console.log('[DEBUG] Fetched blocked times (raw):', data)
      const converted = data.map((item) => ({
        start: parseAsUTC(item.start),
        end: parseAsUTC(item.end)
      }))
      setBlockedTimes(converted)
    })
  }, [])

  // 2) Helper: Check if a time range is blocked
  const isTimeBlocked = (start, end) => {
    const startMs = start.getTime()
    const endMs = end.getTime()
    console.log('[DEBUG] isTimeBlocked checking numeric range:', startMs, '->', endMs)

    return blockedTimes.some((block, idx) => {
      const blockStartMs = block.start.getTime()
      const blockEndMs = block.end.getTime()
      const overlaps = startMs < blockEndMs && endMs > blockStartMs
      if (overlaps) {
        console.log(`[DEBUG] Overlap FOUND with block index ${idx}`, {
          blockStartMs,
          blockEndMs,
          blockStartISO: block.start.toISOString(),
          blockEndISO: block.end.toISOString()
        })
      } else {
        console.log(`[DEBUG] No overlap with block index ${idx}`, {
          blockStartMs,
          blockEndMs
        })
      }
      return overlaps
    })
  }

  // 3) Check if slot already has a reservation
  function isSlotReserved(slotStart, slotEnd) {
    const startTime = slotStart.getTime()
    const endTime = slotEnd.getTime()
    console.log('[DEBUG] isSlotReserved checking numeric range:', startTime, '->', endTime)

    return events.some((evt, idx) => {
      // ignore background/past-block events
      if (evt.id.startsWith('blocked-') || evt.id === 'past-block') {
        return false
      }
      const evtStartTime = evt.start.getTime()
      const evtEndTime = evt.end.getTime()

      // Overlap means (start < eventEnd) && (end > eventStart)
      const overlap = (startTime < evtEndTime) && (endTime > evtStartTime)
      if (overlap) {
        console.log(`[DEBUG] Overlap FOUND with event index ${idx} =>`, {
          evtId: evt.id,
          evtTitle: evt.title,
          evtStartTime,
          evtEndTime,
          evtStartISO: evt.start.toISOString(),
          evtEndISO: evt.end.toISOString()
        })
      } else {
        console.log(`[DEBUG] No overlap with event index ${idx}`, {
          evtId: evt.id,
          evtTitle: evt.title
        })
      }
      return overlap
    })
  }

  // 4) Past background event
  useEffect(() => {
    function updatePastBlockEvent() {
      const now = new Date()
      const todayMidnight = new Date(now)
      todayMidnight.setHours(0, 0, 0, 0)

      const pbEvent = {
        id: 'past-block',
        start: todayMidnight,
        end: now,
        display: 'background',
        color: '#ffcccc'
      }
      console.log('[DEBUG] Updating pastBlockEvent:', pbEvent)
      setPastBlockEvent(pbEvent)
    }

    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // 5) Handle slot select
  const handleSelect = (info) => {
    console.log('[DEBUG] handleSelect triggered with:', info)

    if (isTimeBlocked(info.start, info.end)) {
      console.log('[DEBUG] handleSelect: selection disallowed => blocked.')
      return
    }

    setSelectedInfo(info)
    setModalIsOpen(true)
  }

  // 6) Reservation submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !selectedInfo) return

    try {
      setIsSubmitting(true)
      console.log('[DEBUG] Creating new reservation in Sanity:', selectedInfo)

      // Store in Sanity as ISO strings:
      const res = await client.create({
        _type: 'reservation',
        name: formData.name,
        phone: formData.phone,
        start: selectedInfo.startStr,
        end: selectedInfo.endStr
      })
      console.log('[DEBUG] Created reservation:', res)

      // Add new event to local state as Date objects
      setEvents((prev) => [
        ...prev,
        {
          id: res._id,
          title: formData.name,
          start: selectedInfo.start,  // keep them as Date objects
          end: selectedInfo.end
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

  // 7) Format the time range in the modal
  const formatSelectedTime = () => {
    if (!selectedInfo) return ''

    const calendarApi = calendarRef.current?.getApi()

    const startStr = calendarApi.formatDate(selectedInfo.start, {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'long'
    })

    const endStr = calendarApi.formatDate(selectedInfo.end, {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      minute: '2-digit'
    })

    return `${startStr} - ${endStr}`
  }

  return (
    <>
      <div>
        <FullCalendar
          timeZone="Asia/Jerusalem"
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
          // Disallow slots that begin before next top-of-hour in Jerusalem
          selectAllow={(selectInfo) => {
            console.log('[DEBUG] selectAllow triggered with:', selectInfo)
            const nextHourJerusalem = getJerusalemNextHour()
            if (selectInfo.start < nextHourJerusalem) {
              console.log('[DEBUG] selectAllow => false (slot is before next hour in Jerusalem)')
              return false
            }

            // Also disallow if blocked/reserved
            const blocked = isTimeBlocked(selectInfo.start, selectInfo.end)
            const reserved = isSlotReserved(selectInfo.start, selectInfo.end)
            if (blocked || reserved) {
              console.log('[DEBUG] selectAllow => false (blocked or reserved)')
              return false
            }

            // same-day + exactly 1 hour logic
            let isSameDay =
              selectInfo.start.toDateString() === selectInfo.end.toDateString()

            const durationMs = selectInfo.end - selectInfo.start
            const oneHourMs = 60 * 60 * 1000
            const isExactlyOneHour = durationMs === oneHourMs

            // midnight fix
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

            const finalAllow = isSameDay && isExactlyOneHour
            console.log('[DEBUG] selectAllow =>', finalAllow)
            return finalAllow
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
            // hide text for background/past-block events
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
          console.log('[DEBUG] Modal onRequestClose called')
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
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            style={{ width: '100%', marginBottom: '10px', padding: '6px' }}
          />
          <label>Phone:</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
