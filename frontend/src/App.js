import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Calendar from './Calendar'
import AdminBlockCalendar from './AdminBlockCalendar'

function App() {
  return (
    <Router>
      <div style={{ padding: '2rem' }}>
        <h2 style={{ textAlign: 'center' }}>Adoration Schedule</h2>
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
