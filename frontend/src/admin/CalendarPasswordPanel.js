// CalendarPasswordPanel.js
import React, { useState } from 'react'
import useTranslate from '../useTranslate' // adjust this import if needed

export default function CalendarPasswordPanel({
  currentCalendarPassword,
  onSavePassword,
  onRemovePassword
}) {
  const t = useTranslate()

  const [panelOpen, setPanelOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  function handleClickSave() {
    if (!newPassword.trim()) {
      alert(
        t({
          en: 'Please enter a new password.',
          de: 'Bitte geben Sie ein neues Passwort ein.',
          es: 'Por favor ingrese una nueva contraseña.'
        })
      )
      return
    }
    onSavePassword(newPassword)
    setNewPassword('')
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto 1.5rem auto',
        border: '1px solid #ccc',
        borderRadius: '8px',
        background: '#fff'
      }}
    >
      {/* Collapsible header */}
      <div
        onClick={() => setPanelOpen(!panelOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '0.75rem 1rem',
          borderBottom: panelOpen ? '1px solid #ccc' : 'none'
        }}
      >
        <strong>
          {t({
            en: 'Calendar Password',
            de: 'Kalenderpasswort',
            es: 'Contraseña del Calendario'
          })}
        </strong>
        <span>
          {panelOpen
            ? t({ en: '▲ Hide', de: '▲ Verbergen', es: '▲ Ocultar' })
            : t({ en: '▼ Show', de: '▼ Anzeigen', es: '▼ Mostrar' })}
        </span>
      </div>

      {panelOpen && (
        <div style={{ padding: '0.75rem 1rem' }}>
          {/* 1) Current Password */}
          <p style={{ margin: '0.5rem 0' }}>
            <strong>
              {t({
                en: 'Current Password:',
                de: 'Aktuelles Passwort:',
                es: 'Contraseña Actual:'
              })}
            </strong>{' '}
            {currentCalendarPassword ? (
              currentCalendarPassword
            ) : (
              <em>
                {t({
                  en: '(none)',
                  de: '(kein)',
                  es: '(ninguna)'
                })}
              </em>
            )}
          </p>

          {/* 2) New Password Input */}
          <div style={{ margin: '0.75rem 0' }}>
            <label style={{ marginRight: '0.5rem' }}>
              {t({
                en: 'Set New Password:',
                de: 'Neues Passwort setzen:',
                es: 'Establecer nueva contraseña:'
              })}
            </label>
            <input
              type="text"
              placeholder={t({
                en: '(enter new password)',
                de: '(neues Passwort eingeben)',
                es: '(ingresar nueva contraseña)'
              })}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                borderRadius: '6px',
                padding: '5px',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* 3) Buttons: Save & Remove */}
          <div style={{ marginTop: '0.5rem' }}>
            <button
              className="modern-button"
              onClick={handleClickSave}
              style={{ marginRight: '0.4rem' }}
            >
              {t({ en: 'Save', de: 'Speichern', es: 'Guardar' })}
            </button>

            {currentCalendarPassword && (
              <button
                className="modern-button modern-button--danger"
                onClick={onRemovePassword}
              >
                {t({ en: 'Remove', de: 'Entfernen', es: 'Eliminar' })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
