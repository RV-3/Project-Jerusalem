import React, { useEffect, useState, useRef, useCallback } from 'react'
import { isIOS } from 'react-device-detect'
import FullCalendar from '@fullcalendar/react'
import allLocales from '@fullcalendar/core/locales-all'
import { TIMEZONE } from './config'
import timeGridPlugin from '@fullcalendar/timegrid'
import scrollGridPlugin from '@fullcalendar/scrollgrid'
import interactionPlugin from '@fullcalendar/interaction'
import moment from 'moment-timezone'
import momentPlugin from '@fullcalendar/moment'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import './Calendar.css'

import useTranslate from './useTranslate'
import { useLanguage } from './LanguageContext'

Modal.setAppElement('#root')

const platformDelay = isIOS ? 100 : 46

function isHourExcepted(exceptions = [], hStart, hEnd, tz) {
  const start = moment.tz(hStart, tz)
  const end = moment.tz(hEnd, tz)
  const dateStr = start.format('YYYY-MM-DD')
  return exceptions.some((ex) => {
    if (!ex.date) return false
    if (ex.date.slice(0, 10) !== dateStr) return false
    const exDay = start.clone().startOf('day')
    const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10))
    const exEnd = exDay.clone().hour(parseInt(ex.endHour || '0', 10))
    return start.isBefore(exEnd) && end.isAfter(exStart)
  })
}

function doesHourRuleCover(rule, hStart, hEnd, tz) {
  const s = moment.tz(hStart, tz)
  const e = moment.tz(hEnd, tz)
  const dayAnchor = s.clone().startOf('day')
  const rStart = dayAnchor.clone().hour(parseInt(rule.startHour, 10))
  const rEnd = dayAnchor.clone().hour(parseInt(rule.endHour, 10))
  if (s.isBefore(rStart) || e.isAfter(rEnd)) return false
  if (isHourExcepted(rule.timeExceptions, hStart, hEnd, tz)) return false
  return true
}

function getHourRuleSlices(rule, viewStart, viewEnd, tz) {
  const slices = []
  let dayCursor = moment.tz(viewStart, tz).startOf('day')
  const dayEnd = moment.tz(viewEnd, tz).endOf('day')

  while (dayCursor.isSameOrBefore(dayEnd, 'day')) {
    for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
      const sliceStart = dayCursor.clone().hour(h)
      const sliceEnd = sliceStart.clone().add(1, 'hour')
      if (sliceEnd.isSameOrBefore(viewStart) || sliceStart.isSameOrAfter(viewEnd)) {
        continue
      }
      if (isHourExcepted(rule.timeExceptions, sliceStart.toDate(), sliceEnd.toDate(), tz)) {
        continue
      }
      slices.push([sliceStart.toDate(), sliceEnd.toDate()])
    }
    dayCursor.add(1, 'day').startOf('day')
  }
  return mergeSlices(slices)
}

