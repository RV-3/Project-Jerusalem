// Calendar.js
import React, { useEffect, useState, useRef } from 'react'
import { isIOS } from 'react-device-detect'
import FullCalendar from '@fullcalendar/react'
import allLocales from '@fullcalendar/core/locales-all'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'

import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'

import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import './Calendar.css'

// Our custom translation
import useTranslate from './useTranslate'
import { useLanguage } from './LanguageContext'

Modal.setAppElement('#root')

/** Return the "next top-of-hour" in Jerusalem as a Moment, so we forbid earlier selections. */
function getJerusalemNextHourMoment() {
  const nowJer = moment.tz('Asia/Jerusalem')
  if (nowJer.minute() !== 0 || nowJer.second() !== 0) {
    nowJer.add(1, 'hour').startOf('hour')
  }
  return nowJer
}

// -----------------------------------
// HELPER: see if an hour is in a doc’s timeExceptions
// -----------------------------------
function isHourExcepted(exceptions = [], hStart, hEnd) {
  const startJer = moment.tz(hStart, 'Asia/Jerusalem')
  const endJer   = moment.tz(hEnd, 'Asia/Jerusalem')
  const dateStr  = startJer.format('YYYY-MM-DD')

  return exceptions.some((ex) => {
    if (!ex.date) return false
    if (ex.date.slice(0, 10) !== dateStr) return false

    const exDay   = startJer.clone().startOf('day')
    const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
    const exEnd   = exDay.clone().hour(parseInt(ex.endHour   || '0', 10))

    return startJer.isBefore(exEnd) && endJer.isAfter(exStart)
  })
}

// For hour-based rules
function doesHourRuleCover(rule, hStart, hEnd) {
  const startJer = moment.tz(hStart, 'Asia/Jerusalem')
  const endJer   = moment.tz(hEnd, 'Asia/Jerusalem')

  const dayAnchor = startJer.clone().startOf('day')
  const rStart    = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
  const rEnd      = dayAnchor.clone().hour(parseInt(rule.endHour,   10))

  if (startJer.isBefore(rStart) || endJer.isAfter(rEnd)) return false
  if (isHourExcepted(rule.timeExceptions, hStart, hEnd)) return false
  return true
}

function getHourRuleSlices(rule, viewStart, viewEnd) {
  const slices = []
  let dayCursor = moment.tz(viewStart, 'Asia/Jerusalem').startOf('day')
  const dayEnd  = moment.tz(viewEnd, 'Asia/Jerusalem').endOf('day')

  while (dayCursor.isSameOrBefore(dayEnd, 'day')) {
    for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
      const sliceStart = dayCursor.clone().hour(h)
      const sliceEnd   = sliceStart.clone().add(1, 'hour')

      if (sliceEnd.isSameOrBefore(viewStart) || sliceStart.isSameOrAfter(viewEnd)) {
        continue
      }
      if (isHourExcepted(rule.timeExceptions, sliceStart.toDate(), sliceEnd.toDate())) {
        continue
      }
      slices.push([sliceStart.toDate(), sliceEnd.toDate()])
    }
    dayCursor.add(1, 'day').startOf('day')
  }
  return mergeSlices(slices)
}

// Day-based rules
function getDayBlockSlices(dayDoc, viewStart, viewEnd) {
  if (!dayDoc?.daysOfWeek?.length) return []
  const slices = []
  let current = moment.tz(viewStart, 'Asia/Jerusalem').startOf('day')
  const limit = moment.tz(viewEnd, 'Asia/Jerusalem').endOf('day')

  while (current.isBefore(limit)) {
    const dayName = current.format('dddd')
    if (dayDoc.daysOfWeek.includes(dayName)) {
      for (let h = 0; h < 24; h++) {
        const sliceStart = current.clone().hour(h)
        const sliceEnd   = sliceStart.clone().add(1, 'hour')

        if (sliceEnd.isSameOrBefore(viewStart) || sliceStart.isSameOrAfter(viewEnd)) {
          continue
        }
        if (isHourExcepted(dayDoc.timeExceptions, sliceStart.toDate(), sliceEnd.toDate())) {
          continue
        }
        slices.push([sliceStart.toDate(), sliceEnd.toDate()])
      }
    }
    current.add(1, 'day').startOf('day')
  }
  return mergeSlices(slices)
}

