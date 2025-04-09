import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Calendar from './Calendar';
import LiveClock from './utils/LiveClock';
import { TIMEZONE } from './config';
import AdminBlockCalendar from './AdminBlockCalendar';
import useTranslate from './useTranslate';
import { PARISH_NAME } from './config';
import WelcomePage from './chapels/WelcomePage';

function AppContent() {
  const t = useTranslate();
  const location = useLocation();

  // Only show these when not on "/"
  const showHeaderAndNav = location.pathname !== '/';

  return (
    <div style={{ padding: '2rem' }}>
      {showHeaderAndNav && (
        <>
          <h2
            style={{
              textAlign: 'center',
              fontFamily: "'Cinzel Decorative'",
              fontSize: '2rem',
              color: 'black',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
              marginBottom: '1.5rem',
            }}
          >
            {PARISH_NAME}
          </h2>

          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <LiveClock timezone={TIMEZONE} />
          </div>

          <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <Link to="/jerusalem" style={{ marginRight: '1rem' }}>
              {t({ en: 'Main Calendar', de: 'Hauptkalender', es: 'Calendario Principal' })}
            </Link>
            <Link to="/admin">
              {t({ en: 'Admin Panel', de: 'Admin-Bereich', es: 'Panel de Administracion' })}
            </Link>
          </nav>
        </>
      )}

      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/jerusalem" element={<Calendar />} />
        <Route path="/admin" element={<AdminBlockCalendar />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