function getDayBlockSlices(dayDoc, viewStart, viewEnd, tz) {
  if (!dayDoc?.daysOfWeek?.length) return []
  const slices = []
  let current = moment.tz(viewStart, tz).startOf('day')
  const limit = moment.tz(viewEnd, tz).endOf('day')

  while (current.isBefore(limit)) {
    const dayName = current.format('dddd')
    if (dayDoc.daysOfWeek.includes(dayName)) {
      for (let h = 0; h < 24; h++) {
        const sliceStart = current.clone().hour(h)
        const sliceEnd = sliceStart.clone().add(1, 'hour')
        if (sliceEnd.isSameOrBefore(viewStart) || sliceStart.isSameOrAfter(viewEnd)) {
          continue
        }
        if (isHourExcepted(dayDoc.timeExceptions, sliceStart.toDate(), sliceEnd.toDate(), tz)) {
          continue
        }
        slices.push([sliceStart.toDate(), sliceEnd.toDate()])
      }
    }
    current.add(1, 'day').startOf('day')
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

function buildAutoBlockAllEvents(autoBlockHours, autoBlockDaysDoc, viewStart, viewEnd, tz) {
  const events = []

  // Day-based auto blocks
  if (autoBlockDaysDoc) {
    const daySlices = getDayBlockSlices(autoBlockDaysDoc, viewStart, viewEnd, tz)
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

  // Hour-based auto blocks
  autoBlockHours.forEach((rule) => {
    const hourSlices = getHourRuleSlices(rule, viewStart, viewEnd, tz)
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

export default function Calendar({ chapelSlug }) {
  const { language, setLanguage } = useLanguage()
  const t = useTranslate()

  const [chapel, setChapel] = useState(null)
  const [calendarPassword, setCalendarPassword] = useState('')
  const [enteredPw, setEnteredPw] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data arrays
  const [events, setEvents] = useState([])
  const [blockedTimes, setBlockedTimes] = useState([])
  const [autoBlockHours, setAutoBlockHours] = useState([])
  const [autoBlockDays, setAutoBlockDays] = useState(null)
  const [pastBlockEvent, setPastBlockEvent] = useState(null)

  // UI state
  const calendarRef = useRef(null)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // We'll store the chapel's timezone or fallback
  const activeTZ = chapel?.timezone || TIMEZONE

  // ------------------------------------------------------------------
  // 1) Fetch reservations/blocks if user is "unlocked"
  //    define with empty deps => stable identity
  // ------------------------------------------------------------------
  const fetchUnlockedData = useCallback(async (chapelId) => {
    try {
      const [resData, blocksData, hourRules, daysDocs] = await Promise.all([
        client.fetch(
          `*[_type=="reservation" && chapel._ref == $chapelId]{_id, name, phone, start, end}`,
          { chapelId }
        ),
        client.fetch(
          `*[_type=="blocked" && chapel._ref == $chapelId]{_id, start, end}`,
          { chapelId }
        ),
        client.fetch(
          `*[_type=="autoBlockedHours" && chapel._ref == $chapelId]{
            _id,
            startHour,
            endHour,
            timeExceptions[]{ date, startHour, endHour }
          }`,
          { chapelId }
        ),
        client.fetch(
          `*[_type=="autoBlockedDays" && chapel._ref == $chapelId]{
            _id,
            daysOfWeek,
            timeExceptions[]{ date, startHour, endHour }
          }`,
          { chapelId }
        )
      ])

      setEvents(
        resData.map((r) => ({
          id: r._id,
          title: r.name,
          start: r.start,
          end: r.end
        }))
      )
      setBlockedTimes(
        blocksData.map((b) => ({
          _id: b._id,
          start: b.start,
          end: b.end
        }))
      )
      setAutoBlockHours(hourRules)
      if (daysDocs.length) {
        setAutoBlockDays(daysDocs[0])
      }
    } catch (err) {
      console.error('Error fetching "unlocked" data:', err)
    }
  }, []) // no dependencies => stable

  // ------------------------------------------------------------------
  // 2) Load the chapel doc (including .language) + password info
  //    includes fetchUnlockedData in deps
  // ------------------------------------------------------------------
  const fetchChapelDoc = useCallback(async () => {
    try {
      setLoading(true)
      if (!chapelSlug) {
        console.warn('No chapelSlug provided to Calendar')
        setLoading(false)
        return
      }

      const chapelDoc = await client.fetch(
        `*[_type == "chapel" && slug.current == $slug][0]{
          _id,
          name,
          nickname,
          timezone,
          language
        }`,
        { slug: chapelSlug }
      )
      if (!chapelDoc) {
        console.warn('No chapel found for slug:', chapelSlug)
        setLoading(false)
        return
      }

      setChapel(chapelDoc)
      if (chapelDoc.language) {
        setLanguage(chapelDoc.language)
      }

      const pwDoc = await client.fetch(
        `*[_type == "calendarPassword" && chapel._ref == $chapelId][0]{ password }`,
        { chapelId: chapelDoc._id }
      )
      const pw = pwDoc?.password || ''
      setCalendarPassword(pw)

      let unlocked = false
      if (!pw) {
        unlocked = true
      } else {
        const cachedPw = localStorage.getItem(`calendarUserPw-${chapelDoc._id}`)
        if (cachedPw && cachedPw === pw) {
          unlocked = true
        }
      }
      setIsUnlocked(unlocked)

      if (unlocked) {
        await fetchUnlockedData(chapelDoc._id)
      }
    } catch (err) {
      console.error('Error fetching chapel doc:', err)
    } finally {
      setLoading(false)
    }
  }, [chapelSlug, setLanguage, fetchUnlockedData])

  // 3) On mount, fetch chapel doc
  useEffect(() => {
    fetchChapelDoc()
  }, [fetchChapelDoc])

  // ------------------------------------------------------------------
  // 4) When user enters password manually
  // ------------------------------------------------------------------
  async function handleCheckPassword() {
    if (enteredPw === calendarPassword) {
      setIsUnlocked(true)
      if (chapel?._id) {
        localStorage.setItem(`calendarUserPw-${chapel._id}`, enteredPw)
        // fetch reservations/blocks now that user is unlocked
        await fetchUnlockedData(chapel._id)
      }
    } else {
      alert(
        t({
          en: 'Incorrect password',
          de: 'Falsches Passwort',
          es: 'Contraseña incorrecta',
          ar: 'كلمة المرور غير صحيحة'
        })
      )
      setEnteredPw('')
    }
  }

  // 5) Past-block overlay
  useEffect(() => {
    if (!isUnlocked) return
    function updatePastBlockEvent() {
      const now = moment.tz(activeTZ)
      const startOfRange = now.clone().subtract(7, 'days').startOf('day')
      setPastBlockEvent({
        id: 'past-block',
        start: startOfRange.toISOString(),
        end: now.toISOString(),
        display: 'background',
        color: '#ffcccc'
      })
    }
    updatePastBlockEvent()
    const interval = setInterval(updatePastBlockEvent, 60 * 1000)
    return () => clearInterval(interval)
  }, [activeTZ, isUnlocked])

  // ------------------------------------------------------------------
  // 6) Checks for manual/auto block + reservation
  // ------------------------------------------------------------------
  function isTimeBlockedByManual(start, end) {
    const s = moment.tz(start, activeTZ)
    const e = moment.tz(end, activeTZ)
    return blockedTimes.some((b) => {
      const bStart = moment.tz(b.start, activeTZ)
      const bEnd = moment.tz(b.end, activeTZ)
      return s.isBefore(bEnd) && e.isAfter(bStart)
    })
  }

  function isTimeBlockedByAuto(start, end) {
    if (autoBlockDays?.daysOfWeek?.length) {
      const dayName = moment.tz(start, activeTZ).format('dddd')
      if (autoBlockDays.daysOfWeek.includes(dayName)) {
        if (!isHourExcepted(autoBlockDays.timeExceptions, start, end, activeTZ)) {
          return true
        }
      }
    }
    return autoBlockHours.some((rule) =>
      doesHourRuleCover(rule, start, end, activeTZ)
    )
  }

  function isSlotReserved(slotStart, slotEnd) {
    const s = moment.tz(slotStart, activeTZ)
    const e = moment.tz(slotEnd, activeTZ)
    return events.some((evt) => {
      if (
        evt.id.startsWith('auto-') ||
        evt.id.startsWith('blocked-') ||
        evt.id === 'past-block'
      ) {
        return false
      }
      const evtStart = moment.tz(evt.start, activeTZ)
      const evtEnd = moment.tz(evt.end, activeTZ)
      return s.isBefore(evtEnd) && e.isAfter(evtStart)
    })
  }

  // 7) Calendar selection
  function handleSelect(info) {
    if (!isUnlocked) return
    const { startStr, endStr } = info
    const now = moment.tz(activeTZ)
    const slotStart = moment.tz(startStr, activeTZ)
    const slotEnd = moment.tz(endStr, activeTZ)

    // Must be exactly 1 hour
    const durationInMinutes = slotEnd.diff(slotStart, 'minutes')
    if (durationInMinutes !== 60) return

    if (slotStart.isBefore(now)) return
    if (isTimeBlockedByManual(startStr, endStr)) return
    if (isTimeBlockedByAuto(startStr, endStr)) return
    if (isSlotReserved(startStr, endStr)) return

    setSelectedInfo({ start: startStr, end: endStr })
    setModalIsOpen(true)
  }

  function formatSelectedTime() {
    if (!selectedInfo) return ''
    const calendarApi = calendarRef.current?.getApi()
    if (!calendarApi) return ''
    const startTxt = calendarApi.formatDate(selectedInfo.start, {
      timeZone: activeTZ,
      hour: 'numeric',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'long'
    })
    const endTxt = calendarApi.formatDate(selectedInfo.end, {
      timeZone: activeTZ,
      hour: 'numeric'
    })
    return `${startTxt} - ${endTxt}`
  }

  async function handleSubmit(e) {
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
      if (chapel?._id) {
        reservationDoc.chapel = { _ref: chapel._id, _type: 'reference' }
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
          es: 'No se pudo crear la reserva. Inténtalo de nuevo.',
          ar: 'حدث خطأ أثناء إنشاء الحجز. يرجى المحاولة مرة أخرى.'
        })
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // 8) FullCalendar events
  function loadEvents(fetchInfo, successCallback) {
    if (!isUnlocked) {
      successCallback([])
      return
    }
    const { start, end } = fetchInfo
    const loaded = []

    // 1) Real "reservations"
    events.forEach((evt) => {
      loaded.push({
        id: evt.id,
        title: evt.title,
        start: evt.start,
        end: evt.end,
        color: '#3788d8'
      })
    })

    // 2) Manually blocked times
    blockedTimes.forEach((b, i) => {
      loaded.push({
        id: `blocked-${b._id || i}`,
        start: b.start,
        end: b.end,
        display: 'background',
        color: '#ffcccc'
      })
    })

    // 3) Auto-block times
    const autoEvts = buildAutoBlockAllEvents(
      autoBlockHours,
      autoBlockDays,
      start,
      end,
      activeTZ
    )
    loaded.push(...autoEvts)

    // 4) Past-block overlay
    if (pastBlockEvent) {
      loaded.push(pastBlockEvent)
    }

    successCallback(loaded)
  }

  function selectAllow(selectInfo) {
    const now = moment.tz(activeTZ)
    const start = moment.tz(selectInfo.startStr, activeTZ)
    const end = moment.tz(selectInfo.endStr, activeTZ)

    // Must be exactly 60 minutes
    const durationInMinutes = end.diff(start, 'minutes')
    if (durationInMinutes !== 60) {
      return false
    }

    if (start.isBefore(now)) return false
    if (isTimeBlockedByManual(start, end)) return false
    if (isTimeBlockedByAuto(start, end)) return false
    if (isSlotReserved(start, end)) return false

    return true
  }

  // We'll constrain the calendar to a 7-day past window and 30 days in future
  const now = moment.tz(activeTZ)
  const validRangeStart = now.clone().subtract(7, 'days').startOf('day')
  const validRangeEnd = now.clone().add(30, 'days').endOf('day')

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <div
            style={{
              margin: '0 auto',
              width: '48px',
              height: '48px',
              border: '6px solid #e5e7eb',
              borderTop: '6px solid #6b21a8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ marginTop: '1rem', color: '#999' }}>
            {t({
              en: 'Loading...',
              de: 'Laden...',
              es: 'Cargando...',
              ar: 'جارٍ التحميل...'
            })}
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      {!isUnlocked ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>
            {chapel
              ? t({
                  en: `Enter password for chapel: ${chapel.name}`,
                  de: `Passwort für Kapelle ${chapel.name} eingeben`,
                  es: `Ingrese la contraseña para la capilla: ${chapel.name}`,
                  ar: `أدخل كلمة المرور للكنيسة: ${chapel.name}`
                })
              : t({
                  en: 'Enter Calendar Password',
                  de: 'Kalender-Passwort eingeben',
                  es: 'Ingrese la contraseña del calendario',
                  ar: 'أدخل كلمة مرور التقويم'
                })}
          </h2>
          <input
            type="password"
            value={enteredPw}
            onChange={(e) => setEnteredPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheckPassword()}
            style={{ padding: '8px', marginBottom: '1rem', width: '200px' }}
          />
          <br />
          <button onClick={handleCheckPassword}>
            {t({ en: 'Submit', de: 'Abschicken', es: 'Enviar', ar: 'إرسال' })}
          </button>
        </div>
      ) : (
        <>
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
          </div>

          <div className="sticky-connect">
            <div
              style={{
                fontSize: '1.15rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>
                {t({ en: 'Connect', de: 'Verbinden', es: 'Conectar', ar: 'تواصل' })}
              </span>
              <a
                href="https://instagram.com/legio.fidelis"
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
                <span style={{ fontSize: '1rem' }}>@Legio.Fidelis</span>
              </a>
            </div>
          </div>

          <FullCalendar
            ref={calendarRef}
            locales={allLocales}
            slotLabelFormat={(dateInfo) => moment(dateInfo.date).format('h A')}
            plugins={[
              timeGridPlugin,
              scrollGridPlugin,
              interactionPlugin,
              momentPlugin,
              momentTimezonePlugin
            ]}
            locale={
              language === 'ar'
                ? 'ar'
                : language === 'de'
                ? 'de'
                : language === 'es'
                ? 'es'
                : 'en'
            }
            timeZone={activeTZ}
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
            selectAllow={selectAllow}
            select={handleSelect}
            validRange={{
              start: validRangeStart.format(),
              end: validRangeEnd.format()
            }}
            events={loadEvents}
            allDaySlot={false}
            slotDuration="01:00:00"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            headerToolbar={{
              left: 'prev,next',
              center: 'title',
              right: ''
            }}
            eventClassNames={(arg) => {
              if (arg.event.display === 'background') {
                return ['cursor-not-allowed']
              }
              return []
            }}
            eventContent={(arg) => {
              if (
                arg.event.id.startsWith('blocked-') ||
                arg.event.id.startsWith('auto-') ||
                arg.event.id === 'past-block'
              ) {
                return null
              }
              return <div>{arg.event.title}</div>
            }}
            height="auto"
          />

          <Modal
            isOpen={modalIsOpen}
            onRequestClose={() => {
              setModalIsOpen(false)
              setIsSubmitting(false)
            }}
            contentLabel={t({
              en: 'Reservation Form',
              de: 'Reservierungsformular',
              es: 'Formulario de Reserva',
              ar: 'نموذج الحجز'
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
                es: 'Reservar un intervalo de tiempo',
                ar: 'احجز فترة زمنية'
              })}
            </h2>
            <p style={{ marginBottom: '15px', fontStyle: 'italic' }}>
              {selectedInfo ? formatSelectedTime() : ''}
            </p>
            <form onSubmit={handleSubmit}>
              <label>
                {t({ en: 'Name:', de: 'Name:', es: 'Nombre:', ar: 'الاسم:' })}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ width: '100%', marginBottom: '10px', padding: '6px' }}
              />

              <label>
                {t({ en: 'Phone:', de: 'Telefon:', es: 'Teléfono:', ar: 'الهاتف:' })}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                        es: 'Reservando...',
                        ar: 'جاري الحجز...'
                      })
                    : t({
                        en: 'Reserve',
                        de: 'Reservieren',
                        es: 'Reservar',
                        ar: 'احجز'
                      })}
                </button>
                <button type="button" onClick={() => setModalIsOpen(false)}>
                  {t({ en: 'Cancel', de: 'Abbrechen', es: 'Cancelar', ar: 'إلغاء' })}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </>
  )
}
