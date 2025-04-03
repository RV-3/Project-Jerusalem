// LanguageDropdown.js
import React, { useState } from 'react'
import { useLanguage } from './LanguageContext'

// Optional: actual flag images
// import enFlag from './assets/en.png'
// import deFlag from './assets/de.png'
// import esFlag from './assets/es.png'

// Using emojis for demonstration:
const enFlag = '🇬🇧' // or '🇺🇸'
const deFlag = '🇩🇪'
const esFlag = '🇪🇸'

export default function LanguageDropdown() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)

  // Now we have three languages: en, de, es
  const options = [
    { code: 'en', label: 'English', flag: enFlag },
    { code: 'de', label: 'Deutsch', flag: deFlag },
    { code: 'es', label: 'Español', flag: esFlag }
  ]

  // Figure out which one is currently set
  const currentOption = options.find(opt => opt.code === language) || options[0]

  function handleToggle() {
    setOpen(!open)
  }

  function handleSelect(code) {
    setLanguage(code)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* The main button */}
      <button
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid #ccc',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          background: '#fff'
        }}
      >
        <span style={{ marginRight: '0.5rem', fontSize: '1.25rem' }}>
          {currentOption.flag}
        </span>
        {currentOption.label}
        <span style={{ marginLeft: '0.5rem' }}>▼</span>
      </button>

      {/* The dropdown menu */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '0.25rem',
            minWidth: '140px',
            zIndex: 9999
          }}
        >
          {options.map(opt => (
            <div
              key={opt.code}
              onClick={() => handleSelect(opt.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                background: opt.code === language ? '#eee' : '#fff'
              }}
            >
              <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>
                {opt.flag}
              </span>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
