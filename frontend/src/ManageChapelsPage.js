import React, { useEffect, useState, useCallback } from 'react'
import client from './utils/sanityClient.js'
import { useNavigate } from 'react-router-dom'

// A small set of common IANA timezones you can expand:
const TIMEZONE_OPTIONS = [
  'Europe/Vienna',
  'Asia/Jerusalem',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Pacific/Honolulu',
  'UTC'
]

/**
 * Helper to build the correct link for each chapel:
 *
 * - If the current domain is exactly "legiofidelis.org" or "www.legiofidelis.org",
 *   return "https://CHAPEL.legiofidelis.org[/admin]"
 * - Otherwise, fallback to "/CHAPEL[/admin]".
 */
function getChapelLink(chapelSlug, { admin = false } = {}) {
  const hostname = window.location.hostname
  const parts = hostname.split('.')

  // If exactly "legiofidelis.org" or "www.legiofidelis.org" => subdomain approach
  if (
    hostname.endsWith('legiofidelis.org') &&
    (parts.length === 2 || (parts.length === 3 && parts[0] === 'www'))
  ) {
    // e.g. "jerusalem.legiofidelis.org" or "jerusalem.legiofidelis.org/admin"
    const base = `https://${chapelSlug}.legiofidelis.org`
    return admin ? `${base}/admin` : base
  }

  // Fallback: path-based link, e.g. "/jerusalem" or "/jerusalem/admin"
  return admin ? `/${chapelSlug}/admin` : `/${chapelSlug}`
}

