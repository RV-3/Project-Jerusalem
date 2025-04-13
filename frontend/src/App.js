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

/**
 * Helper: If hostname is e.g. "jerusalem.legiofidelis.org",
 * return "jerusalem". If it's just "legiofidelis.org" or "www.legiofidelis.org",
 * return null.
 */
function getSubdomainOrNull() {
  const hostname = window.location.hostname
  const parts = hostname.split('.')

  // For domain "legiofidelis.org"
  if (hostname.endsWith('legiofidelis.org') && parts.length === 3) {
    const sub = parts[0] // e.g. "jerusalem"
    // Exclude common sub like "www"
    if (sub === 'www') return null
    return sub
  }

  return null
}

/**
 * ChapelLayout handles subdomain-based OR path-based detection.
 * 1) If subdomain found => use that as `chapelSlug`.
 * 2) Else, fallback to route param /:chapelSlug.
 */
function ChapelLayout() {
  const t = useTranslate()

  // 1) Check route param: /:chapelSlug/*
  const matchChapel = useMatch('/:chapelSlug/*')
  const routeSlug = matchChapel?.params?.chapelSlug || null

  // 2) Check subdomain
  const subdomain = getSubdomainOrNull()

  // 3) Final slug => subdomain (if any) overrides routeSlug
  const chapelSlug = subdomain || routeSlug

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
          {/*
            If subdomain, linking to "/admin" is correct (no slug in path).
            If route-based, we link to "/slug/admin".
          */}
          <Link to={subdomain ? '/' : `/${chapelSlug}`} style={{ marginRight: '1rem' }}>
            {t({
              en: 'Main Calendar',
              de: 'Hauptkalender',
              es: 'Calendario Principal'
            })}
          </Link>
          <Link to={subdomain ? '/admin' : `/${chapelSlug}/admin`}>
            {t({
              en: 'Admin Panel',
              de: 'Admin-Bereich',
              es: 'Panel de Administración'
            })}
          </Link>
        </nav>
      )}

      <Routes>
        {/*
          For subdomain approach => "/admin" or "/" as index
          For path approach => "/:chapelSlug/admin" or "/:chapelSlug"
        */}
        <Route index element={<Calendar />} />
        <Route path="admin" element={<AdminBlockCalendar />} />

        {/* keep these for direct path usage on main domain */}
        <Route path=":chapelSlug" element={<Calendar />} />
        <Route path=":chapelSlug/admin" element={<AdminBlockCalendar />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/manager" element={<ManageChapelsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        {/* Catch-all => ChapelLayout handles subdomain + path-based chapels */}
        <Route path="/*" element={<ChapelLayout />} />
      </Routes>
    </Router>
  )
}
