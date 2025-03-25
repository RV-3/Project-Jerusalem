import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import Modal from 'react-modal'
import sanityClient from '@sanity/client'
import './AdminCalendar.css'


Modal.setAppElement('#root')

const ADMIN_PASSWORD = 'admin123'

const client = sanityClient({
  projectId: 'gt19q25e',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: process.env.REACT_APP_SANITY_TOKEN || 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8'
})

export default function AdminBlockCalendar() {
  const [authenticated, setAuthenticated] = useState(
    localStorage.getItem('isAdmin') === 'true'
  )
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const calendarRef = useRef()

  useEffect(() => {
    if (authenticated) {
      fetchData()
    }
  }, [authenticated])

  const fetchData = async () => {
    const calendarApi = calendarRef.current?.getApi()
    const currentViewDate = calendarApi?.getDate()

    const blocksData = await client.fetch(`*[_type == "blocked"]{_id, start, end}`)
    const resData = await client.fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
    setBlocks(blocksData)
    setReservations(resData)

    if (calendarApi && currentViewDate) {
      calendarApi.gotoDate(currentViewDate)
    }
  }

  const isEverySlotInRangeBlocked = (slot) => {
    const slotStart = new Date(slot.start)
    const slotEnd = new Date(slot.end)

    while (slotStart < slotEnd) {
      const end = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const match = blocks.find(block =>
        new Date(block.start).getTime() === slotStart.getTime() &&
        new Date(block.end).getTime() === end.getTime()
      )
      if (!match) return false
      slotStart.setHours(slotStart.getHours() + 1)
    }
    return true
  }

  const handleBlock = async (info) => {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    const blocksToCreate = []

    while (slotStart < slotEnd) {
      const end = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const isBlocked = blocks.some(block =>
        new Date(block.start).getTime() === slotStart.getTime() &&
        new Date(block.end).getTime() === end.getTime()
      )
      if (!isBlocked) {
        blocksToCreate.push({
          _type: 'blocked',
          start: slotStart.toISOString(),
          end: end.toISOString()
        })
      }
      slotStart.setHours(slotStart.getHours() + 1)
    }

    await Promise.all(blocksToCreate.map(b => client.create(b)))
    fetchData()
  }

  const handleUnblock = async (info) => {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    const deletes = []

    while (slotStart < slotEnd) {
      const end = new Date(slotStart.getTime() + 60 * 60 * 1000)
      const match = blocks.find(block =>
        new Date(block.start).getTime() === slotStart.getTime() &&
        new Date(block.end).getTime() === end.getTime()
      )
      if (match) deletes.push(client.delete(match._id))
      slotStart.setHours(slotStart.getHours() + 1)
    }

    if (deletes.length === 0) return alert("No matching blocked slots found.")
    await Promise.all(deletes)
    fetchData()
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
    if (!window.confirm("Delete this reservation?")) return

    await client.delete(selectedReservation._id)
    fetchData()
    setModalIsOpen(false)
    setSelectedReservation(null)
  }

  if (!authenticated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '1rem',
        boxSizing: 'border-box',
        background: '#fff'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Enter Admin Password</h2>
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

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
        Admin Panel - View & Block Time Slots
      </h2>
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        themeSystem="standard"
        validRange={{
          start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
          end: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
        }}
        selectable={true}
        select={(info) => {
          if (isEverySlotInRangeBlocked(info)) {
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
            color: '#ffcccc'
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
          <button onClick={() => setModalIsOpen(false)} style={{ padding: '8px 12px' }}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
