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

export default function Calendar() {
  const [events, setEvents] = useState([])

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
    const name = prompt('Enter your name:')
    const phone = prompt('Enter your phone number:')
    if (!name || !phone) return

    client
      .create({
        _type: 'reservation',
        name,
        phone,
        start: info.startStr,
        end: info.endStr
      })
      .then((res) => {
        setEvents([
          ...events,
          {
            id: res._id,
            title: name,
            start: info.startStr,
            end: info.endStr
          }
        ])
      })
  }

  return (
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
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: '' // Removes the "day/week" toggle
      }}
      eventContent={(arg) => (
        <div>{arg.event.title}</div> // Only show the name in the block
      )}
      height="auto"
    />
  )
}