export default function ManageChapelsPage() {
  const [chapels, setChapels] = useState([])
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // For editing existing chapels
  const [editingChapelId, setEditingChapelId] = useState(null)
  const [editNickname, setEditNickname] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editImageFile, setEditImageFile] = useState(null)

  // Lat/lng fields
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')

  // City field
  const [editCity, setEditCity] = useState('')

  // Google Maps link field
  const [editGoogleMapsLink, setEditGoogleMapsLink] = useState('')

  // NEW: Filter text
  const [filterText, setFilterText] = useState('')

  // 1) Fetch chapels
  const fetchChapels = useCallback(async () => {
    try {
      setLoading(true)
      const data = await client.fetch(`
        *[_type == "chapel"]{
          _id,
          name,
          nickname,
          timezone,
          "slug": slug.current,
          description,
          whatsappNumber,
          chapelImage{
            asset->{
              _id,
              url
            }
          },
          location,
          city,
          googleMapsLink
        } | order(name asc)
      `)
      setChapels(data)
    } catch (err) {
      console.error('Error fetching chapels:', err)
      alert('Failed to load chapels from Sanity.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChapels()
  }, [fetchChapels])

  // 2) Create new chapel
  const handleCreateChapel = async (e) => {
    e.preventDefault()
    if (!name.trim() || !timezone.trim()) {
      alert('Please fill out both Name and Timezone.')
      return
    }
    try {
      setLoading(true)
      await client.create({
        _type: 'chapel',
        name,
        timezone,
        slug: {
          _type: 'slug',
          current: name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
        }
      })
      alert('Chapel created!')
      setName('')
      setTimezone('')
      fetchChapels()
    } catch (err) {
      console.error('Error creating chapel:', err)
      alert('Failed to create chapel. Check console.')
    } finally {
      setLoading(false)
    }
  }

  // 3) Start editing
  const startEditing = (chap) => {
    setEditingChapelId(chap._id)
    setEditNickname(chap.nickname || '')

    // Convert block array to text for the description
    let descText = ''
    if (chap.description && Array.isArray(chap.description)) {
      descText = chap.description
        .map((block) => {
          if (!block.children) return ''
          return block.children.map((span) => span.text).join('')
        })
        .join('\n\n')
    }
    setEditDescription(descText)
    setEditWhatsapp(chap.whatsappNumber || '')
    setEditImageFile(null)

    // Populate lat/lng
    setEditLat(chap.location?.lat?.toString() ?? '')
    setEditLng(chap.location?.lng?.toString() ?? '')

    // City
    setEditCity(chap.city || '')

    // Google Maps link
    setEditGoogleMapsLink(chap.googleMapsLink || '')
  }

  // 4) Cancel editing
  const cancelEditing = () => {
    setEditingChapelId(null)
    setEditNickname('')
    setEditDescription('')
    setEditWhatsapp('')
    setEditImageFile(null)
    setEditLat('')
    setEditLng('')
    setEditCity('')
    setEditGoogleMapsLink('')
  }

  // 5) Handle file input for image
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setEditImageFile(e.target.files[0])
    } else {
      setEditImageFile(null)
    }
  }

  // 6) Save changes (patch existing chapel doc)
  const handleSaveChanges = async (chapelId) => {
    try {
      setLoading(true)

      // Convert the description text to a single block array
      const blockArray = editDescription.trim()
        ? [
            {
              _type: 'block',
              children: [{ _type: 'span', text: editDescription, marks: [] }],
              markDefs: []
            }
          ]
        : []

      // Build the patch data
      const patchData = {
        nickname: editNickname,
        description: blockArray,
        whatsappNumber: editWhatsapp,
        city: editCity,
        googleMapsLink: editGoogleMapsLink
      }

      // If location fields are valid => parse floats => set on patchData
      const latVal = parseFloat(editLat)
      const lngVal = parseFloat(editLng)
      if (!isNaN(latVal) && !isNaN(lngVal)) {
        patchData.location = {
          _type: 'geopoint',
          lat: latVal,
          lng: lngVal
        }
      }
      // else skip or set location = null if you prefer

      // If user selected a new image file => upload => attach reference
      if (editImageFile) {
        const asset = await client.assets.upload('image', editImageFile, {
          filename: editImageFile.name
        })
        patchData.chapelImage = {
          _type: 'image',
          asset: {
            _type: 'reference',
            _ref: asset._id
          }
        }
      }

      // Patch the doc
      await client.patch(chapelId).set(patchData).commit()

      alert('Chapel updated!')
      cancelEditing()
      fetchChapels()
    } catch (err) {
      console.error('Error updating chapel:', err)
      alert('Failed to update chapel. Check console.')
    } finally {
      setLoading(false)
    }
  }

  // 7) Cascade-delete logic
  const handleDeleteChapel = async (chapelId) => {
    if (
      !window.confirm(
        'Delete this chapel AND any documents referencing it? This cannot be undone.'
      )
    ) {
      return
    }
    try {
      setLoading(true)

      const referencingDocs = await client.fetch(
        `*[references($chapelId)]{ _id }`,
        { chapelId }
      )

      let tx = client.transaction()
      referencingDocs.forEach((doc) => {
        tx = tx.delete(doc._id)
      })
      tx = tx.delete(chapelId)
      await tx.commit()

      alert('Chapel and all referencing documents deleted.')
      fetchChapels()
    } catch (err) {
      console.error('Error deleting chapel:', err)
      alert('Failed to delete chapel. Check console.')
    } finally {
      setLoading(false)
    }
  }

  // Utility: Navigate to either subdomain or path
  function goToChapel(chapelSlug, admin = false) {
    const chapelLink = getChapelLink(chapelSlug, { admin })
    if (chapelLink.startsWith('/')) {
      // It's a path-based link (dev/local environment, etc.)
      navigate(chapelLink)
    } else {
      // It's a subdomain link => full page reload
      window.location.href = chapelLink
    }
  }

  // NEW: Filtered chapels. If filterText is not empty, filter by name/nickname/city
  const filteredChapels = chapels.filter((chap) => {
    if (!filterText.trim()) return true // no filter => show all

    const text = filterText.toLowerCase()
    const name = chap.name?.toLowerCase() || ''
    const nickname = chap.nickname?.toLowerCase() || ''
    const city = chap.city?.toLowerCase() || ''

    // Return true if filterText found in name OR nickname OR city
    return (
      name.includes(text) ||
      nickname.includes(text) ||
      city.includes(text)
    )
  })

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Manage Chapels</h2>

      {/* Chapel creation form */}
      <form onSubmit={handleCreateChapel} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold' }}>
            Chapel Name:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            placeholder="e.g. Donaufeld Chapel"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold' }}>
            Timezone:
          </label>

          {/* 1) A dropdown with some common timezones */}
          <select
            value={TIMEZONE_OPTIONS.includes(timezone) ? timezone : ''}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '6px' }}
          >
            <option value="">-- Select a common timezone --</option>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>

          {/* 2) OR text input */}
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            placeholder="e.g. Europe/Vienna"
          />

          <small>
            <em>
              Use an official IANA timezone, e.g. <code>Europe/Vienna</code> or{' '}
              <code>America/New_York</code>.
            </em>
          </small>
        </div>

        <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Creating...' : 'Create Chapel'}
        </button>
      </form>

      {/* Existing Chapels - Filter Input */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
          Filter Chapels:
        </label>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
          placeholder="Type a name, nickname, or city..."
        />
      </div>

      <h3 style={{ marginBottom: '0.5rem' }}>Existing Chapels</h3>
      {loading && <p>Loading...</p>}
      {!loading && chapels.length === 0 && (
        <p style={{ fontStyle: 'italic' }}>No chapels found.</p>
      )}

      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {/* Now map over filteredChapels instead of chapels */}
        {filteredChapels.map((chap) => {
          const isEditing = editingChapelId === chap._id

          // Convert existing blocks to text for display
          let displayedDesc = ''
          if (chap.description && Array.isArray(chap.description)) {
            displayedDesc = chap.description
              .map(
                (block) =>
                  block.children?.map((span) => span.text).join('') || ''
              )
              .join('\n\n')
          }

          return (
            <li
              key={chap._id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '6px',
                marginBottom: '0.5rem',
                padding: '0.75rem'
              }}
            >
              <strong>Name: </strong> {chap.name}
              <br />
              {chap.nickname && (
                <>
                  <strong>Nickname: </strong> {chap.nickname}
                  <br />
                </>
              )}
              <strong>Timezone: </strong> {chap.timezone}
              <br />
              {chap.slug ? (
                <>
                  <strong>Slug URL: </strong> /{chap.slug}
                  <br />
                </>
              ) : (
                <em>(no slug)</em>
              )}
              {chap.city && (
                <>
                  <strong>City: </strong> {chap.city}
                  <br />
                </>
              )}

              {/* If there's an image, display thumbnail */}
              {chap.chapelImage?.asset?.url && (
                <div style={{ margin: '0.5rem 0' }}>
                  <img
                    src={chap.chapelImage.asset.url}
                    alt={chap.name}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
                  />
                </div>
              )}

              {/* Display existing fields if not editing */}
              {!isEditing && (
                <>
                  {displayedDesc && (
                    <>
                      <strong>Description:</strong>
                      <pre
                        style={{
                          background: '#f9f9f9',
                          padding: '0.5rem',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {displayedDesc}
                      </pre>
                    </>
                  )}
                  {chap.whatsappNumber && (
                    <>
                      <strong>WhatsApp: </strong> {chap.whatsappNumber}
                      <br />
                    </>
                  )}
                  {chap.location && (
                    <>
                      <strong>Location: </strong>
                      Lat {chap.location.lat}, Lng {chap.location.lng}
                      <br />
                    </>
                  )}
                  {chap.googleMapsLink && (
                    <>
                      <strong>Google Maps Link:</strong>{' '}
                      <a
                        href={chap.googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {chap.googleMapsLink}
                      </a>
                      <br />
                    </>
                  )}
                </>
              )}

              {/* Action Buttons */}
              <div style={{ marginTop: '0.5rem' }}>
                {/* "Visit Public Calendar" => subdomain or fallback path */}
                <button
                  onClick={() => goToChapel(chap.slug, false)}
                  style={{ marginRight: '1rem' }}
                >
                  Visit Public Calendar
                </button>
                <button
                  onClick={() => goToChapel(chap.slug, true)}
                  style={{ marginRight: '1rem' }}
                >
                  Go to Admin
                </button>
                <button
                  onClick={() => handleDeleteChapel(chap._id)}
                  style={{
                    backgroundColor: '#e00',
                    color: '#fff',
                    marginRight: '1rem'
                  }}
                >
                  Delete
                </button>

                {!isEditing && (
                  <button onClick={() => startEditing(chap)}>
                    Edit
                  </button>
                )}
              </div>

              {/* Edit form */}
              {isEditing && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    background: '#fafafa'
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}
                  >
                    Nickname
                  </label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="Optional short name or nickname"
                    style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Chapel description (plain text => single block)."
                    style={{ width: '100%', padding: '6px', minHeight: '60px' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      margin: '8px 0 4px'
                    }}
                  >
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    placeholder="e.g. +123456789"
                    style={{ width: '100%', padding: '6px' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      margin: '8px 0 4px'
                    }}
                  >
                    Chapel Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ marginBottom: '0.5rem' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      margin: '8px 0 4px'
                    }}
                  >
                    City
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    placeholder="City or region"
                    style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      margin: '8px 0 4px'
                    }}
                  >
                    Google Maps Link
                  </label>
                  <input
                    type="text"
                    value={editGoogleMapsLink}
                    onChange={(e) => setEditGoogleMapsLink(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      margin: '8px 0 4px'
                    }}
                  >
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    placeholder="e.g. 48.210033"
                    style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                  />

                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}
                  >
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    placeholder="e.g. 16.363449"
                    style={{ width: '100%', padding: '6px', marginBottom: '8px' }}
                  />

                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleSaveChanges(chap._id)}
                      style={{ marginRight: '0.5rem' }}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelEditing}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
