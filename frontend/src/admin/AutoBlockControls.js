// AutoBlockControls.js
import React, { useEffect, useState } from 'react'
import Modal from 'react-modal'
import moment from 'moment-timezone'
import client from '../utils/sanityClient.js'

// Import your language/translation hooks
import { useLanguage } from '../LanguageContext'
import useTranslate from '../useTranslate'

// ---------------------------------------------------------------------
// Constants & helper for converting 24-hour to 12-hour labels
// ---------------------------------------------------------------------
const HOUR_OPTIONS_12H = [
  { value: '0', label: '12 AM' },
  { value: '1', label: '1 AM' },
  { value: '2', label: '2 AM' },
  { value: '3', label: '3 AM' },
  { value: '4', label: '4 AM' },
  { value: '5', label: '5 AM' },
  { value: '6', label: '6 AM' },
  { value: '7', label: '7 AM' },
  { value: '8', label: '8 AM' },
  { value: '9', label: '9 AM' },
  { value: '10', label: '10 AM' },
  { value: '11', label: '11 AM' },
  { value: '12', label: '12 PM' },
  { value: '13', label: '1 PM' },
  { value: '14', label: '2 PM' },
  { value: '15', label: '3 PM' },
  { value: '16', label: '4 PM' },
  { value: '17', label: '5 PM' },
  { value: '18', label: '6 PM' },
  { value: '19', label: '7 PM' },
  { value: '20', label: '8 PM' },
  { value: '21', label: '9 PM' },
  { value: '22', label: '10 PM' },
  { value: '23', label: '11 PM' },
  { value: '24', label: '12 AM (next day)' }
]

function format24HourTo12(hourStr) {
  if (hourStr === '24') {
    return '12 AM (next day)'
  }
  const found = HOUR_OPTIONS_12H.find((opt) => opt.value === String(hourStr))
  return found ? found.label : `${hourStr}:00`
}

// ---------------------------------------------------------------------
// We keep doc keys in English (Sunday, Monday, etc.)
// but now show Spanish as well if language === "es".
// ---------------------------------------------------------------------
const DAY_TOGGLES = [
  {
    docKey: 'Sunday',
    labelEn: 'Sunday',
    labelDe: 'Sonntag',
    labelEs: 'Domingo',
    shortEn: 'Su',
    shortDe: 'So',
    shortEs: 'Do'
  },
  {
    docKey: 'Monday',
    labelEn: 'Monday',
    labelDe: 'Montag',
    labelEs: 'Lunes',
    shortEn: 'Mo',
    shortDe: 'Mo',
    shortEs: 'Lu'
  },
  {
    docKey: 'Tuesday',
    labelEn: 'Tuesday',
    labelDe: 'Dienstag',
    labelEs: 'Martes',
    shortEn: 'Tu',
    shortDe: 'Di',
    shortEs: 'Ma'
  },
  {
    docKey: 'Wednesday',
    labelEn: 'Wednesday',
    labelDe: 'Mittwoch',
    labelEs: 'Miércoles',
    shortEn: 'We',
    shortDe: 'Mi',
    shortEs: 'Mi'
  },
  {
    docKey: 'Thursday',
    labelEn: 'Thursday',
    labelDe: 'Donnerstag',
    labelEs: 'Jueves',
    shortEn: 'Th',
    shortDe: 'Do',
    shortEs: 'Ju'
  },
  {
    docKey: 'Friday',
    labelEn: 'Friday',
    labelDe: 'Freitag',
    labelEs: 'Viernes',
    shortEn: 'Fr',
    shortDe: 'Fr',
    shortEs: 'Vi'
  },
  {
    docKey: 'Saturday',
    labelEn: 'Saturday',
    labelDe: 'Samstag',
    labelEs: 'Sábado',
    shortEn: 'Sa',
    shortDe: 'Sa',
    shortEs: 'Sá'
  }
]

