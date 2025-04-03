import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Calendar from './Calendar'
import LiveClock from './utils/LiveClock'
import { TIMEZONE } from './config'
import AdminBlockCalendar from './AdminBlockCalendar'
import useTranslate from './useTranslate'
import { PARISH_NAME } from './config' // 👈 import from config.js

function App() {
  const t = useTranslate()

  return (
    <Router>
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
          {PARISH_NAME} {/* 👈 dynamic parish name */}
        </h2>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <LiveClock timezone={TIMEZONE} />
        </div>

        <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link to="/" style={{ marginRight: '1rem' }}>
            {t({ en: 'Main Calendar', de: 'Hauptkalender' })}
          </Link>
          <Link to="/admin">
            {t({ en: 'Admin Panel', de: 'Admin-Bereich' })}
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<Calendar />} />
          <Route path="/admin" element={<AdminBlockCalendar />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
