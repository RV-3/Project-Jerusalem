import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import sanityClient from '@sanity/client'
import Modal from 'react-modal'
import './Calendar.css'

Modal.setAppElement('#root')

const client = sanityClient({
  projectId: 'gt19q25e',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: process.env.REACT_APP_SANITY_TOKEN || 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8'
})

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false) // NEW

  const calendarRef = useRef(null)

  useEffect(() => {
    // Fetch reservations (events)
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

    // Fetch blocked times
    client
      .fetch(`*[_type == "blocked"]{start, end}`)
      .then((data) =>
        setBlockedTimes(
          data.map((item) => ({
            start: new Date(item.start),
            end: new Date(item.end)
          }))
        )
      )
  }, [])

  const isTimeBlocked = (start, end) => {
    return blockedTimes.some(
      (block) => start < block.end && end > block.start
    )
  }

  const handleSelect = (info) => {
    const isPast = info.start < new Date()
    if (isPast || isTimeBlocked(info.start, info.end)) return

    setSelectedInfo(info)
    setModalIsOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { name, phone } = formData
    if (!name || !phone || !selectedInfo) return

    try {
      setIsSubmitting(true) // disable button
      const res = await client.create({
        _type: 'reservation',
        name,
        phone,
        start: selectedInfo.startStr,
        end: selectedInfo.endStr
      })

      setEvents((prev) => [
        ...prev,
        {
          id: res._id,
          title: name,
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
      setIsSubmitting(false) // re‐enable button
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
              buttonText: '30 days',
            },
          }}
          stickyHeaderDates={true}
          stickyFooterScrollbar={false}
          dayMinWidth={120}
          longPressDelay={100}
          themeSystem="standard"
          selectable={true}
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
            }))
          ]}
          selectAllow={(selectInfo) => {
            const isPast = selectInfo.start < new Date()
            const isBlocked = isTimeBlocked(selectInfo.start, selectInfo.end)
            return !isPast && !isBlocked
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
            if (arg.event.id.startsWith('blocked-')) return null
            return <div>{arg.event.title}</div>
          }}
          height="auto"
        />
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => {
          setModalIsOpen(false)
          setIsSubmitting(false) // reset in case user cancels mid-submission
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
            {/* Disable the button if isSubmitting */}
            <button type="submit" disabled={isSubmitting} style={{ marginRight: '10px' }}>
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
