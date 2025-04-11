// AdminBlockCalendar.js
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import { TIMEZONE } from './config'
import allLocales from '@fullcalendar/core/locales-all'
import { isIOS } from 'react-device-detect'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import LanguageDropdown from './LanguageDropdown'
import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'
import client from './utils/sanityClient.js'
import { useLanguage } from './LanguageContext'
import useTranslate from './useTranslate'

// Components
import { AutoBlockControls } from './admin/AutoBlockControls.js'
import CalendarPasswordPanel from './admin/CalendarPasswordPanel'
import AdminAuthScreen from './admin/AdminAuthScreen'
import ReservationModal from './admin/ReservationModal'

// Manual-block helpers
import {
  isManuallyBlocked,
  handleBlock as rawHandleBlock,
  handleUnblock as rawHandleUnblock
} from './admin/ManualBlockLogic.js'

/**
 * Helper: "x days ago at local midnight" in the chapel’s time zone
 */
function getLocalMidnightXDaysAgo(daysAgo, tz) {
  return moment.tz(tz).startOf('day').subtract(daysAgo, 'days').toDate()
}

export default function AdminBlockCalendar() {
  // ---------------------------------------------
  // 1) Chapel Slug from the URL (/:chapelSlug/admin)
  // ---------------------------------------------
  const { chapelSlug } = useParams()
  const [chapel, setChapel] = useState(null)

  // ---------------------------------------------
  // 2) Language + Auth
  // ---------------------------------------------
  const { language } = useLanguage()
  const t = useTranslate()
  const [authenticated, setAuthenticated] = useState(
    localStorage.getItem('isAdmin') === 'true'
  )

  // ---------------------------------------------
  // 3) Calendar Password State (per-chapel)
  // ---------------------------------------------
  const [calendarPasswordDocId, setCalendarPasswordDocId] = useState(null)
  const [currentCalendarPassword, setCurrentCalendarPassword] = useState('')

  // Fetch chapel-specific password doc
  const fetchCalendarPassword = useCallback(async (chapelId) => {
    try {
      const pwDoc = await client.fetch(
        `*[_type == "calendarPassword" && chapel._ref == $chapelId][0]{
          _id,
          password
        }`,
        { chapelId }
      )

      if (pwDoc) {
        setCalendarPasswordDocId(pwDoc._id)
        setCurrentCalendarPassword(pwDoc.password || '')
      } else {
        setCalendarPasswordDocId(null)
        setCurrentCalendarPassword('')
      }
    } catch (err) {
      console.error('Error fetching chapel-specific calendar password:', err)
      setCalendarPasswordDocId(null)
      setCurrentCalendarPassword('')
    }
  }, [])

  const handleSavePassword = useCallback(
    async (newPw, chapelId, existingDocId) => {
      if (!chapelId) {
        alert('No chapel ID found. Cannot save password.')
        return
      }
      try {
        const finalDocId = existingDocId || `calendarPassword-${chapelId}`
        const result = await client.createOrReplace({
          _id: finalDocId,
          _type: 'calendarPassword',
          chapel: { _ref: chapelId, _type: 'reference' },
          password: newPw
        })
        alert('Password saved to Sanity.')
        setCurrentCalendarPassword(newPw)
        setCalendarPasswordDocId(result._id)
      } catch (err) {
        console.error('Error saving password:', err)
        alert('Failed to save password.')
      }
    },
    []
  )

  const handleRemovePassword = useCallback(async (chapelId, docId) => {
    if (!window.confirm('Are you sure you want to remove the calendar password?')) {
      return
    }
    if (!docId) {
      alert('No password doc for this chapel. Nothing to remove.')
      return
    }
    try {
      await client.createOrReplace({
        _id: docId,
        _type: 'calendarPassword',
        chapel: { _ref: chapelId, _type: 'reference' },
        password: ''
      })
      alert('Password removed (set to empty).')
      setCurrentCalendarPassword('')
    } catch (err) {
      console.error('Error removing password:', err)
      alert('Failed to remove password.')
    }
  }, [])

  // ---------------------------------------------
  // 4) Data: Blocks, Reservations, AutoBlock
  // ---------------------------------------------
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [autoBlockRules, setAutoBlockRules] = useState([])
  const [autoBlockDays, setAutoBlockDays] = useState(null)
  const [pastBlockEvent, setPastBlockEvent] = useState(null)

  // ---------------------------------------------
  // 5) UI State
  // ---------------------------------------------
  const calendarRef = useRef()
  const platformDelay = isIOS ? 100 : 47
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)

  // ---------------------------------------------
  // 6) Fetch Data
  // ---------------------------------------------
  const fetchData = useCallback(async () => {
    const calendarApi = calendarRef.current?.getApi()
    const currentViewDate = calendarApi?.getDate()

    try {
      // 1) Chapel doc
      const chapelDoc = await client.fetch(
        `*[_type == "chapel" && slug.current == $slug][0]`,
        { slug: chapelSlug }
      )
      if (!chapelDoc) {
        console.warn('No chapel found with slug:', chapelSlug)
        return
      }
      setChapel(chapelDoc)

      // 2) password doc
      await fetchCalendarPassword(chapelDoc._id)

      // 3) Manual blocks
      const blocksData = await client.fetch(
        `*[_type == "blocked" && chapel._ref == $chapelId]{_id, start, end}`,
        { chapelId: chapelDoc._id }
      )
      setBlocks(blocksData)

      // 4) Reservations
      const resData = await client.fetch(
        `*[_type == "reservation" && chapel._ref == $chapelId]{
          _id,
          name,
          phone,
          start,
          end
        }`,
        { chapelId: chapelDoc._id }
      )
      setReservations(resData)

      // 5) Hour-based autoBlock
      const autoData = await client.fetch(
        `*[_type == "autoBlockedHours" && chapel._ref == $chapelId]{
          _id,
          startHour,
          endHour,
          timeExceptions[]{ date, startHour, endHour }
        }`,
        { chapelId: chapelDoc._id }
      )
      setAutoBlockRules(autoData)

      // 6) Day-based autoBlock
      const daysDocArr = await client.fetch(
        `*[_type == "autoBlockedDays" && chapel._ref == $chapelId]{
          _id,
          daysOfWeek,
          timeExceptions[]{ date, startHour, endHour }
        }`,
        { chapelId: chapelDoc._id }
      )
      setAutoBlockDays(daysDocArr.length ? daysDocArr[0] : null)

      // 7) Return FullCalendar to the existing date
      if (calendarApi && currentViewDate) {
        calendarApi.gotoDate(currentViewDate)
      }
    } catch (err) {
      console.error('Error loading data from Sanity:', err)
    }
  }, [chapelSlug, fetchCalendarPassword])

  useEffect(() => {
    if (authenticated) {
      fetchData()
    }
  }, [authenticated, fetchData])

  // ---------------------------------------------
  // 7) Past-block overlay, pinned to chapel's time zone
  // ---------------------------------------------
  useEffect(() => {
    function updatePastBlockEvent() {
      if (!chapel?.timezone) return // if we haven't got the chapel yet
      const adminTZ = chapel.timezone || TIMEZONE
      const earliest = getLocalMidnightXDaysAgo(7, adminTZ)
      const now = moment.tz(adminTZ).toDate()
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
  }, [chapel])

  // If not auth => show password screen
  if (!authenticated) {
    return <AdminAuthScreen onSuccess={setAuthenticated} />
  }

  // ---------------------------------------------
  // 8) Instead of TIMEZONE, use adminTZ from chapel?.timezone
  // ---------------------------------------------
  const adminTZ = chapel?.timezone || TIMEZONE

  function isDayLevelExcepted(hStart, hEnd) {
    if (!autoBlockDays?.timeExceptions?.length) return false
    const sLocal = moment.tz(hStart, adminTZ)
    const eLocal = moment.tz(hEnd,   adminTZ)
    const dateStr = sLocal.format('YYYY-MM-DD')
    return autoBlockDays.timeExceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== dateStr) return false
      const exDay   = sLocal.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd   = exDay.clone().hour(parseInt(ex.endHour   || '0', 10))
      return sLocal.isBefore(exEnd) && eLocal.isAfter(exStart)
    })
  }

  function isHourRuleExcepted(rule, hStart, hEnd) {
    const sLocal = moment.tz(hStart, adminTZ)
    const eLocal = moment.tz(hEnd,   adminTZ)
    const exceptions = rule.timeExceptions || []
    return exceptions.some((ex) => {
      if (!ex.date) return false
      if (ex.date.slice(0, 10) !== sLocal.format('YYYY-MM-DD')) return false
      const exDay   = sLocal.clone().startOf('day')
      const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
      const exEnd   = exDay.clone().hour(parseInt(ex.endHour   || '0', 10))
      return sLocal.isBefore(exEnd) && eLocal.isAfter(exStart)
    })
  }

  function doesRuleCoverHourRule(rule, hStart, hEnd) {
    const sLocal    = moment.tz(hStart, adminTZ)
    const eLocal    = moment.tz(hEnd,   adminTZ)
    const dayAnchor = sLocal.clone().startOf('day')
    const rStart    = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
    const rEnd      = dayAnchor.clone().hour(parseInt(rule.endHour,   10))
    if (sLocal.isBefore(rStart) || eLocal.isAfter(rEnd)) return false
    if (isHourRuleExcepted(rule, hStart, hEnd)) return false
    return true
  }

  function isAutoBlocked(hStart, hEnd) {
    if (!chapel) return false
    if (autoBlockDays?.daysOfWeek?.length) {
      const dayName = moment.tz(hStart, adminTZ).format('dddd')
      if (autoBlockDays.daysOfWeek.includes(dayName)) {
        if (!isDayLevelExcepted(hStart, hEnd)) {
          return true
        }
      }
    }
    return autoBlockRules.some((rule) => doesRuleCoverHourRule(rule, hStart, hEnd))
  }

  function isRangeCompletelyBlocked(info) {
    const slotStart = new Date(info.start)
    const slotEnd   = new Date(info.end)
    let cursor = slotStart
    while (cursor < slotEnd) {
      const nextHour = new Date(cursor.getTime() + 3600000)
      if (
        !isManuallyBlocked(cursor, nextHour, blocks) &&
        !isAutoBlocked(cursor, nextHour)
      ) {
        return false
      }
      cursor = nextHour
    }
    return true
  }

  // ---------------------------------------------
  // 9) Adjust expansions to use adminTZ
  // ---------------------------------------------
  function getAutoBlockSlices(rule, dayStart, dayEnd) {
    const slices = []
    const startLocal = moment.tz(dayStart, adminTZ).startOf('day')
    const endLocal   = moment.tz(dayEnd,   adminTZ).endOf('day')
    while (startLocal.isSameOrBefore(endLocal, 'day')) {
      for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
        const sliceStart = startLocal.clone().hour(h)
        const sliceEnd   = sliceStart.clone().add(1, 'hour')
        if (sliceEnd <= dayStart || sliceStart >= dayEnd) continue
        if (isHourRuleExcepted(rule, sliceStart.toDate(), sliceEnd.toDate())) continue
        slices.push([sliceStart.toDate(), sliceEnd.toDate()])
      }
      startLocal.add(1, 'day').startOf('day')
    }
    return mergeSlices(slices)
  }

  function getDayBlockSlices(dayDoc, rangeStart, rangeEnd) {
    const slices = []
    if (!dayDoc.daysOfWeek?.length) return slices

    const currentLocal = moment.tz(rangeStart, adminTZ).startOf('day')
    const limitLocal   = moment.tz(rangeEnd,   adminTZ).endOf('day')

    while (currentLocal.isBefore(limitLocal)) {
      const dayName = currentLocal.format('dddd')
      if (dayDoc.daysOfWeek.includes(dayName)) {
        for (let h = 0; h < 24; h++) {
          const sliceStart = currentLocal.clone().hour(h)
          const sliceEnd   = sliceStart.clone().add(1, 'hour')
          if (sliceEnd <= rangeStart || sliceStart >= rangeEnd) continue
          if (isDayLevelExcepted(sliceStart.toDate(), sliceEnd.toDate())) continue
          slices.push([sliceStart.toDate(), sliceEnd.toDate()])
        }
      }
      currentLocal.add(1, 'day').startOf('day')
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
      if (!isManuallyBlocked(cursorCheck, nxt, blocks)) {
        return false
      }
      cursorCheck = nxt
    }
    return true
  }

  function loadEvents(fetchInfo, successCallback) {
    const { start, end } = fetchInfo
    const evts = []

    // 1) Reservations
    reservations.forEach((r) => {
      evts.push({
        id: r._id,
        title: r.name,
        start: r.start,
        end: r.end,
        color: '#3788d8'
      })
    })

    // 2) Manual blocks => background
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

    // 3) Day-based expansions
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

    // 4) Hour-based expansions
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

    // 5) Past-block overlay
    if (pastBlockEvent) {
      evts.push(pastBlockEvent)
    }

    successCallback(evts)
  }

  function handleEventContent(arg) {
    if (arg.event.display === 'background') return null
    return <div>{arg.event.title}</div>
  }

  function handleEventClick(clickInfo) {
    const r = reservations.find((x) => x._id === clickInfo.event.id)
    if (r) {
      setSelectedReservation(r)
      setModalIsOpen(true)
    }
  }

  // ---------------------------------------------
  // 10) Reservation Deletion
  // ---------------------------------------------
  async function handleDeleteReservation() {
    if (!selectedReservation) return
    if (
      !window.confirm(
        t({
          en: 'Delete this reservation?',
          de: 'Diese Reservierung löschen?',
          es: '¿Eliminar esta reserva?'
        })
      )
    ) {
      return
    }
    await client.delete(selectedReservation._id)
    fetchData()
    setModalIsOpen(false)
    setSelectedReservation(null)
  }

  // ---------------------------------------------
  // 11) Pass chapel.timezone so ManualBlockLogic interprets the selected range in local time
  // ---------------------------------------------
  function handleBlock(info, blocks, t, reloadFn) {
    if (!chapel) {
      alert('No chapel found. Cannot block.')
      return
    }
    return rawHandleBlock(info, blocks, t, reloadFn, chapel._id, adminTZ)
  }

  function handleUnblock(info, blocks, autoBlockRules, autoBlockDays, t, reloadFn) {
    // If you want unblocking also to interpret local times in adminTZ, pass it:
    return rawHandleUnblock(info, blocks, autoBlockRules, autoBlockDays, t, reloadFn, adminTZ)
  }

  // ---------------------------------------------
  // 12) Render
  // ---------------------------------------------
  const now = new Date()
  const validRangeStart = new Date(now)
  validRangeStart.setHours(0, 0, 0, 0)
  validRangeStart.setDate(validRangeStart.getDate() - 7)

  const validRangeEnd = new Date(now)
  validRangeEnd.setDate(validRangeEnd.getDate() + 30)

  return (
    <div style={{ padding: '1rem' }}>
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

      {/* Show the chapel name if found */}
      {chapel && (
        <p style={{ textAlign: 'center', fontWeight: 'bold' }}>
          Managing Chapel: {chapel.name}
        </p>
      )}

      {/* Per-chapel password panel */}
      <CalendarPasswordPanel
        chapelId={chapel?._id || null}
        existingPasswordDocId={calendarPasswordDocId}
        currentCalendarPassword={currentCalendarPassword}
        onSavePassword={handleSavePassword}
        onRemovePassword={handleRemovePassword}
      />

      {/* Auto-block config */}
      <AutoBlockControls
        chapelId={chapel?._id || null}
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
        // Use the chapel's actual time zone for the Admin UI
        timeZone={adminTZ}
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
          if (isRangeCompletelyBlocked(info)) {
            if (
              window.confirm(
                t({
                  en: 'Unblock this time slot?',
                  de: 'Dieses Zeitfenster freigeben?',
                  es: '¿Desbloquear este intervalo de tiempo?'
                })
              )
            ) {
              handleUnblock(info, blocks, autoBlockRules, autoBlockDays, t, fetchData)
            }
          } else {
            if (
              window.confirm(
                t({
                  en: 'Block this time slot?',
                  de: 'Dieses Zeitfenster blockieren?',
                  es: '¿Bloquear este intervalo de tiempo?'
                })
              )
            ) {
              handleBlock(info, blocks, t, fetchData)
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
        slotLabelFormat={(dateInfo) => moment(dateInfo.date).format('h A')}
      />

      <ReservationModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        reservation={selectedReservation}
        onDelete={handleDeleteReservation}
      />
    </div>
  )
}
