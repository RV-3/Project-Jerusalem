// App.js
import React, { useEffect, useState } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useMatch
} from 'react-router-dom'

import LiveClock from './utils/LiveClock'
import useTranslate from './useTranslate'
import client from './utils/sanityClient' // <-- needed to fetch chapel info from Sanity

// Pages/Components
import WelcomePage from './WelcomePage'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'
import ManageChapelsPage from './ManageChapelsPage'

function AppContent() {
  const t = useTranslate()
  const location = useLocation()

  // Only show the header/nav if not on the home "/"
  const showHeaderAndNav = location.pathname !== '/'

  // Try to extract the chapelSlug if we’re on /slug or /slug/admin
  const matchChapel = useMatch('/:chapelSlug/*')
  const chapelSlug = matchChapel?.params?.chapelSlug || null

  // State for chapel info (name, timezone)
  const [chapelInfo, setChapelInfo] = useState(null)

  useEffect(() => {
    if (chapelSlug) {
      client
        .fetch(`*[_type == "chapel" && slug.current == $slug][0]{name, timezone}`, {
          slug: chapelSlug
        })
        .then((doc) => {
          if (doc) setChapelInfo(doc)
        })
        .catch((err) => {
          console.error('Error fetching chapel name/timezone:', err)
          setChapelInfo(null)
        })
    } else {
      setChapelInfo(null)
    }
  }, [chapelSlug])

  return (
    <div style={{ padding: '2rem' }}>
      {showHeaderAndNav && (
        <>
          {/* Title from chapelInfo */}
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
            {chapelInfo?.name || 'Loading Chapel...'}
          </h2>

          {/* Live clock using chapel-specific timezone */}
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <LiveClock timezone={chapelInfo?.timezone || 'UTC'} />
          </div>

          {/* NAV: only show if we have a chapelSlug */}
          <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {chapelSlug && (
              <>
                <Link to={`/${chapelSlug}`} style={{ marginRight: '1rem' }}>
                  {t({
                    en: 'Main Calendar',
                    de: 'Hauptkalender',
                    es: 'Calendario Principal'
                  })}
                </Link>

                <Link to={`/${chapelSlug}/admin`}>
                  {t({
                    en: 'Admin Panel',
                    de: 'Admin-Bereich',
                    es: 'Panel de Administración'
                  })}
                </Link>
              </>
            )}
          </nav>
        </>
      )}

      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/manager" element={<ManageChapelsPage />} />
        <Route path="/:chapelSlug" element={<Calendar />} />
        <Route path="/:chapelSlug/admin" element={<AdminBlockCalendar />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
