import React, { useState } from 'react'
import useTranslate from '../useTranslate' // adjust path if needed

export default function CalendarPasswordPanel({
  chapelId,
  existingPasswordDocId,
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
          es: 'Por favor ingrese una nueva contraseña.',
          ar: 'الرجاء إدخال كلمة مرور جديدة.'
        })
      )
      return
    }
    // Pass chapelId and docId so parent can do createOrReplace:
    onSavePassword(newPassword, chapelId, existingPasswordDocId)
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
            es: 'Contraseña del Calendario',
            ar: 'كلمة مرور التقويم'
          })}
        </strong>
        <span>
          {panelOpen
            ? t({
                en: '▲ Hide',
                de: '▲ Verbergen',
                es: '▲ Ocultar',
                ar: '▲ إخفاء'
              })
            : t({
                en: '▼ Show',
                de: '▼ Anzeigen',
                es: '▼ Mostrar',
                ar: '▼ إظهار'
              })}
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
                es: 'Contraseña Actual:',
                ar: 'كلمة المرور الحالية:'
              })}
            </strong>{' '}
            {currentCalendarPassword ? (
              currentCalendarPassword
            ) : (
              <em>
                {t({
                  en: '(none)',
                  de: '(kein)',
                  es: '(ninguna)',
                  ar: '(لا يوجد)'
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
                es: 'Establecer nueva contraseña:',
                ar: 'تعيين كلمة مرور جديدة:'
              })}
            </label>
            <input
              type="text"
              placeholder={t({
                en: '(enter new password)',
                de: '(neues Passwort eingeben)',
                es: '(ingresar nueva contraseña)',
                ar: '(أدخل كلمة مرور جديدة)'
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
              {t({
                en: 'Save',
                de: 'Speichern',
                es: 'Guardar',
                ar: 'حفظ'
              })}
            </button>

            {currentCalendarPassword && (
              <button
                className="modern-button modern-button--danger"
                onClick={() => onRemovePassword(chapelId, existingPasswordDocId)}
              >
                {t({
                  en: 'Remove',
                  de: 'Entfernen',
                  es: 'Eliminar',
                  ar: 'إزالة'
                })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
