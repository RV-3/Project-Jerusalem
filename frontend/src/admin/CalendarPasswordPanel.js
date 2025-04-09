// CalendarPasswordPanel.js
import React, { useState } from 'react'
import useTranslate from '../useTranslate' // adjust path to your useTranslate
// (If you need language context or other hooks, import them too)

export default function CalendarPasswordPanel({
  currentCalendarPassword,   // (string) from parent
  onSavePassword,            // (function) parent-supplied logic to save
  onRemovePassword           // (function) parent-supplied logic to remove
}) {
  const t = useTranslate()
  const [panelOpen, setPanelOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // When saving a new password, we call parent prop onSavePassword
  // and pass the newPassword. Parent handles the actual createOrReplace logic.
  function handleClickSave() {
    if (!newPassword.trim()) {
      alert(t({ en: 'Please enter a password', de: 'Bitte ein Passwort eingeben', es: 'Ingrese una contraseña' }))
      return
    }
    onSavePassword(newPassword)
    setNewPassword('')
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto 1.5rem auto',
        border: '1px solid #ccc',
        borderRadius: '8px',
        background: '#fff'
      }}
    >
      {/* Clickable header */}
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
        <strong>Calendar Password Options</strong>
        <span>
          {panelOpen ? '▲ Hide' : '▼ Show'}
        </span>
      </div>

      {panelOpen && (
        <div style={{ padding: '0.75rem 1rem' }}>
          {/* 1) Display the current password or (none) */}
          <p style={{ margin: '0.5rem 0' }}>
            <strong>Current Password:</strong>{' '}
            {currentCalendarPassword ? currentCalendarPassword : <em>(none)</em>}
          </p>

          {/* 2) Input for new password */}
          <div style={{ margin: '0.75rem 0' }}>
            <label style={{ marginRight: '0.5rem' }}>
              {t({ en: 'Set New Password:', de: 'Neues Passwort eingeben:', es: 'Ingrese nueva contraseña:' })}
            </label>
            <input
              type="text"
              placeholder={t({ en: '(enter new password)', de: '(Neues Passwort)', es: '(ingrese nueva contraseña)' })}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                borderRadius: '6px',
                padding: '5px',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* 3) Save & Remove buttons */}
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
