// LanguageDropdown.js
import React, { useState } from 'react'
import { useLanguage } from './LanguageContext'

// If you have actual flag images in /assets/ or similar, import them:
// import enFlag from './assets/en.png'
// import deFlag from './assets/de.png'

// If you don't have image files, we can just use emojis for demonstration:
const enFlag = '🇬🇧'  // or use '🇺🇸' if you prefer
const deFlag = '🇩🇪'

export default function LanguageDropdown() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)

  // Our two languages
  const options = [
    { code: 'en', label: 'English', flag: enFlag },
    { code: 'de', label: 'Deutsch', flag: deFlag }
  ]

  // Figure out which one is "current"
  const currentOption = options.find(opt => opt.code === language) || options[0]

  // Toggle the dropdown
  function handleToggle() {
    setOpen(!open)
  }

  // When clicking an item, set language & close
  function handleSelect(code) {
    setLanguage(code)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* The "main button" */}
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
        {/* If you have an actual image, use <img src={currentOption.flag} /> */}
        <span style={{ marginRight: '0.5rem', fontSize: '1.25rem' }}>
          {currentOption.flag}
        </span>
        {currentOption.label}
        {/* A small down arrow: */}
        <span style={{ marginLeft: '0.5rem' }}>▼</span>
      </button>

      {/* The dropdown menu, visible if "open" === true */}
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
