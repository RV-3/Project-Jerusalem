import React, { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import Modal from 'react-modal'
import sanityClient from '@sanity/client'

Modal.setAppElement('#root')

const client = sanityClient({
  projectId: 'gt19q25e',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8'
})

export default function AdminBlockCalendar() {
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)

  useEffect(() => {
    client.fetch(`*[_type == "blocked"]{_id, start, end}`).then(setBlocks)
    client
      .fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
      .then(setReservations)
  }, [])

  const handleBlock = async (info) => {
    const isAlreadyBlocked = blocks.find(
      (block) =>
        new Date(block.start).getTime() === info.start.getTime() &&
        new Date(block.end).getTime() === info.end.getTime()
    )
    if (isAlreadyBlocked) {
      alert('Slot already blocked!')
      return
    }

    const res = await client.create({
      _type: 'blocked',
      start: info.startStr,
      end: info.endStr
    })
    setBlocks([...blocks, res])
  }

  const handleUnblock = async (info) => {
    const match = blocks.find(
      (block) =>
        new Date(block.start).getTime() === info.start.getTime() &&
        new Date(block.end).getTime() === info.end.getTime()
    )
    if (!match) return alert('Block not found.')
    await client.delete(match._id)
    setBlocks(blocks.filter((b) => b._id !== match._id))
  }

  const handleEventClick = (clickInfo) => {
    const res = reservations.find((r) => r._id === clickInfo.event.id)
    if (res) {
      setSelectedReservation(res)
      setModalIsOpen(true)
    }
  }

  const handleDeleteReservation = async () => {
    if (!selectedReservation) return
    const confirm = window.confirm("Delete this reservation?")
    if (!confirm) return

    await client.delete(selectedReservation._id)
    setReservations(reservations.filter(r => r._id !== selectedReservation._id))
    setModalIsOpen(false)
    setSelectedReservation(null)
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
        Admin Panel - View & Block Time Slots
      </h2>
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        select={(info) => {
          const isBlocked = blocks.some(
            (b) =>
              new Date(b.start).getTime() === info.start.getTime() &&
              new Date(b.end).getTime() === info.end.getTime()
          )
          if (isBlocked) {
            if (window.confirm('Unblock this time slot?')) handleUnblock(info)
          } else {
            if (window.confirm('Block this time slot?')) handleBlock(info)
          }
        }}
        eventClick={handleEventClick}
        events={[
          ...reservations.map((res) => ({
            id: res._id,
            title: res.name,
            start: res.start,
            end: res.end,
            color: '#3788d8'
          })),
          ...blocks.map((block) => ({
            id: block._id,
            title: 'Blocked',
            start: block.start,
            end: block.end,
            display: 'background',
            color: '#ff9999'
          }))
        ]}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
        height="auto"
      />

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Reservation Info"
        style={{
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1000
          },
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
            <p><strong>Name:</strong> {selectedReservation.name}</p>
            <p><strong>Phone:</strong> {selectedReservation.phone}</p>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={handleDeleteReservation} style={{ marginRight: '10px', color: 'white', background: '#cc0000', border: 'none', padding: '8px 12px', borderRadius: '4px' }}>
            Delete
          </button>
          <button onClick={() => setModalIsOpen(false)} style={{ padding: '8px 12px' }}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