// Merge contiguous hour slices
function mergeSlices(slices) {
  if (!slices.length) return []
  slices.sort((a, b) => a[0] - b[0])
  const merged = [slices[0]]
  for (let i = 1; i < slices.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = slices[i]
    if (prev[1].getTime() === curr[0].getTime()) {
      prev[1] = curr[1]
    } else {
      merged.push(curr)
    }
  }
  return merged
}

// Build background events for day-based & hour-based
function buildAutoBlockAllEvents(autoBlockHours, autoBlockDaysDoc, viewStart, viewEnd) {
  const events = []

  // day-based expansions
  if (autoBlockDaysDoc) {
    const daySlices = getDayBlockSlices(autoBlockDaysDoc, viewStart, viewEnd)
    daySlices.forEach(([s, e]) => {
      events.push({
        id: `auto-day-${autoBlockDaysDoc._id}-${s.toISOString()}`,
        start: s,
        end: e,
        display: 'background',
        color: '#ffcccc'
      })
    })
  }

  // hour-based expansions
  autoBlockHours.forEach((rule) => {
    const hourSlices = getHourRuleSlices(rule, viewStart, viewEnd)
    hourSlices.forEach(([s, e]) => {
      events.push({
        id: `auto-hour-${rule._id}-${s.toISOString()}`,
        start: s,
        end: e,
        display: 'background',
        color: '#ffcccc'
      })
    })
  })

  return events
}

