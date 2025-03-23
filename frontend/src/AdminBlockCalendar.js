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
      .fetch(`*[_type == "blocked"]{_id, start, end}`)
      .then((data) => setBlocks(data))
  }, [])

  const handleBlock = async (info) => {
    const startStr = info.startStr
    const endStr = info.endStr
    const alreadyBlocked = blocks.some(
      (b) => b.start === startStr && b.end === endStr
    )
    if (alreadyBlocked) {
      alert('Already blocked!')
      return
    }

    const res = await client.create({
      _type: 'blocked',
      start: startStr,
      end: endStr
    })
    setBlocks([...blocks, res])
  }

  const handleUnblock = async (info) => {
    const block = blocks.find(
      (b) => b.start === info.startStr && b.end === info.endStr
    )
    if (!block) return alert('Block not found.')

    await client.delete(block._id)
    setBlocks(blocks.filter((b) => b._id !== block._id))
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
        Admin Panel - Block/Unblock Time Slots
      </h2>
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        select={(info) => {
          const isAlreadyBlocked = blocks.some(
            (b) => b.start === info.startStr && b.end === info.endStr
          )
          if (isAlreadyBlocked) {
            if (window.confirm('Unblock this slot?')) handleUnblock(info)
          } else {
            if (window.confirm('Block this slot?')) handleBlock(info)
          }
        }}
        events={blocks.map((block) => ({
          title: 'Blocked',
          start: block.start,
          end: block.end,
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
