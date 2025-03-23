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
    const alreadyBlocked = blocks.find(
      (block) =>
        new Date(block.start).getTime() === new Date(info.start).getTime() &&
        new Date(block.end).getTime() === new Date(info.end).getTime()
    )

    if (alreadyBlocked) {
      alert('Already blocked!')
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
    const toDelete = blocks.find(
      (block) =>
        new Date(block.start).getTime() === new Date(info.start).getTime() &&
        new Date(block.end).getTime() === new Date(info.end).getTime()
    )

    if (!toDelete) {
      alert('No matching blocked slot found')
      return
    }

    await client.delete(toDelete._id)
    setBlocks(blocks.filter((block) => block._id !== toDelete._id))
  }

  const isBlockedSlot = (info) => {
    return blocks.some(
      (block) =>
        new Date(block.start).getTime() === new Date(info.start).getTime() &&
        new Date(block.end).getTime() === new Date(info.end).getTime()
    )
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Admin Panel - Block/Unblock Slots</h2>
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        select={(info) => {
          if (isBlockedSlot(info)) {
            if (window.confirm('Unblock this slot?')) {
              handleUnblock(info)
            }
          } else {
            if (window.confirm('Block this slot?')) {
              handleBlock(info)
            }
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
