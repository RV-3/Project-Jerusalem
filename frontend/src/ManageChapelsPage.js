import React, { useEffect, useState, useCallback } from 'react'
import client from './utils/sanityClient.js' // Adjust if needed
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

  // 1) Fetch existing chapels
  const fetchChapels = useCallback(async () => {
    try {
      setLoading(true)
      const data = await client.fetch(`
        *[_type == "chapel"]{
          _id,
          name,
          timezone,
          "slug": slug.current
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

  // 2) Handle creation
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

  /**
   * 3) Cascade-Delete the chapel by:
   *   1) Finding all docs referencing it
   *   2) Deleting those docs
   *   3) Deleting the chapel
   * This prevents 409 Conflict errors.
   */
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

      // 1) Find all docs referencing this chapel
      const referencingDocs = await client.fetch(
        `*[references($chapelId)]{ _id }`,
        { chapelId }
      )

      // 2) Create a transaction: delete referencing docs, then delete the chapel
      let tx = client.transaction()
      referencingDocs.forEach((doc) => {
        tx = tx.delete(doc._id)
      })
      tx = tx.delete(chapelId)

      // 3) Commit
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

          {/* 2) OR a text input so user can type custom if not in the dropdown */}
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            placeholder="e.g. Europe/Vienna (you can also pick from dropdown above)"
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

      {/* Existing chapels list */}
      <h3 style={{ marginBottom: '0.5rem' }}>Existing Chapels</h3>
      {loading && <p>Loading...</p>}
      {!loading && chapels.length === 0 && (
        <p style={{ fontStyle: 'italic' }}>No chapels found.</p>
      )}
      <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
        {chapels.map((chap) => (
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
              </>
            ) : (
              <em>(no slug)</em>
            )}
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
                style={{ backgroundColor: '#e00', color: '#fff' }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