// ---------------------------------------------------------------------
// AUTO-BLOCK CONTROLS COMPONENT
// ---------------------------------------------------------------------
export function AutoBlockControls({
  autoBlockRules,
  setAutoBlockRules,
  autoBlockDays,
  setAutoBlockDays,
  reloadData
}) {
  // 1) Hooks for language & translation
  const { language } = useLanguage()
  const t = useTranslate()

  // Toggles for collapsing Hours/Days sections
  const [showHours, setShowHours] = useState(false)
  const [showDays, setShowDays] = useState(false)

  // Keep track of which days are blocked
  const [selectedDays, setSelectedDays] = useState([])

  useEffect(() => {
    if (autoBlockDays?.daysOfWeek) {
      setSelectedDays(autoBlockDays.daysOfWeek)
    } else {
      setSelectedDays([])
    }
  }, [autoBlockDays])

  // ---------------------------
  // HOURS LOGIC
  // ---------------------------
  const [startHour, setStartHour] = useState('')
  const [endHour, setEndHour] = useState('')
  const [hoverRemoveId, setHoverRemoveId] = useState(null)
  const [hoverAdd, setHoverAdd] = useState(false)

  useEffect(() => {
    // If endHour <= startHour, reset endHour
    if (startHour && endHour && parseInt(endHour, 10) <= parseInt(startHour, 10)) {
      setEndHour('')
    }
  }, [startHour, endHour])

  const filteredEndOptions = !startHour
    ? HOUR_OPTIONS_12H
    : HOUR_OPTIONS_12H.filter(
        (opt) => parseInt(opt.value, 10) > parseInt(startHour, 10)
      )

  const isAddDisabled = !startHour || !endHour

  async function handleAddRule() {
    if (isAddDisabled) return
    try {
      const doc = {
        _type: 'autoBlockedHours',
        startHour,
        endHour,
        timeExceptions: []
      }
      const created = await client.create(doc)
      setAutoBlockRules((prev) => [...prev, created])
      setStartHour('')
      setEndHour('')
      reloadData()
    } catch (err) {
      console.error('Error adding auto-block rule:', err)
      alert(
        t({
          en: 'Error adding auto-block rule. Check console.',
          de: 'Fehler beim Hinzufügen einer automatischen Blockierungsregel. Siehe Konsole.',
          es: 'Error al agregar la regla de bloqueo automático. Revise la consola.'
        })
      )
    }
  }

  async function handleRemoveRule(id) {
    try {
      await client.delete(id)
      setAutoBlockRules(autoBlockRules.filter((r) => r._id !== id))
      reloadData()
    } catch (err) {
      console.error('Error removing auto-block rule:', err)
      alert(
        t({
          en: 'Error removing auto-block rule. Check console.',
          de: 'Fehler beim Entfernen einer automatischen Blockierungsregel. Siehe Konsole.',
          es: 'Error al eliminar la regla de bloqueo automático. Revise la consola.'
        })
      )
    }
  }

  // ---------------------------
  // DAYS LOGIC
  // ---------------------------
  const [daysModalOpen, setDaysModalOpen] = useState(false)

  // Remove a single day => immediate doc update
  async function removeDay(dayFull) {
    const newArr = selectedDays.filter((d) => d !== dayFull)
    await saveDaysToSanity(newArr)
  }

  // Toggling inside the modal
  function toggleDay(dayFull) {
    setSelectedDays((prev) =>
      prev.includes(dayFull)
        ? prev.filter((d) => d !== dayFull)
        : [...prev, dayFull]
    )
  }

  // On "Save" in the modal
  async function handleSaveDaysModal() {
    // Detect newly added days => remove matching timeExceptions
    const oldDays = autoBlockDays?.daysOfWeek || []
    const newlyAddedDays = selectedDays.filter((d) => !oldDays.includes(d))

    await saveDaysToSanity(selectedDays, newlyAddedDays)
    alert(
      t({
        en: 'Blocked days saved.',
        de: 'Blockierte Tage gespeichert.',
        es: 'Días bloqueados guardados.'
      })
    )
    setDaysModalOpen(false)
  }

  // Save doc to Sanity
  async function saveDaysToSanity(daysArr, newlyAddedDays = []) {
    try {
      const docId = autoBlockDays?._id || 'autoBlockedDaysSingleton'
      const docToSave = {
        _id: docId,
        _type: 'autoBlockedDays',
        daysOfWeek: daysArr,
        timeExceptions: autoBlockDays?.timeExceptions || []
      }

      // Remove any timeExceptions that match newly added days
      if (newlyAddedDays.length && docToSave.timeExceptions?.length) {
        const filteredEx = docToSave.timeExceptions.filter((ex) => {
          if (!ex.date) return true
          const exDayName = moment.tz(ex.date, 'Asia/Jerusalem').format('dddd')
          // if it's a newly added day, remove that exception
          if (newlyAddedDays.includes(exDayName)) {
            return false
          }
          return true
        })
        docToSave.timeExceptions = filteredEx
      }

      await client.createOrReplace(docToSave)
      reloadData()
    } catch (err) {
      console.error('Error saving day-block doc:', err)
      alert(
        t({
          en: 'Could not save blocked days. See console.',
          de: 'Blockierte Tage konnten nicht gespeichert werden. Siehe Konsole.',
          es: 'No se pudieron guardar los días bloqueados. Ver consola.'
        })
      )
    }
  }

  // ---------------------------
  // STYLES
  // ---------------------------
  const containerStyle = {
    margin: '1rem auto',
    padding: '1rem',
    border: '2px solid #eee',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
    maxWidth: '600px',
    fontSize: '1.2rem'
  }

  const toggleHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '0.5rem 0',
    fontSize: '1.3rem',
    fontWeight: 'bold'
  }

  const listItemStyle = {
    marginBottom: '0.8rem',
    padding: '0.8rem',
    borderRadius: '6px',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    columnGap: '1rem'
  }

  const removeBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #000',
    borderRadius: '9999px',
    padding: '0.5px 10px',
    fontSize: '1rem',
    cursor: 'pointer',
    background: '#eeeeee',
    color: '#000000',
    transition: 'background 0.3s, color 0.3s, border-color 0.3s'
  }
  const removeBtnHover = {
    background: '#333',
    color: '#fff'
  }

  const xIconStyle = {
    marginLeft: '5px',
    fontWeight: 'normal',
    fontSize: '2rem'
  }

  const addBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    borderRadius: '9999px',
    padding: '8px 16px',
    fontSize: '1rem',
    cursor: 'pointer',
    background: '#444',
    color: '#fff',
    transition: 'background 0.3s'
  }
  const addBtnHover = {
    background: '#222'
  }

  const selectStyle = {
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '1rem'
  }

  const chipStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    background: '#ddd',
    borderRadius: '4px',
    marginRight: '6px',
    fontSize: '1rem'
  }

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div style={containerStyle}>
      {/* ================= HOURS TOGGLE ================= */}
      <div style={toggleHeaderStyle} onClick={() => setShowHours((prev) => !prev)}>
        <span>
          {t({
            en: 'Auto-Block Hours',
            de: 'Automatische Stundenblockierung',
            es: 'Bloqueo automático por horas'
          })}
        </span>
        <span style={{ fontSize: '1rem' }}>
          {showHours
            ? `▲ ${t({ en: 'Hide', de: 'Ausblenden', es: 'Ocultar' })}`
            : `▼ ${t({ en: 'Show', de: 'Anzeigen', es: 'Mostrar' })}`}
        </span>
      </div>

      {showHours && (
        <div style={{ marginBottom: '2rem' }}>
          <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: '1rem' }}>
            {autoBlockRules.map((rule) => {
              const isHovering = hoverRemoveId === rule._id
              return (
                <li key={rule._id} style={listItemStyle}>
                  <span>
                    <strong>
                      {t({
                        en: 'Block:',
                        de: 'Blockieren:',
                        es: 'Bloquear:'
                      })}
                    </strong>{' '}
                    {format24HourTo12(rule.startHour)} – {format24HourTo12(rule.endHour)}
                  </span>
                  <button
                    onClick={() => handleRemoveRule(rule._id)}
                    onMouseEnter={() => setHoverRemoveId(rule._id)}
                    onMouseLeave={() => setHoverRemoveId(null)}
                    style={{
                      ...removeBtnBase,
                      ...(isHovering ? removeBtnHover : {})
                    }}
                  >
                    {t({
                      en: 'Remove',
                      de: 'Entfernen',
                      es: 'Eliminar'
                    })}
                    <span style={xIconStyle}>×</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div
            style={{
              display: 'flex',
              gap: '0.8rem',
              flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}
          >
            <div>
              <label
                style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}
              >
                {t({
                  en: 'Start Hour:',
                  de: 'Startstunde:',
                  es: 'Hora de inicio:'
                })}
              </label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                style={selectStyle}
              >
                <option value="">
                  {t({ en: '-- Start --', de: '-- Start --', es: '-- Inicio --' })}
                </option>
                {HOUR_OPTIONS_12H.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}
              >
                {t({
                  en: 'End Hour:',
                  de: 'Endstunde:',
                  es: 'Hora de fin:'
                })}
              </label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                style={selectStyle}
              >
                <option value="">
                  {t({ en: '-- End --', de: '-- Ende --', es: '-- Fin --' })}
                </option>
                {filteredEndOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={handleAddRule}
                onMouseEnter={() => setHoverAdd(true)}
                onMouseLeave={() => setHoverAdd(false)}
                style={{
                  ...addBtnBase,
                  ...(hoverAdd ? addBtnHover : {}),
                  // Disable effect visually if invalid
                  cursor: isAddDisabled ? 'default' : 'pointer',
                  background: isAddDisabled ? '#999' : addBtnBase.background
                }}
                disabled={isAddDisabled}
              >
                {t({
                  en: 'Add Rule',
                  de: 'Regel hinzufügen',
                  es: 'Agregar regla'
                })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DAYS TOGGLE ================= */}
      <div style={toggleHeaderStyle} onClick={() => setShowDays((prev) => !prev)}>
        <span>
          {t({
            en: 'Auto-Block Days',
            de: 'Automatische Tagesblockierung',
            es: 'Bloqueo automático de días'
          })}
        </span>
        <span style={{ fontSize: '1rem' }}>
          {showDays
            ? `▲ ${t({ en: 'Hide', de: 'Ausblenden', es: 'Ocultar' })}`
            : `▼ ${t({ en: 'Show', de: 'Anzeigen', es: 'Mostrar' })}`}
        </span>
      </div>

      {showDays && (
        <div>
          {/* Show existing days as chips */}
          <div style={{ margin: '0.5rem 0' }}>
            {!autoBlockDays?.daysOfWeek || autoBlockDays.daysOfWeek.length === 0 ? (
              <em>
                {t({
                  en: 'No days blocked',
                  de: 'Keine Tage blockiert',
                  es: 'Ningún día bloqueado'
                })}
              </em>
            ) : (
              autoBlockDays.daysOfWeek.map((day) => {
                // find matching day object
                const toggleObj = DAY_TOGGLES.find((x) => x.docKey === day)
                // label for the chip
                let shortLabel = day
                if (toggleObj) {
                  if (language === 'de') shortLabel = toggleObj.shortDe
                  else if (language === 'es') shortLabel = toggleObj.shortEs
                  else shortLabel = toggleObj.shortEn
                }

                return (
                  <span key={day} style={chipStyle}>
                    {shortLabel}
                    <button
                      onClick={() => removeDay(day)}
                      style={{
                        marginLeft: '6px',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1rem'
                      }}
                    >
                      ×
                    </button>
                  </span>
                )
              })
            )}
          </div>

          {/* Button => opens modal with toggles */}
          <button
            onClick={() => setDaysModalOpen(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '1px solid #555',
              backgroundColor: '#eee',
              cursor: 'pointer'
            }}
          >
            {t({
              en: 'Block Days',
              de: 'Tage blockieren',
              es: 'Bloquear días'
            })}
          </button>

          <Modal
            isOpen={daysModalOpen}
            onRequestClose={() => setDaysModalOpen(false)}
            contentLabel={t({
              en: 'Block Days Modal',
              de: 'Tage blockieren Modal',
              es: 'Modal para bloquear días'
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
            <h3 style={{ marginBottom: '1rem' }}>
              {t({
                en: 'Select which days to block',
                de: 'Wählen Sie, welche Tage blockiert werden sollen',
                es: 'Seleccione qué días bloquear'
              })}
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}
            >
              {DAY_TOGGLES.map(({ docKey, shortEn, shortDe, shortEs }) => {
                const active = selectedDays.includes(docKey)
                let shortLabel = shortEn
                if (language === 'de') shortLabel = shortDe
                else if (language === 'es') shortLabel = shortEs

                return (
                  <button
                    key={docKey}
                    onClick={() => toggleDay(docKey)}
                    style={{
                      minWidth: '45px',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #444',
                      background: active ? '#444' : '#fff',
                      color: active ? '#fff' : '#444',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    {shortLabel}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={handleSaveDaysModal}
                style={{
                  backgroundColor: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                {t({ en: 'Save', de: 'Speichern', es: 'Guardar' })}
              </button>
              <button
                onClick={() => setDaysModalOpen(false)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                {t({ en: 'Cancel', de: 'Abbrechen', es: 'Cancelar' })}
              </button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}
