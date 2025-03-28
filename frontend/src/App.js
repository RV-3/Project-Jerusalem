import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'
import JerusalemClock from './utils/JerusalemCLock.js'

function App() {
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
          24/7 JERUSALEM
        </h2>

        {/* 2) Place the clock below the heading */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <JerusalemClock />
        </div>

        <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link to="/" style={{ marginRight: '1rem' }}>Main Calendar</Link>
          <Link to="/admin">Admin Panel</Link>
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
