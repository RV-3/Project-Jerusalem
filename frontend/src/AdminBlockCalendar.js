// AdminBlockCalendar.js
import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import { TIMEZONE } from './config'
import allLocales from '@fullcalendar/core/locales-all'
import { isIOS } from 'react-device-detect'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import LanguageDropdown from './LanguageDropdown' // (adjust path as needed)

import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'

import { useLanguage } from './LanguageContext'
import useTranslate from './useTranslate'
import { AutoBlockControls } from './admin/AutoBlockControls.js'

Modal.setAppElement('#root') // ensure modals work properly

const ADMIN_PASSWORD = 'admin123'

// Helper for "x days ago at midnight in Jerusalem"
function getJerusalemMidnightXDaysAgo(daysAgo) {
  return moment.tz(TIMEZONE)
    .startOf('day')
    .subtract(daysAgo, 'days')
    .toDate()
}

// ---------------------------------------------------------------------
// MAIN AdminBlockCalendar COMPONENT
// ---------------------------------------------------------------------
export default function AdminBlockCalendar() {
  // Global language & translations
  const { language } = useLanguage()
  const t = useTranslate()

  // Simple admin auth state
  const [authenticated, setAuthenticated] = useState(
    localStorage.getItem('isAdmin') === 'true'
  )

  // Data state
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [autoBlockRules, setAutoBlockRules] = useState([])
  const [autoBlockDays, setAutoBlockDays] = useState(null)
  const [pastBlockEvent, setPastBlockEvent] = useState(null)

  // UI state
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const calendarRef = useRef()
  const platformDelay = isIOS ? 100 : 47

  // ---------------------------------------------------------------------
  // 1) FETCH DATA
  // ---------------------------------------------------------------------
  async function fetchData() {
    const calendarApi = calendarRef.current?.getApi()
    const currentViewDate = calendarApi?.getDate()

    try {
      // Manual blocks
      const blocksData = await client.fetch(`*[_type == "blocked"]{_id, start, end}`)
      setBlocks(blocksData)

      // Reservations
      const resData = await client.fetch(
        `*[_type == "reservation"]{_id, name, phone, start, end}`
      )
      setReservations(resData)

      // Hour-based auto-block
      const autoData = await client.fetch(`
        *[_type == "autoBlockedHours"]{
          _id,
          startHour,
          endHour,
          timeExceptions[]{ date, startHour, endHour }
        }
      `)
      setAutoBlockRules(autoData)

      // Day-based auto-block
      const daysDoc = await client.fetch(`
        *[_type == "autoBlockedDays"]{
          _id,
          daysOfWeek,
          timeExceptions[]{ date, startHour, endHour }
        }
      `)
      setAutoBlockDays(daysDoc.length ? daysDoc[0] : null)

      if (calendarApi && currentViewDate) {
        calendarApi.gotoDate(currentViewDate)
      }
    } catch (err) {
      console.error('Error loading data from Sanity:', err)
    }
  }

  // Fetch data once authenticated
  useEffect(() => {
    if (authenticated) {
      fetchData()
    }
  }, [authenticated])

  // ---------------------------------------------------------------------
  // 2) PAST-BLOCK OVERLAY (last 7 days => now)
  // ---------------------------------------------------------------------
  useEffect(() => {
    function updatePastBlockEvent() {
      const earliest = getJerusalemMidnightXDaysAgo(7)
      const now = new Date()
      setPastBlockEvent({
        id: 'past-block',
        start: earliest,
        end: now,
        display: 'background',
        color: '#6e6e6e'
      })
    }
    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------
  // AUTH SCREEN (password check)
  // ---------------------------------------------------------------------
  if (!authenticated) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '1rem',
          background: '#fff'
        }}
      >
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          {t({
            en: 'Enter Admin Password',
            de: 'Admin-Passwort eingeben',
            es: 'Ingrese la contraseña de administrador'
          })}
        </h2>

        {/* Custom LanguageDropdown for the login screen */}
        <div style={{ marginBottom: '1rem' }}>
          <LanguageDropdown />
        </div>

        <input
          type="password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.target.value === ADMIN_PASSWORD) {
                localStorage.setItem('isAdmin', 'true')
                setAuthenticated(true)
              } else {
                alert(
                  t({
                    en: 'Incorrect password',
                    de: 'Falsches Passwort',
                    es: 'Contraseña incorrecta'
                  })
                )
              }
            }
          }}
          placeholder={t({
            en: 'Admin password',
            de: 'Admin-Passwort',
            es: 'Contraseña de administrador'
          })}
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
              alert(
                t({
                  en: 'Incorrect password',
                  de: 'Falsches Passwort',
                  es: 'Contraseña incorrecta'
                })
              )
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
          {t({ en: 'Submit', de: 'Abschicken', es: 'Enviar' })}
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------
  // BLOCKING/UNBLOCKING LOGIC
  // ---------------------------------------------------------------------
  function isManuallyBlocked(hStart, hEnd) {
    return blocks.some((b) => {
      const bStart = new Date(b.start).getTime()
      const bEnd = new Date(b.end).getTime()
      return bStart === hStart.getTime() && bEnd === hEnd.getTime()
    })
  }

  function isDayLevelExcepted(hStart, hEnd) {
    if (!autoBlockDays?.timeExceptions?.length) return false
    const sJer = moment.tz(hStart, TIMEZONE)
    const eJer = moment.tz(hEnd, TIMEZONE)
    const dateStr = sJer.format('YYYY-MM-DD')

    return autoBlockDays.timeExceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false
      const exDay = sJer.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd = exDay.clone().hour(parseInt(ex.endHour || '0', 10))
      return sJer.isBefore(exEnd) && eJer.isAfter(exStart)
    })
  }

  function isHourRuleExcepted(rule, hStart, hEnd) {
    const sJer = moment.tz(hStart, TIMEZONE)
    const eJer = moment.tz(hEnd, TIMEZONE)
    const dateStr = sJer.format('YYYY-MM-DD')
    const exceptions = rule.timeExceptions || []

    return exceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false
      const exDay = sJer.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd = exDay.clone().hour(parseInt(ex.endHour || '0', 10))
      return sJer.isBefore(exEnd) && eJer.isAfter(exStart)
    })
  }

  function doesRuleCoverHourRule(rule, hStart, hEnd) {
    const sJer = moment.tz(hStart, TIMEZONE)
    const eJer = moment.tz(hEnd, TIMEZONE)
    const dayAnchor = sJer.clone().startOf('day')
    const rStart = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
    const rEnd = dayAnchor.clone().hour(parseInt(rule.endHour, 10))

    if (sJer.isBefore(rStart) || eJer.isAfter(rEnd)) return false
    if (isHourRuleExcepted(rule, hStart, hEnd)) return false
    return true
  }

  function isAutoBlocked(hStart, hEnd) {
    // Day-based
    if (autoBlockDays?.daysOfWeek?.length) {
      const dayName = moment.tz(hStart, TIMEZONE).format('dddd')
      if (autoBlockDays.daysOfWeek.includes(dayName)) {
        if (!isDayLevelExcepted(hStart, hEnd)) {
          return true
        }
      }
    }
    // Hour-based
    return autoBlockRules.some((rule) => doesRuleCoverHourRule(rule, hStart, hEnd))
  }

  function isRangeCompletelyBlocked(info) {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)

    let cursor = slotStart
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      if (!isManuallyBlocked(cursor, nextHour) && !isAutoBlocked(cursor, nextHour)) {
        return false
      }
      cursor = nextHour
    }
    return true
  }

  // ---------- FIX handleBlock for ESLint no-loop-func ----------
  async function handleBlock(info) {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)

    if (slotStart < new Date()) {
      alert(t({
        en: 'Cannot block a past slot.',
        de: 'Kann kein vergangenes Zeitfenster blockieren.',
        es: 'No se puede bloquear un intervalo pasado.'
      }))
      return
    }

    const docs = []
    let cursorLocal = slotStart
    while (cursorLocal < slotEnd) {
      const nextHour = new Date(cursorLocal.getTime() + 3600000)
      const startCopy = new Date(cursorLocal)
      const endCopy = new Date(nextHour)

      if (!isManuallyBlocked(startCopy, endCopy)) {
        docs.push({
          _type: 'blocked',
          start: startCopy.toISOString(),
          end: endCopy.toISOString()
        })
      }
      cursorLocal = nextHour
    }

    if (!docs.length) {
      alert(t({
        en: 'All those hours are already blocked.',
        de: 'Alle diese Stunden sind bereits blockiert.',
        es: 'Todas esas horas ya están bloqueadas.'
      }))
      return
    }

    await Promise.all(docs.map((doc) => client.create(doc)))
    fetchData()
  }

  // ---------- FIX handleUnblock for ESLint no-loop-func ----------
  async function handleUnblock(info) {
    const slotStart = new Date(info.start)
    const slotEnd = new Date(info.end)
    if (slotStart < new Date()) {
      alert(t({
        en: 'Cannot unblock past time.',
        de: 'Kann vergangene Zeit nicht freigeben.',
        es: 'No se puede desbloquear un tiempo pasado.'
      }))
      return
    }

    // 1) Remove manual blocks
    const deletions = []
    let cursorLocal = slotStart
    while (cursorLocal < slotEnd) {
      const nextHour = new Date(cursorLocal.getTime() + 3600000)
      const startCopy = new Date(cursorLocal)
      const endCopy = new Date(nextHour)

      const existing = blocks.find((b) => {
        const bStart = new Date(b.start).getTime()
        const bEnd = new Date(b.end).getTime()
        return bStart === startCopy.getTime() && bEnd === endCopy.getTime()
      })
      if (existing) {
        deletions.push(client.delete(existing._id))
      }
      cursorLocal = nextHour
    }

    // 2) Add timeExceptions if needed
    const patches = []
    let exCursorLocal = slotStart
    while (exCursorLocal < slotEnd) {
      const nextHr = new Date(exCursorLocal.getTime() + 3600000)
      const startCopy = new Date(exCursorLocal)
      const endCopy = new Date(nextHr)

      // hour-based
      autoBlockRules.forEach((rule) => {
        if (doesRuleCoverHourRule(rule, startCopy, endCopy)) {
          const dateStr = moment.tz(startCopy, TIMEZONE).format('YYYY-MM-DD')
          const startHr = moment.tz(startCopy, TIMEZONE).hour()
          const endHr = moment.tz(endCopy, TIMEZONE).hour()

          const ex = {
            _type: 'timeException',
            date: dateStr,
            startHour: String(startHr),
            endHour: String(endHr)
          }
          patches.push(
            client
              .patch(rule._id)
              .setIfMissing({ timeExceptions: [] })
              .append('timeExceptions', [ex])
              .commit()
          )
        }
      })

      // day-based
      if (autoBlockDays?.daysOfWeek?.length) {
        const dayName = moment.tz(startCopy, TIMEZONE).format('dddd')
        if (autoBlockDays.daysOfWeek.includes(dayName)) {
          const dateStr = moment.tz(startCopy, TIMEZONE).format('YYYY-MM-DD')
          const startHr = moment.tz(startCopy, TIMEZONE).hour()
          const endHr = moment.tz(endCopy, TIMEZONE).hour()

          const ex = {
            _type: 'timeException',
            date: dateStr,
            startHour: String(startHr),
            endHour: String(endHr)
          }
          patches.push(
            client
              .patch(autoBlockDays._id)
              .setIfMissing({ timeExceptions: [] })
              .append('timeExceptions', [ex])
              .commit()
          )
        }
      }
      exCursorLocal = nextHr
    }

    await Promise.all([...deletions, ...patches])
    fetchData()
  }

  // ---------------------------------------------------------------------
  // 5) FULLCALENDAR LOAD EVENTS
  // ---------------------------------------------------------------------
  function loadEvents(fetchInfo, successCallback) {
    const { start, end } = fetchInfo
    const evts = []

    // Reservations
    reservations.forEach((r) => {
      evts.push({
        id: r._id,
        title: r.name,
        start: r.start,
        end: r.end,
        color: '#3788d8'
      })
    })

    // Manual blocks
    blocks.forEach((b) => {
      evts.push({
        id: b._id,
        title: 'Blocked',
        start: b.start,
        end: b.end,
        display: 'background',
        color: '#999999'
      })
    })

    // Day-based expansions
    if (autoBlockDays) {
      const daySlices = getDayBlockSlices(autoBlockDays, start, end)
      daySlices.forEach(([s, e]) => {
        if (!fullyCoveredByManual(s, e)) {
          evts.push({
            id: `auto-day-${autoBlockDays._id}-${s.toISOString()}`,
            title: 'Blocked',
            start: s,
            end: e,
            display: 'background',
            color: '#999999'
          })
        }
      })
    }

    // Hour-based expansions
    autoBlockRules.forEach((rule) => {
      const slices = getAutoBlockSlices(rule, start, end)
      slices.forEach(([s, e]) => {
        if (!fullyCoveredByManual(s, e)) {
          evts.push({
            id: `auto-hour-${rule._id}-${s.toISOString()}`,
            title: 'Blocked',
            start: s,
            end: e,
            display: 'background',
            color: '#999999'
          })
        }
      })
    })

    // Past-block
    if (pastBlockEvent) {
      evts.push(pastBlockEvent)
    }

    successCallback(evts)
  }

  function getAutoBlockSlices(rule, dayStart, dayEnd) {
    const slices = []
    let cursorDay = moment.tz(dayStart, TIMEZONE).startOf('day')
    const endOfDay = moment.tz(dayEnd, TIMEZONE).endOf('day')

    while (cursorDay.isSameOrBefore(endOfDay, 'day')) {
      for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
        const sliceStart = cursorDay.clone().hour(h)
        const sliceEnd = sliceStart.clone().add(1, 'hour')
        if (sliceEnd <= dayStart || sliceStart >= dayEnd) continue
        if (isHourRuleExcepted(rule, sliceStart.toDate(), sliceEnd.toDate())) continue
        slices.push([sliceStart.toDate(), sliceEnd.toDate()])
      }
      cursorDay.add(1, 'day').startOf('day')
    }
    return mergeSlices(slices)
  }

  function getDayBlockSlices(dayDoc, rangeStart, rangeEnd) {
    const slices = []
    if (!dayDoc.daysOfWeek?.length) return slices

    let current = new Date(rangeStart)
    current.setHours(0, 0, 0, 0)
    while (current < rangeEnd) {
      const dayName = moment.tz(current, TIMEZONE).format('dddd')
      if (dayDoc.daysOfWeek.includes(dayName)) {
        for (let h = 0; h < 24; h++) {
          const sliceStart = moment
            .tz(current, TIMEZONE)
            .hour(h)
            .toDate()
          const sliceEnd = new Date(sliceStart.getTime() + 3600000)
          if (sliceEnd <= rangeStart || sliceStart >= rangeEnd) continue
          if (isDayLevelExcepted(sliceStart, sliceEnd)) continue
          slices.push([sliceStart, sliceEnd])
        }
      }
      current.setDate(current.getDate() + 1)
    }
    return mergeSlices(slices)
  }

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

  function fullyCoveredByManual(start, end) {
    let cursorCheck = new Date(start)
    while (cursorCheck < end) {
      const nxt = new Date(cursorCheck.getTime() + 3600000)
      if (!isManuallyBlocked(cursorCheck, nxt)) {
        return false
      }
      cursorCheck = nxt
    }
    return true
  }

  // 6) Event content (hide background text)
  function handleEventContent(arg) {
    if (arg.event.display === 'background') return null
    return <div>{arg.event.title}</div>
  }

  // 7) Reservation click => open modal
  function handleEventClick(clickInfo) {
    const r = reservations.find((x) => x._id === clickInfo.event.id)
    if (r) {
      setSelectedReservation(r)
      setModalIsOpen(true)
    }
  }

  async function handleDeleteReservation() {
    if (!selectedReservation) return
    if (!window.confirm(t({
      en: 'Delete this reservation?',
      de: 'Diese Reservierung löschen?',
      es: '¿Eliminar esta reserva?'
    }))) {
      return
    }
    await client.delete(selectedReservation._id)
    fetchData()
    setModalIsOpen(false)
    setSelectedReservation(null)
  }

  // 8) Admin main content
  const now = new Date()
  const validRangeStart = new Date(now)
  validRangeStart.setHours(0, 0, 0, 0)
  validRangeStart.setDate(validRangeStart.getDate() - 7)

  const validRangeEnd = new Date(now)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <div style={{ padding: '1rem' }}>
      {/* LanguageDropdown at top of admin panel */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <LanguageDropdown />
      </div>

      <h2 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.8rem' }}>
        {t({
          en: 'Admin Panel',
          de: 'Admin-Bereich',
          es: 'Panel de Administración'
        })}
      </h2>

      {/* Auto-block subcomponent */}
      <AutoBlockControls
        autoBlockRules={autoBlockRules}
        setAutoBlockRules={setAutoBlockRules}
        autoBlockDays={autoBlockDays}
        setAutoBlockDays={setAutoBlockDays}
        reloadData={fetchData}
      />

      <FullCalendar
        ref={calendarRef}
        locales={allLocales}
        locale={language === 'de' ? 'de' : language === 'es' ? 'es' : 'en'}
        plugins={[
          timeGridPlugin,
          scrollGridPlugin,
          interactionPlugin,
          momentPlugin,
          momentTimezonePlugin
        ]}
        timeZone={TIMEZONE}
        initialView="timeGrid30Day"
        views={{
          timeGrid30Day: {
            type: 'timeGrid',
            duration: { days: 30 },
            dayCount: 30,
            buttonText: '30 days'
          }
        }}
        dayMinWidth={240}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        height="auto"
        stickyHeaderDates
        stickyFooterScrollbar={false}
        longPressDelay={platformDelay}
        selectLongPressDelay={platformDelay}
        eventLongPressDelay={platformDelay}
        validRange={{
          start: validRangeStart.toISOString(),
          end: validRangeEnd.toISOString()
        }}
        selectable
        selectAllow={(selectInfo) => new Date(selectInfo.startStr) >= new Date()}
        select={(info) => {
          // If fully blocked => ask to unblock
          if (isRangeCompletelyBlocked(info)) {
            if (window.confirm(t({
              en: 'Unblock this time slot?',
              de: 'Dieses Zeitfenster freigeben?',
              es: '¿Desbloquear este intervalo de tiempo?'
            }))) {
              handleUnblock(info)
            }
          } else {
            if (window.confirm(t({
              en: 'Block this time slot?',
              de: 'Dieses Zeitfenster blockieren?',
              es: '¿Bloquear este intervalo de tiempo?'
            }))) {
              handleBlock(info)
            }
          }
        }}
        events={loadEvents}
        eventContent={handleEventContent}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next',
          center: 'title',
          right: ''
        }}
        dayHeaderFormat={{
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
          omitCommas: true
        }}
        slotLabelFormat={(dateInfo) => {
          // Force "12 AM, 1 AM..." style
          return moment(dateInfo.date).format('h A')
        }}
      />

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel={t({
          en: 'Reservation Info',
          de: 'Reservierungsdetails',
          es: 'Información de la reserva'
        })}
        style={{
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 1000
          },
          content: {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            padding: '25px',
            borderRadius: '8px',
            background: 'white',
            width: '400px'
          }
        }}
      >
        <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          {t({
            en: 'Reservation Details',
            de: 'Reservierungsdetails',
            es: 'Detalles de la reserva'
          })}
        </h3>
        {selectedReservation && (
          <div style={{ fontSize: '1rem' }}>
            <p>
              <strong>
                {t({ en: 'Name:', de: 'Name:', es: 'Nombre:' })}
              </strong>{' '}
              {selectedReservation.name}
            </p>
            <p>
              <strong>
                {t({ en: 'Phone:', de: 'Telefon:', es: 'Teléfono:' })}
              </strong>{' '}
              {selectedReservation.phone}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={handleDeleteReservation}
            style={{
              marginRight: '10px',
              color: '#fff',
              background: '#d9534f',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {t({ en: 'Delete', de: 'Löschen', es: 'Eliminar' })}
          </button>
          <button
            onClick={() => setModalIsOpen(false)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {t({ en: 'Close', de: 'Schließen', es: 'Cerrar' })}
          </button>
        </div>
      </Modal>
    </div>
  )
}
