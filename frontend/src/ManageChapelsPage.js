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

export default function ManageChapelsPage() {
  const [chapels, setChapels] = useState([])
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // For editing existing chapels
  const [editingChapelId, setEditingChapelId] = useState(null)
  const [editDescription, setEditDescription] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editImageFile, setEditImageFile] = useState(null) // for the user’s newly selected image

  // 1) Fetch chapels
  const fetchChapels = useCallback(async () => {
    try {
      setLoading(true)
      const data = await client.fetch(`
        *[_type == "chapel"]{
          _id,
          name,
          timezone,
          "slug": slug.current,
          description,
          whatsappNumber,
          chapelImage{
            asset->{
              _id,
              url
            }
          }
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

    // Convert block array to text
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
    setEditImageFile(null) // no file selected by default
  }

  // 4) Cancel editing
  const cancelEditing = () => {
    setEditingChapelId(null)
    setEditDescription('')
    setEditWhatsapp('')
    setEditImageFile(null)
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
        ? [{
            _type: 'block',
            children: [
              { _type: 'span', text: editDescription, marks: [] }
            ],
            markDefs: []
          }]
        : []

      // Build the patch data
      const patchData = {
        description: blockArray,
        whatsappNumber: editWhatsapp
      }

      // If user selected a new image file => upload it => attach reference
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
      await client
        .patch(chapelId)
        .set(patchData)
        .commit()

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

      {/* Existing chapels */}
      <h3 style={{ marginBottom: '0.5rem' }}>Existing Chapels</h3>
      {loading && <p>Loading...</p>}
      {!loading && chapels.length === 0 && (
        <p style={{ fontStyle: 'italic' }}>No chapels found.</p>
      )}
      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {chapels.map((chap) => {
          const isEditing = (editingChapelId === chap._id)

          // Convert existing blocks to text for display
          let displayedDesc = ''
          if (chap.description && Array.isArray(chap.description)) {
            displayedDesc = chap.description
              .map((block) => block.children?.map((span) => span.text).join('') || '')
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
              <strong>Timezone: </strong> {chap.timezone}
              <br />
              {chap.slug ? (
                <>
                  <strong>Slug URL: </strong> /{chap.slug}
                  <br />
                </>
              ) : <em>(no slug)</em>}

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
                    </>
                  )}
                </>
              )}

              {/* Buttons */}
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  onClick={() => navigate(`/${chap.slug}`)}
                  style={{ marginRight: '1rem' }}
                >
                  Visit Public Calendar
                </button>
                <button
                  onClick={() => navigate(`/${chap.slug}/admin`)}
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

                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleSaveChanges(chap._id)}
                      style={{ marginRight: '0.5rem' }}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelEditing}>Cancel</button>
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
