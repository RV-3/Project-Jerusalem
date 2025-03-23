import React, { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import sanityClient from '@sanity/client'
import Modal from 'react-modal'
import './Calendar.css' // <-- We'll add styling here

Modal.setAppElement('#root')

const client = sanityClient({
  projectId: 'gt19q25e',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8'
})

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })

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
  }, [])

  const handleSelect = (info) => {
    if (info.start < new Date()) return
    setSelectedInfo(info)
    setModalIsOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { name, phone } = formData
    if (!name || !phone || !selectedInfo) return

    const res = await client.create({
      _type: 'reservation',
      name,
      phone,
      start: selectedInfo.startStr,
      end: selectedInfo.endStr
    })

    setEvents([
      ...events,
      {
        id: res._id,
        title: name,
        start: selectedInfo.startStr,
        end: selectedInfo.endStr
      }
    ])

    setModalIsOpen(false)
    setFormData({ name: '', phone: '' })
  }

  const isPast = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    return date < now.setHours(0, 0, 0, 0)
  }

  return (
    <>
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        select={handleSelect}
        events={events}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        selectAllow={(selectInfo) => selectInfo.start > new Date()}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
        eventContent={(arg) => <div>{arg.event.title}</div>}
        dayCellClassNames={(arg) => {
          if (isPast(arg.date)) {
            return 'fc-day-past'
          }
          return ''
        }}
        height="auto"
      />

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Reservation Form"
        style={{
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          },
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            padding: '30px',
            borderRadius: '10px',
            background: 'white',
            maxWidth: '400px',
            width: '90%'
          }
        }}
      >
        <h2 style={{ marginBottom: '15px' }}>Reserve a Time Slot</h2>
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
            <button type="submit" style={{ marginRight: '10px' }}>
              Reserve
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
