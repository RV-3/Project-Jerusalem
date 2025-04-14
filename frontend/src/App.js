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

function ChapelLayout() {
  const t = useTranslate()

  // Path-based fallback: /:chapelSlug/*
  const matchChapel = useMatch('/:chapelSlug/*')
  const routeSlug = matchChapel?.params?.chapelSlug || null

  // Detect subdomain
  const subdomain = getSubdomainOrNull()
  // Final slug
  const chapelSlug = subdomain || routeSlug

  const [chapelInfo, setChapelInfo] = useState(null)

  useEffect(() => {
    if (chapelSlug) {
      client
        .fetch(
          `*[_type == "chapel" && slug.current == $slug][0]{name, nickname, timezone}`,
          { slug: chapelSlug }
        )
        .then((doc) => {
          console.log('Fetched doc in ChapelLayout =>', doc)
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
        {
          // Show nickname if available, otherwise name, otherwise a translated fallback
          chapelInfo?.nickname ||
          chapelInfo?.name ||
          t({
            en: chapelSlug ? 'Loading Chapel...' : 'No Chapel Selected',
            de: chapelSlug ? 'Kapelle wird geladen...' : 'Keine Kapelle ausgewählt',
            es: chapelSlug ? 'Cargando capilla...' : 'Ninguna capilla seleccionada',
            ar: chapelSlug ? 'جاري تحميل المصلى...' : 'لم يتم اختيار المصلى'
          })
        }
      </h2>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <LiveClock timezone={chapelInfo?.timezone || 'UTC'} />
      </div>

      {chapelSlug && (
        <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
          {/* If subdomain => link to "/" and "/admin", otherwise link to "/[chapelSlug]" and "/[chapelSlug]/admin" */}
          <Link
            to={subdomain ? '/' : `/${chapelSlug}`}
            style={{ marginRight: '1rem' }}
          >
            {t({
              en: 'Main Calendar',
              de: 'Hauptkalender',
              es: 'Calendario Principal',
              ar: 'التقويم الرئيسي'
            })}
          </Link>
          <Link to={subdomain ? '/admin' : `/${chapelSlug}/admin`}>
            {t({
              en: 'Admin Panel',
              de: 'Admin-Bereich',
              es: 'Panel de Administración',
              ar: 'لوحة الإدارة'
            })}
          </Link>
        </nav>
      )}

      <Routes>
        {/* Subdomain style => index => <Calendar chapelSlug={chapelSlug} /> */}
        <Route index element={<Calendar chapelSlug={chapelSlug} />} />

        {/* Subdomain style => path="admin" => <AdminBlockCalendar chapelSlug={chapelSlug} /> */}
        <Route
          path="admin"
          element={<AdminBlockCalendar chapelSlug={chapelSlug} />}
        />

        {/* Path style => "/:chapelSlug" => <Calendar> */}
        <Route
          path=":chapelSlug"
          element={<Calendar chapelSlug={chapelSlug} />}
        />

        {/* Path style => "/:chapelSlug/admin" => <AdminBlockCalendar> */}
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
        {/* If subdomain => skip welcome */}
        {!subdomain && (
          <Route path="/" element={<WelcomePage />} />
        )}

        {/* Manager, Leaderboard always accessible */}
        <Route path="/manager" element={<ManageChapelsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        {/* Catch-all => ChapelLayout */}
        <Route path="/*" element={<ChapelLayout />} />
      </Routes>
    </Router>
  )
}