// -----------------------------------
// MAIN Calendar
// -----------------------------------
export default function Calendar() {
  const { language } = useLanguage()
  const t = useTranslate()

  const [events, setEvents] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [autoBlockHours, setAutoBlockHours] = useState([])
  const [autoBlockDays, setAutoBlockDays] = useState(null)
  const [pastBlockEvent, setPastBlockEvent] = useState(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const calendarRef = useRef(null)
  const platformDelay = isIOS ? 100 : 47

  // Fetch data on mount
  useEffect(() => {
    // a) Reservations
    client.fetch(`*[_type == "reservation"]{_id, name, phone, start, end}`)
      .then((data) => {
        const parsed = data.map((res) => ({
          id: res._id,
          title: res.name,
          start: res.start,
          end: res.end
        }))
        setEvents(parsed)
      })
      .catch((err) => console.error('Error fetching reservations:', err))

    // b) Manual blocks
    client.fetch(`*[_type == "blocked"]{_id, start, end}`)
      .then((data) => {
        const blocks = data.map((item) => ({
          _id: item._id,
          start: item.start,
          end: item.end
        }))
        setBlockedTimes(blocks)
      })
      .catch((err) => console.error('Error fetching blocked times:', err))

    // c) Hour-based autoBlock
    client.fetch(`*[_type == "autoBlockedHours"]{
      _id,
      startHour,
      endHour,
      timeExceptions[]{ date, startHour, endHour }
    }`)
      .then((rules) => setAutoBlockHours(rules))
      .catch((err) => console.error('Error fetching auto-block hours:', err))

    // d) Day-based autoBlock
    client.fetch(`*[_type == "autoBlockedDays"]{
      _id,
      daysOfWeek,
      timeExceptions[]{ date, startHour, endHour }
    }`)
      .then((daysDocs) => {
        if (daysDocs.length) {
          setAutoBlockDays(daysDocs[0])
        }
      })
      .catch((err) => console.error('Error fetching autoBlockedDays:', err))
  }, [])

  function isTimeBlockedByManual(start, end) {
    const sJer = moment.tz(start, 'Asia/Jerusalem')
    const eJer = moment.tz(end, 'Asia/Jerusalem')
    return blockedTimes.some((b) => {
      const bStart = moment.tz(b.start, 'Asia/Jerusalem')
      const bEnd   = moment.tz(b.end, 'Asia/Jerusalem')
      return sJer.isBefore(bEnd) && eJer.isAfter(bStart)
    })
  }

  function isTimeBlockedByAuto(start, end) {
    if (autoBlockDays && autoBlockDays.daysOfWeek?.length) {
      if (isDayCovered(autoBlockDays, start, end)) {
        return true
      }
    }
    return autoBlockHours.some((rule) => doesHourRuleCover(rule, start, end))
  }

  function isDayCovered(dayDoc, hStart, hEnd) {
    const dayName = moment.tz(hStart, 'Asia/Jerusalem').format('dddd')
    if (!dayDoc.daysOfWeek?.includes(dayName)) return false
    if (isHourExcepted(dayDoc.timeExceptions || [], hStart, hEnd)) {
      return false
    }
    return true
  }

  function isSlotReserved(slotStart, slotEnd) {
    const sJer = moment.tz(slotStart, 'Asia/Jerusalem')
    const eJer = moment.tz(slotEnd, 'Asia/Jerusalem')
    return events.some((evt) => {
      if (
        evt.id.startsWith('auto-') ||
        evt.id.startsWith('blocked-') ||
        evt.id === 'past-block'
      ) {
        return false
      }
      const evtStart = moment.tz(evt.start, 'Asia/Jerusalem')
      const evtEnd   = moment.tz(evt.end, 'Asia/Jerusalem')
      return sJer.isBefore(evtEnd) && eJer.isAfter(evtStart)
    })
  }

  // Past-block overlay
  useEffect(() => {
    function updatePastBlockEvent() {
      const nowJer = moment.tz('Asia/Jerusalem')
      const startOfTodayJer = nowJer.clone().startOf('day')
      setPastBlockEvent({
        id: 'past-block',
        start: startOfTodayJer.toISOString(),
        end: nowJer.toISOString(),
        display: 'background',
        color: '#ffcccc'
      })
    }
    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleSelect = (info) => {
    const { startStr, endStr } = info
    if (isTimeBlockedByManual(startStr, endStr)) return
    if (isTimeBlockedByAuto(startStr, endStr)) return
    if (isSlotReserved(startStr, endStr)) return

    setSelectedInfo({ start: startStr, end: endStr })
    setModalIsOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !selectedInfo) return
    try {
      setIsSubmitting(true)
      const reservationDoc = {
        _type: 'reservation',
        name: formData.name,
        phone: formData.phone,
        start: selectedInfo.start,
        end: selectedInfo.end
      }
      const created = await client.create(reservationDoc)
      setEvents((prev) => [
        ...prev,
        {
          id: created._id,
          title: formData.name,
          start: selectedInfo.start,
          end: selectedInfo.end
        }
      ])
      setModalIsOpen(false)
      setFormData({ name: '', phone: '' })
      setSelectedInfo(null)
    } catch (err) {
      console.error('Error creating reservation:', err)
      alert(
        t({
          en: 'Failed to create reservation. Please try again.',
          de: 'Fehler beim Erstellen der Reservierung. Bitte erneut versuchen.',
          es: 'No se pudo crear la reserva. Inténtalo de nuevo.'
        })
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatSelectedTime = () => {
    if (!selectedInfo) return ''
    const calendarApi = calendarRef.current?.getApi()
    if (!calendarApi) return ''
    const startTxt = calendarApi.formatDate(selectedInfo.start, {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'long'
    })
    const endTxt = calendarApi.formatDate(selectedInfo.end, {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric'
    })
    return `${startTxt} - ${endTxt}`
  }

  function loadEvents(fetchInfo, successCallback) {
    const { start, end } = fetchInfo
    const loaded = []

    // A) Normal reservations
    events.forEach((evt) => {
      loaded.push({
        id: evt.id,
        title: evt.title,
        start: evt.start,
        end: evt.end,
        color: '#3788d8'
      })
    })

    // B) Manual blocks => background
    blockedTimes.forEach((b, i) => {
      loaded.push({
        id: `blocked-${i}`,
        start: b.start,
        end: b.end,
        display: 'background',
        color: '#ffcccc'
      })
    })

    // C) Build day+hour auto-block expansions => background
    const autoEvents = buildAutoBlockAllEvents(autoBlockHours, autoBlockDays, start, end)
    loaded.push(...autoEvents)

    // D) Past-block overlay
    if (pastBlockEvent) {
      loaded.push(pastBlockEvent)
    }

    successCallback(loaded)
  }

  return (
    <>
      <div>
        {/* 1) "Powered by Legio Fidelis" with an Instagram link */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
  <img
    src="/assets/ladyofgrace.png"
    alt="Legio Fidelis"
    style={{
      maxWidth: '80px',
      marginBottom: '0.4rem',
      display: 'block',
      marginLeft: 'auto',
      marginRight: 'auto'
    }}
  />
  <div style={{ fontSize: '1.3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
    <span>Connect</span>
    <a
      href="https://instagram.com/Legio.Fidelis"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem'
      }}
    >
      <img
        src="/assets/instagram.png"
        alt="Instagram"
        style={{
          width: '30px',
          height: '30px',
          objectFit: 'contain',
          verticalAlign: 'middle'
        }}
      />
      @Legio.Fidelis
    </a>
  </div>
</div>

        <FullCalendar
          ref={calendarRef}
          locales={allLocales}
          locale={
            language === 'de'
              ? 'de'
              : language === 'es'
                ? 'es'
                : 'en'
          }
          slotLabelFormat={(dateInfo) => {
            return moment(dateInfo.date).format('h A')
          }}
          plugins={[
            timeGridPlugin,
            scrollGridPlugin,
            interactionPlugin,
            momentPlugin,
            momentTimezonePlugin
          ]}
          timeZone="Asia/Jerusalem"
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
            start: moment().tz('Asia/Jerusalem').subtract(7, 'days').format(),
            end: moment().tz('Asia/Jerusalem').add(30, 'days').format()
          }}
          events={loadEvents}
          select={handleSelect}
          selectAllow={(selectInfo) => {
            const selStart = moment.tz(selectInfo.startStr, 'Asia/Jerusalem')
            const selEnd   = moment.tz(selectInfo.endStr, 'Asia/Jerusalem')

            const nextHour = getJerusalemNextHourMoment()
            if (selStart.isBefore(nextHour)) return false

            if (isTimeBlockedByManual(selStart, selEnd)) return false
            if (isTimeBlockedByAuto(selStart, selEnd)) return false
            if (isSlotReserved(selStart, selEnd)) return false

            const duration = selEnd.diff(selStart, 'hours', true)
            const isExactlyOneHour = duration === 1

            let sameDay = selStart.isSame(selEnd, 'day')
            if (!sameDay && isExactlyOneHour) {
              if (selEnd.hour() === 0 && selEnd.minute() === 0 && selEnd.second() === 0) {
                sameDay = true
              }
            }
            return sameDay && isExactlyOneHour
          }}
          allDaySlot={false}
          slotDuration="01:00:00"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          headerToolbar={{
            left: 'prev,next',
            center: 'title',
            right: ''
          }}
          eventContent={(arg) => {
            if (
              arg.event.id.startsWith('blocked-') ||
              arg.event.id === 'past-block' ||
              arg.event.id.startsWith('auto-')
            ) {
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
          setModalIsOpen(false)
          setIsSubmitting(false)
        }}
        contentLabel={t({
          en: 'Reservation Form',
          de: 'Reservierungsformular',
          es: 'Formulario de Reserva'
        })}
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
        <h2>
          {t({
            en: 'Reserve a Time Slot',
            de: 'Zeitfenster reservieren',
            es: 'Reservar un intervalo de tiempo'
          })}
        </h2>
        <p style={{ marginBottom: '15px', fontStyle: 'italic' }}>
          {formatSelectedTime()}
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            {t({
              en: 'Name:',
              de: 'Name:',
              es: 'Nombre:'
            })}
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
            style={{ width: '100%', marginBottom: '10px', padding: '6px' }}
          />
          <label>
            {t({
              en: 'Phone:',
              de: 'Telefon:',
              es: 'Teléfono:'
            })}
          </label>
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
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ marginRight: '10px' }}
            >
              {isSubmitting
                ? t({
                    en: 'Reserving...',
                    de: 'Reservieren...',
                    es: 'Reservando...'
                  })
                : t({
                    en: 'Reserve',
                    de: 'Reservieren',
                    es: 'Reservar'
                  })}
            </button>
            <button
              type="button"
              onClick={() => setModalIsOpen(false)}
            >
              {t({
                en: 'Cancel',
                de: 'Abbrechen',
                es: 'Cancelar'
              })}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
