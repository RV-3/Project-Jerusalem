// App.js
import React, { useEffect, useState } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useMatch
} from 'react-router-dom'

import LiveClock from './utils/LiveClock'
import useTranslate from './useTranslate'
import client from './utils/sanityClient'

// Pages
import WelcomePage from './WelcomePage'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'
import ManageChapelsPage from './ManageChapelsPage'
import LeaderboardPage from './LeaderboardPage'

// Helper to detect subdomain. e.g. "jerusalem.legiofidelis.org" => "jerusalem"
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

function ChapelLayout() {
  const t = useTranslate()
  const matchChapel = useMatch('/:chapelSlug/*') // path-based fallback
  const routeSlug = matchChapel?.params?.chapelSlug || null

  const subdomain = getSubdomainOrNull()
  const chapelSlug = subdomain || routeSlug  // subdomain wins if present

  const [chapelInfo, setChapelInfo] = useState(null)

  useEffect(() => {
    if (chapelSlug) {
      client
        .fetch(
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

      {chapelSlug && (
        <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link to={subdomain ? '/' : `/${chapelSlug}`} style={{ marginRight: '1rem' }}>
            {t({ en: 'Main Calendar', de: 'Hauptkalender', es: 'Calendario Principal' })}
          </Link>
          <Link to={subdomain ? '/admin' : `/${chapelSlug}/admin`}>
            {t({ en: 'Admin Panel', de: 'Admin-Bereich', es: 'Panel de Administración' })}
          </Link>
        </nav>
      )}

      <Routes>
        {/* Subdomain style => index => Calendar, "admin" => AdminBlockCalendar */}
        <Route index element={<Calendar />} />
        <Route path="admin" element={<AdminBlockCalendar />} />

        {/* Path style => "/:chapelSlug" => Calendar, "/:chapelSlug/admin" => AdminBlockCalendar */}
        <Route path=":chapelSlug" element={<Calendar />} />
        <Route path=":chapelSlug/admin" element={<AdminBlockCalendar />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const subdomain = getSubdomainOrNull()

  return (
    <Router>
      <Routes>
        {/*
          If subdomain => skip the Welcome route.
          That way jerusalem.legiofidelis.org does NOT match "/"
        */}
        {!subdomain && (
          <Route path="/" element={<WelcomePage />} />
        )}

        {/* Always define these publicly (or also skip if subdomain if you like) */}
        <Route path="/manager" element={<ManageChapelsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        {/* Chapel-based layout => handles subdomain or path-based */}
        <Route path="/*" element={<ChapelLayout />} />
      </Routes>
    </Router>
  )
}
