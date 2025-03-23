import React, { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import sanityClient from '@sanity/client'

const client = sanityClient({
  projectId: 'gt19q25e',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8'
})

export default function AdminBlockCalendar() {
  const [blocks, setBlocks] = useState([])

  useEffect(() => {
    client
      .fetch(`*[_type == "blocked"]{_id, date}`)
      .then((data) => setBlocks(data))
  }, [])

  const handleBlock = async (info) => {
    const dateStr = info.startStr.split('T')[0]
    if (blocks.find((block) => block.date === dateStr)) {
      alert('Already blocked!')
      return
    }

    const res = await client.create({
      _type: 'blocked',
      date: dateStr
    })
    setBlocks([...blocks, res])
  }

  const handleUnblock = async (dateStr) => {
    const blockDoc = blocks.find((block) => block.date === dateStr)
    if (!blockDoc) return alert('Block not found for this day.')

    await client.delete(blockDoc._id)
    setBlocks(blocks.filter((block) => block._id !== blockDoc._id))
  }

  const isBlocked = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return blocks.some((block) => block.date === dateStr)
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Admin Panel - Block/Unblock Days</h2>
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        select={(info) => {
          const dateStr = info.startStr.split('T')[0]
          if (isBlocked(info.start)) {
            if (window.confirm(`Unblock ${dateStr}?`)) {
              handleUnblock(dateStr)
            }
          } else {
            if (window.confirm(`Block ${dateStr}?`)) {
              handleBlock(info)
            }
          }
        }}
        events={blocks.map((block) => ({
          title: 'Blocked',
          start: block.date,
          end: block.date,
          display: 'background',
          color: '#ff6666'
        }))}
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
    </div>
  )
}
