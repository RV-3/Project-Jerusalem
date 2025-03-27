import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'

function App() {
  return (
    <Router>
      <div style={{ padding: '2rem' }}>
        {/*
          Title with a decorative font, light text shadow, and color.
          - "fontFamily: 'Lobster', cursive" references the Google Font.
          - "textShadow" gives a subtle 3D effect.
        */}
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
