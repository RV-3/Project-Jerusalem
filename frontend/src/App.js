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

// 🧠 Only chapel-based routes render this wrapper
function ChapelLayout() {
  const t = useTranslate()
  const matchChapel = useMatch('/:chapelSlug/*')
  const chapelSlug = matchChapel?.params?.chapelSlug || null

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
        {chapelInfo?.name || 'Loading Chapel...'}
      </h2>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <LiveClock timezone={chapelInfo?.timezone || 'UTC'} />
      </div>

      {chapelSlug && (
        <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link to={`/${chapelSlug}`} style={{ marginRight: '1rem' }}>
            {t({ en: 'Main Calendar', de: 'Hauptkalender', es: 'Calendario Principal' })}
          </Link>
          <Link to={`/${chapelSlug}/admin`}>
            {t({ en: 'Admin Panel', de: 'Admin-Bereich', es: 'Panel de Administración' })}
          </Link>
        </nav>
      )}

      <Routes>
        <Route path="/:chapelSlug" element={<Calendar />} />
        <Route path="/:chapelSlug/admin" element={<AdminBlockCalendar />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* ✅ Public routes */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/manager" element={<ManageChapelsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        {/* ✅ Chapel-based layout routes */}
        <Route path="/*" element={<ChapelLayout />} />
      </Routes>
    </Router>
  )
}
