// App.js
import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useMatch
} from 'react-router-dom';

import LiveClock from './utils/LiveClock';
import useTranslate from './useTranslate';
import client from './utils/sanityClient';

// Pages
import WelcomePage from './WelcomePage';
import Calendar from './Calendar';
import AdminBlockCalendar from './AdminBlockCalendar';
import ManageChapelsPage from './ManageChapelsPage';
import LeaderboardPage from './LeaderboardPage';
import MapPage from './map';

// Icon
import { MapPin } from 'lucide-react';

/* -------------------------------------------------
   Helper: sub‑domain part (e.g. "jerusalem")
   Works for legiofidelis.org **and** prayerhouse.io
-------------------------------------------------- */
function getSubdomainOrNull() {
  const hostname = window.location.hostname;       // e.g. jerusalem.prayerhouse.io
  const parts = hostname.split('.');

  const isLegio   = hostname.endsWith('legiofidelis.org');
  const isPrayer  = hostname.endsWith('prayerhouse.io');

  if ((isLegio || isPrayer) && parts.length === 3) {
    const sub = parts[0];
    if (sub === 'www') return null;                 // ignore www.legio…
    return sub;                                    // return "jerusalem"
  }
  return null;
}

/* -------------------------------------------------
   Chapel layout (unchanged)
-------------------------------------------------- */
function ChapelLayout() {
  const t = useTranslate();

  // Path‑based fallback: /:chapelSlug/*
  const matchChapel = useMatch('/:chapelSlug/*');
  const routeSlug   = matchChapel?.params?.chapelSlug || null;

  const subdomain   = getSubdomainOrNull();
  const chapelSlug  = subdomain || routeSlug;

  const [chapelInfo, setChapelInfo] = useState(null);

  useEffect(() => {
    if (!chapelSlug) { setChapelInfo(null); return; }

    client
      .fetch(
        `*[_type=="chapel" && slug.current==$slug][0]{
          name, nickname, city, googleMapsLink, timezone
        }`,
        { slug: chapelSlug }
      )
      .then((doc) => setChapelInfo(doc || null))
      .catch((err) => {
        console.error('Error fetching chapel info:', err);
        setChapelInfo(null);
      });
  }, [chapelSlug]);

  return (
    <div style={{ padding: '2rem' }}>
      {/* Title */}
      <h2 style={{
        textAlign: 'center',
        fontFamily: "'Cinzel Decorative'",
        fontSize: '2rem',
        color: 'black',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
        marginBottom: '1rem'
      }}>
        {chapelInfo?.nickname ||
         chapelInfo?.name     ||
         t({
           en : chapelSlug ? 'Loading Chapel…'  : 'No Chapel Selected',
           de : chapelSlug ? 'Kapelle wird geladen…' : 'Keine Kapelle ausgewählt',
           es : chapelSlug ? 'Cargando capilla…' : 'Ninguna capilla seleccionada',
           ar : chapelSlug ? 'جاري تحميل المصلى…' : 'لم يتم اختيار المصلى'
         })}
      </h2>

      {/* City */}
      {chapelInfo?.city && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {chapelInfo.googleMapsLink ? (
            <a
              href={chapelInfo.googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'inherit',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 'bold'
              }}>
              <MapPin size={16} /> {chapelInfo.city}
            </a>
          ) : (
            <strong>{chapelInfo.city}</strong>
          )}
        </div>
      )}

      {/* Live clock */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <LiveClock timezone={chapelInfo?.timezone || 'UTC'} />
      </div>

      {/* Local nav (calendar / admin) */}
      {chapelSlug && (
        <nav style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link to={subdomain ? '/' : `/${chapelSlug}`} style={{ marginRight: '1rem' }}>
            {t({
              en:'Main Calendar', de:'Hauptkalender', es:'Calendario Principal', ar:'التقويم الرئيسي'
            })}
          </Link>
          <Link to={subdomain ? '/admin' : `/${chapelSlug}/admin`}>
            {t({
              en:'Admin Panel', de:'Admin‑Bereich', es:'Panel de Administración', ar:'لوحة الإدارة'
            })}
          </Link>
        </nav>
      )}

      {/* Nested routes */}
      <Routes>
        <Route index                element={<Calendar             chapelSlug={chapelSlug} />} />
        <Route path="admin"         element={<AdminBlockCalendar   chapelSlug={chapelSlug} />} />
        <Route path=":chapelSlug"   element={<Calendar             chapelSlug={chapelSlug} />} />
        <Route path=":chapelSlug/admin"
               element={<AdminBlockCalendar chapelSlug={chapelSlug} />} />
      </Routes>
    </div>
  );
}

/* -------------------------------------------------
   Main App routes
-------------------------------------------------- */
export default function App() {
  const subdomain = getSubdomainOrNull();

  return (
    <Router>
      <Routes>
        {/* Landing page => Map if no subdomain */}
        {!subdomain && <Route path="/" element={<MapPage />} />}

        {/* Original welcome page still available at /main */}
        <Route path="/main" element={<WelcomePage />} />

        {/* Explicit /map route (optional) */}
        <Route path="/map" element={<MapPage />} />

        {/* Manager & leaderboard */}
        <Route path="/manager"      element={<ManageChapelsPage />} />
        <Route path="/leaderboard"  element={<LeaderboardPage />} />

        {/* Catch‑all => chapel calendars & admin */}
        <Route path="/*" element={<ChapelLayout />} />
      </Routes>
    </Router>
  );
}
