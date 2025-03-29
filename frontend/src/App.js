import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'

// 1) Small clock component to display current Jerusalem time
function JerusalemClock() {
  const [timeString, setTimeString] = useState('')

  useEffect(() => {
    function updateTime() {
      // Get local time in "Asia/Jerusalem"
      const now = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      setTimeString(now)
    }

    updateTime() // show immediately
    const intervalId = setInterval(updateTime, 1000) // update every second

    return () => clearInterval(intervalId)
  }, [])

  return (
    <div style={{ textAlign: 'center', fontSize: '1rem', marginBottom: '1rem' }}>
       {timeString}
    </div>
  )
}

// 2) Main App
function App() {
  return (
    <Router>
      <div style={{ padding: '2rem' }}>
        <h2
          style={{
            textAlign: 'center',
            fontFamily: "'Cinzel Decorative",
            fontSize: '2rem',
            color: 'black',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
            marginBottom: '1.5rem'
          }}
        >
          24/7 JERUSALEM
        </h2>

        {/* 3) Put the clock below the heading */}
        <JerusalemClock />

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
