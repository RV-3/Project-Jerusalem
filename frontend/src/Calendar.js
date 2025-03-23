import React, { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import sanityClient from '@sanity/client'

const client = sanityClient({
  projectId: 'gt19q25e', // ← Replace this!
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8' // ← Optional write token if needed
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

  const handleDateClick = (info) => {
    const name = prompt('Enter your name')
    const phone = prompt('Enter your phone number')
    if (!name || !phone) return

    const start = info.dateStr
    const end = new Date(new Date(start).getTime() + 60 * 60 * 1000)

    client
      .create({
        _type: 'reservation',
        name,
        phone,
        start,
        end
      })
      .then(() => window.location.reload())
  }

  return (
    <FullCalendar
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridDay"
      slotDuration="01:00:00"
      allDaySlot={false}
      dateClick={handleDateClick}
      events={events}
      height="auto"
    />
  )
}
