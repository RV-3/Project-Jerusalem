import React, { useState, useEffect } from 'react'
import { useLanguage } from './LanguageContext'
import sanityClient from '@sanity/client'

// ---------------------------------------------------------------------------------
//  REPLACE THESE WITH YOUR ACTUAL SANITY CONFIG
// ---------------------------------------------------------------------------------
const client = sanityClient({
  projectId: 'gt19q25e', // 1) Must match your actual Sanity project ID
  dataset: 'production', // 2) Must match the dataset that has your chapel docs
  apiVersion: '2023-01-01', // 3) An ISO date (today or a recent date)
  token: 'skLXmnuhIUZNJQF7cGeN77COiIcZRnyj7ssiWNzdveN3S0cZF6LTw0uvznBO4l2VoolGM5nSVPYnw13YZtrBDEohI3fJWa49gWWMp0fyOX5tP1hxp7qrR9zDHxZoivk0n7yUa7pcxqsGvzJ0Z2bKVbl29i3QuaIBtHoOqGxiN0SvUwgvO9W8',
  useCdn: false
})

// Simple emoji flags (you can use images if you prefer)
const enFlag = '🇬🇧'
const deFlag = '🇩🇪'
const esFlag = '🇪🇸'
const arFlag = '🇸🇦'

/**
 * LanguageDropdown
 * @param {Object} props
 * @param {string} props.chapelId - The Sanity document ID for the "chapel" you want to update
 */
export default function LanguageDropdown({ chapelId }) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)

  // List of possible languages
  const options = [
    { code: 'en', label: 'English', flag: enFlag },
    { code: 'de', label: 'Deutsch', flag: deFlag },
    { code: 'es', label: 'Español', flag: esFlag },
    { code: 'ar', label: 'العربية', flag: arFlag }
  ]

  // Current selection from our context
  const currentOption = options.find((opt) => opt.code === language) || options[0]

  function handleToggle() {
    setOpen(!open)
  }

  // ---------------------------------------------------------------------------------
  //  STEP 2: Attempt to update or create the doc
  // ---------------------------------------------------------------------------------
  async function handleSelect(newCode) {
    // 1) Update the local React context
    setLanguage(newCode)
    setOpen(false)

    if (!chapelId) {
      console.error('No chapelId provided! The patch cannot proceed.')
      return
    }

    console.log(`\n[LanguageDropdown] - Attempting to update doc: ${chapelId}`)
    console.log(`[LanguageDropdown] - Setting language = "${newCode}"\n`)

    try {
      // 2) Check if the doc with chapelId actually exists
      const existingDoc = await client.getDocument(chapelId)

      if (!existingDoc) {
        console.warn(
          `[LanguageDropdown] - Document with _id "${chapelId}" does NOT exist in the "production" dataset.
           Creating a new doc with _type "chapel"...`
        )
        // If the doc doesn't exist, we create it
        const created = await client.createIfNotExists({
          _id: chapelId,
          _type: 'chapel',
          name: 'New Chapel', // minimal required field if you have validations
          language: newCode
        })
        console.log('[LanguageDropdown] - Created doc:', created)
      } else {
        // 3) The doc exists. Patch it to update the `language` field
        const updatedDoc = await client
          .patch(chapelId)
          .set({ language: newCode })
          .commit()

        console.log('[LanguageDropdown] - Patched existing doc:', updatedDoc)
      }
    } catch (error) {
      console.error('Failed to update or create chapel doc:', error)
    }
  }

  // ---------------------------------------------------------------------------------
  //  STEP 3: Additional debug: log chapelId whenever it changes
  // ---------------------------------------------------------------------------------
  useEffect(() => {
    console.log('[LanguageDropdown] chapelId prop changed =>', chapelId)
  }, [chapelId])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
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
          {options.map((opt) => (
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
