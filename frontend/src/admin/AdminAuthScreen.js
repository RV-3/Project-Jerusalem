import React, { useState } from 'react'
import useTranslate from '../useTranslate'          // adjust path if needed

// You can keep this local, or pass it in as a prop:
const ADMIN_PASSWORD = 'admin123'

export default function AdminAuthScreen({ onSuccess }) {
  const t = useTranslate()
  const [inputVal, setInputVal] = useState('')

  // When user hits Enter or clicks the button:
  function attemptAdminLogin(val) {
    if (val === ADMIN_PASSWORD) {
      localStorage.setItem('isAdmin', 'true')
      onSuccess(true)  // Tells parent “we’re authenticated”
    } else {
      alert(
        t({
          en: 'Incorrect password',
          de: 'Falsches Passwort',
          es: 'Contraseña incorrecta',
        })
      )
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#fff',
        padding: '1rem',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        {t({
          en: 'Enter Admin Password',
          de: 'Admin-Passwort eingeben',
          es: 'Ingrese la contraseña de administrador',
        })}
      </h2>


      <input
        type="password"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            attemptAdminLogin(e.target.value)
          }
        }}
        placeholder={t({
          en: 'Admin password',
          de: 'Admin-Passwort',
          es: 'Contraseña de administrador',
        })}
        style={{
          width: '100%',
          maxWidth: '300px',
          padding: '12px',
          fontSize: '1rem',
          marginBottom: '1rem',
          border: '1px solid #ccc',
          borderRadius: '5px',
        }}
      />
      <button
        className="modern-button"
        onClick={() => attemptAdminLogin(inputVal)}
      >
        {t({ en: 'Submit', de: 'Abschicken', es: 'Enviar' })}
      </button>

      {/* You can keep your “modern-button” style here */}
      <style>{`
        .modern-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            #2A2A2A 0%,
            #1D1D1D 100%
          );
          color: #fff;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.3s ease, transform 0.2s ease;
          box-shadow: 0 4px 8px rgba(0,0,0,0.25);
        }
        .modern-button:hover {
          background: linear-gradient(
            135deg,
            #343434 0%,
            #232323 100%
          );
          transform: scale(1.02);
        }
        .modern-button:active {
          transform: scale(0.98);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .modern-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
