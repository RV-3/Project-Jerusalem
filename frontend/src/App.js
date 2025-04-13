import React, { useEffect, useState } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useMatch,
} from 'react-router-dom'

import LiveClock from './utils/LiveClock'
import client from './utils/sanityClient'

// Pages
import WelcomePage from './WelcomePage'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'
import ManageChapelsPage from './ManageChapelsPage'
import LeaderboardPage from './LeaderboardPage'

// Helper: subdomain => e.g. "jerusalem" from "jerusalem.legiofidelis.org"
function getSubdomainOrNull() {
  const hostname = window.location.hostname
  const parts = hostname.split('.')
  if (hostname.endsWith('legiofidelis.org') && parts.length === 3) {
    const sub = parts[0]
    if (sub === 'www') return null
    return sub
  }
  return null
}

// The ChapelLayout extracts subdomain or route param => final slug
function ChapelLayout() {
  const matchChapel = useMatch('/:chapelSlug/*') // path-based fallback
  const routeSlug = matchChapel?.params?.chapelSlug || null

  const subdomain = getSubdomainOrNull()
  const chapelSlug = subdomain || routeSlug

  const [chapelInfo, setChapelInfo] = useState(null)

  useEffect(() => {
    if (chapelSlug) {
      client.fetch(
        `*[_type == "chapel" && slug.current == $slug][0]{name, timezone}`,
        { slug: chapelSlug }
      )
      .then((doc) => {
        if (doc) setChapelInfo(doc)
      })
      .catch((err) => {
        console.error('Error fetching chapel info:', err)
        setChapelInfo(null)
      })
    } else {
      setChapelInfo(null)
    }
  }, [chapelSlug])

  return (
    <div style={{ padding: '2rem' }}>
      <h2
        style={{
          textAlign: 'center',
          fontFamily: "'Cinzel Decorative'",
          fontSize: '2rem',
          color: 'black',
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
          marginBottom: '1.5rem'
        }}
      >
        {chapelInfo?.name ||
          (chapelSlug ? 'Loading Chapel...' : 'No Chapel Selected')}
      </h2>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <LiveClock timezone={chapelInfo?.timezone || 'UTC'} />
      </div>

      {/* If we have a chapelSlug => show the Chapel nav, else no nav */}
      {/* This nav doesn't matter as much if you're using direct links or subdomain,
          but let's keep it for consistency */}
      {/* We won't show code with <Link> here to the /admin,
          because we're passing props to the actual <Calendar> or <AdminBlockCalendar> */}

      <Routes>
        {/*
          Subdomain style => just pass the chapelSlug to Calendar
          index => Calendar, "admin" => AdminBlockCalendar
        */}
        <Route
          index
          element={<Calendar chapelSlug={chapelSlug} />}
        />
        <Route
          path="admin"
          element={<AdminBlockCalendar chapelSlug={chapelSlug} />}
        />

        {/*
          Path style => "/:chapelSlug" => same
          => we pass the same slug to <Calendar>
        */}
        <Route
          path=":chapelSlug"
          element={<Calendar chapelSlug={chapelSlug} />}
        />
        <Route
          path=":chapelSlug/admin"
          element={<AdminBlockCalendar chapelSlug={chapelSlug} />}
        />
      </Routes>
    </div>
  )
}

export default function App() {
  const subdomain = getSubdomainOrNull()

  return (
    <Router>
      <Routes>
        {/* If subdomain, skip welcome */}
        {!subdomain && (
          <Route path="/" element={<WelcomePage />} />
        )}

        {/* Manager, Leaderboard always accessible on main domain */}
        <Route path="/manager" element={<ManageChapelsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        {/* Anything else => ChapelLayout */}
        <Route path="/*" element={<ChapelLayout />} />
      </Routes>
    </Router>
  )
}
