// File: MapPage.jsx

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback
} from 'react';
import { Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { Map, Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { createClient } from '@sanity/client';
import supercluster from 'supercluster';

import {
  MapPin,
  Calendar,
  MessageCircle,
  Navigation,
  Menu,
  Award,
  Settings
} from 'lucide-react';

import './map.css';

/* ─────────────────────────── Sanity client ───────────────────────── */
const sanityClient = createClient({
  projectId: 'gt19q25e',
  dataset:   'production',
  apiVersion:'2023-01-01',
  useCdn:    true
});

/* ─────────────────────────── Mapbox Token ────────────────────────── */
const MAPBOX_TOKEN =
  'pk.eyJ1Ijoic2VudGluZWwxMiIsImEiOiJjbTlpZXA5YnAwMTdyMmpzY3NpdG11d2l6In0.TGPH36urzsXnF9N3mlN_Og';

/* ────────────────────────── Helpers ──────────────────────────────── */
function parseDescription(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => (b.children ? b.children.map((s) => s.text).join('') : ''))
    .join('\n\n');
}

function getWhatsappLink(num) {
  if (!num?.trim()) return 'https://wa.me/0000000000';
  return `https://wa.me/${num.replace(/\D+/g, '')}`;
}

/* ═══════════════════════════════ COMPONENT ══════════════════════════════ */
export default function MapPage() {
  // --------------------------------------
  // State
  // --------------------------------------
  const [chapels,        setChapels]        = useState([]);
  const [selectedChapel, setSelectedChapel] = useState(null);

  const [viewState, setViewState] = useState({
    longitude: -40,
    latitude:  20,
    zoom:      2.5
  });
  const [bounds,   setBounds]   = useState(null);

  // Toggle hidden drawer
  const [menuOpen, setMenuOpen] = useState(false);

  // Refs
  const mapRef        = useRef(null);
  const geoControlRef = useRef(null);

  // --------------------------------------
  // 1) fetch chapels from Sanity
  // --------------------------------------
  useEffect(() => {
    sanityClient
      .fetch(`*[_type=="chapel"]{
        _id,
        name,
        nickname,
        city,
        googleMapsLink,
        "slug": slug.current,
        description,
        whatsappNumber,
        chapelImage { asset->{_id, url} },
        "lat": coalesce(location.lat, 0),
        "lng": coalesce(location.lng, 0)
      }`)
      .then(setChapels)
      .catch(console.error);
  }, []);

  // --------------------------------------
  // 2) supercluster prep
  // --------------------------------------
  const points = useMemo(
    () =>
      chapels.map((c) => ({
        type: 'Feature',
        properties: { cluster: false, chapelId: c._id },
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] }
      })),
    [chapels]
  );

  const clusterIndex = useMemo(
    () => new supercluster({ radius: 50, maxZoom: 14 }).load(points),
    [points]
  );

  const clusters = useMemo(() => {
    if (!bounds) return [];
    return clusterIndex.getClusters(bounds, Math.floor(viewState.zoom));
  }, [clusterIndex, bounds, viewState.zoom]);

  // --------------------------------------
  // Map move handlers
  // --------------------------------------
  const handleMove = (e) => setViewState(e.viewState);

  const handleMoveEnd = useCallback(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;

    const b = m.getBounds();
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);

    // Force no rotation/pitch if user tries
    if (m.getBearing() !== 0 || m.getPitch() !== 0) {
      m.setBearing(0);
      m.setPitch(0);
    }
  }, []);

  // --------------------------------------
  // Marker click
  // --------------------------------------
  const handleMarkerClick = (feature, e) => {
    e.originalEvent.stopPropagation();

    if (feature.properties.cluster) {
      const zoom = clusterIndex.getClusterExpansionZoom(feature.properties.cluster_id);
      setViewState((v) => ({
        ...v,
        longitude: feature.geometry.coordinates[0],
        latitude:  feature.geometry.coordinates[1],
        zoom,
        transitionDuration: 500
      }));
    } else {
      const chap = chapels.find((c) => c._id === feature.properties.chapelId);
      setSelectedChapel(chap || null);

      if (chap && mapRef.current) {
        const m = mapRef.current.getMap();
        m.easeTo({
          center: [chap.lng, chap.lat],
          offset: [0, -window.innerHeight * 0.36],
          duration: 700
        });
      }
    }
  };

  // --------------------------------------
  // onLoad: Lock rotation/pitch; add geolocate but hide default icon
  // --------------------------------------
  const handleMapLoad = useCallback(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;

    // Lock out rotation/pitch
    m.setMinPitch(0);
    m.setMaxPitch(0);
    m.touchPitch.disable();
    m.dragRotate.disable();
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.on('rotate', () => {
      m.setBearing(0);
      m.setPitch(0);
    });

    // Add hidden GeolocateControl once
    if (!geoControlRef.current) {
      const ctrl = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showAccuracyCircle: false
      });
      geoControlRef.current = ctrl;
      m.addControl(ctrl);

      // Hide its default "crosshair" button with CSS
      const styleEl = document.createElement('style');
      styleEl.innerHTML = '.mapboxgl-ctrl-geolocate { display: none !important; }';
      document.head.appendChild(styleEl);
    }
  }, []);

  // --------------------------------------
  // Drawer & Button Styles
  // --------------------------------------
  const drawerContainerStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '240px',
    height: '100%',
    background: '#1e1e2f',
    borderLeft: '2px solid #64748b',
    transition: 'transform 0.3s ease-in-out',
    transform: menuOpen ? 'translateX(0%)' : 'translateX(100%)',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column'
  };

  // Drawer header with hamburger + "Menu" on the same row
  const drawerHeaderStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    height: '60px',
    padding: '0 1rem',
    borderBottom: '1px solid #64748b'
  };

  // Two style objects for the hamburger
  const hamburgerButtonClosed = {
    position: 'absolute',
    top: '50%',
    left: '-48px',
    transform: 'translateY(-50%)',
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    background: '#1e1e2f',
    border: '2px solid #64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  };

  // When open, fade it out
  const hamburgerButtonOpen = {
    ...hamburgerButtonClosed,
    background: 'transparent',
    border: 'none',
    opacity: 0.5
  };

  // "Menu" text: clickable
  const menuTitleStyle = {
    margin: 0,
    marginLeft: '2rem',
    color: '#cbd5e1',
    fontSize: '1.1rem',
    fontWeight: 600,
    cursor: 'pointer' // so user sees it's clickable
  };

  const navContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '0.5rem'
  };

  const linkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#cbd5e1',
    textDecoration: 'none',
    fontWeight: '500',
    padding: '8px',
    borderRadius: '6px',
    transition: 'background 0.2s'
  };
  const linkHoverStyle = {
    background: '#2e2e44'
  };

  // --------------------------------------
  // Render
  // --------------------------------------
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onLoad={handleMapLoad}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onClick={() => setSelectedChapel(null)}
        mapStyle="mapbox://styles/mapbox/dark-v10"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        dragRotate={false}
        pitchWithRotate={false}
        touchZoomRotate={{ pinchToZoom: true, rotate: false }}
        minPitch={0}
        maxPitch={0}
      >
        {/* Bottom-right arrow button for geolocation */}
        <button
          onClick={() => geoControlRef.current?.trigger()}
          style={{
            position: 'absolute',
            right: '16px',
            bottom: '25%',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#1e1e2f',
            border: '2px solid #64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 6px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            zIndex: 5
          }}
        >
          <Navigation size={26} strokeWidth={2.2} color="#cbd5e1" />
        </button>

        {/* Hidden Drawer (slides in/out) */}
        <div style={drawerContainerStyle}>
          {/* Header with hamburger + "Menu" horizontally aligned */}
          <div style={drawerHeaderStyle}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={menuOpen ? hamburgerButtonOpen : hamburgerButtonClosed}
            >
              <Menu size={24} strokeWidth={2} color="#cbd5e1" />
            </button>

            {/* Clicking the text toggles the drawer, too */}
            <h2
              style={menuTitleStyle}
              onClick={() => setMenuOpen(o => !o)}
            >
              Menu
            </h2>
          </div>

          {/* Nav Links */}
          <nav style={navContainerStyle}>
            <Link
              to="/leaderboard"
              style={linkStyle}
              onMouseEnter={e => Object.assign(e.currentTarget.style, linkHoverStyle)}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => setMenuOpen(false)}
            >
              <Award size={22} strokeWidth={2} color="#cbd5e1" />
              <span>Leaderboard</span>
            </Link>

            <Link
              to="/manager"
              style={linkStyle}
              onMouseEnter={e => Object.assign(e.currentTarget.style, linkHoverStyle)}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => setMenuOpen(false)}
            >
              <Settings size={22} strokeWidth={2} color="#cbd5e1" />
              <span>Manager</span>
            </Link>
          </nav>
        </div>

        {/* CLUSTERS & MARKERS */}
        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = feature.properties;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${feature.id}`}
                longitude={lng}
                latitude={lat}
                anchor="bottom"
                onClick={(e) => handleMarkerClick(feature, e)}
              >
                <div style={{ position: 'relative', cursor: 'pointer' }}>
                  <MapPin size={38} strokeWidth={2.8} color="#c084fc" />
                  <div
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-4px',
                      background: '#6b21a8',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {pointCount}
                  </div>
                </div>
              </Marker>
            );
          }

          // Single chapel
          return (
            <Marker
              key={feature.properties.chapelId}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              onClick={(e) => handleMarkerClick(feature, e)}
            >
              <MapPin
                size={28}
                strokeWidth={2.5}
                color="#c084fc"
                style={{ cursor: 'pointer' }}
              />
            </Marker>
          );
        })}

        {/* POPUP */}
        {selectedChapel && (
          <Popup
            className="dark-popup bigger-close"
            longitude={selectedChapel.lng}
            latitude={selectedChapel.lat}
            anchor="top"
            onClose={() => setSelectedChapel(null)}
            closeOnClick={false}
            maxWidth="350px"
          >
            <div
              style={{
                borderRadius: '12px',
                padding: '20px',
                background: '#1f1f3c',
                color: '#f4f4f5',
                textAlign: 'center',
                boxShadow: '0 0 8px rgba(139,92,246,0.4)'
              }}
            >
              <PopupContent chapel={selectedChapel} />
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

/* ═════════════════════ POPUP CONTENT ═════════════════════ */
function PopupContent({ chapel }) {
  const displayedDesc = parseDescription(chapel.description);
  const whatsappLink  = getWhatsappLink(chapel.whatsappNumber);
  const imgUrl        = chapel.chapelImage?.asset?.url || '';

  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      {chapel.nickname && (
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontFamily: "'Cinzel',serif" }}>
          {chapel.nickname}
        </h3>
      )}

      {chapel.city && (
        <div style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {chapel.googleMapsLink ? (
            <a
              href={chapel.googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 'bold',
                color: 'inherit',
                textDecoration: 'none'
              }}
            >
              <MapPin size={18} strokeWidth={2} />
              {chapel.city}
            </a>
          ) : (
            <strong>{chapel.city}</strong>
          )}
        </div>
      )}

      {imgUrl ? (
        <div style={{ width: '100%', height: '180px', overflow: 'hidden', borderRadius: '8px', marginBottom: '0.75rem' }}>
          <img
            src={imgUrl}
            alt={chapel.nickname || 'Chapel'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '180px',
            borderRadius: '8px',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#3a3a5d'
          }}
        >
          <span style={{ color: '#aaa' }}>No Image</span>
        </div>
      )}

      <p style={{ fontSize: '0.95rem', marginBottom: '1rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
        {displayedDesc.trim() ? displayedDesc : 'No description yet.'}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
        <Link
          to={`/${chapel.slug}`}
          style={{ color: '#fff', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <Calendar size={28} strokeWidth={1.8} />
          <span style={{ fontSize: '0.85rem', marginTop: '4px' }}>Calendar</span>
        </Link>

        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#fff', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <MessageCircle size={28} strokeWidth={1.8} />
          <span style={{ fontSize: '0.85rem', marginTop: '4px' }}>Contact</span>
        </a>
      </div>
    </div>
  );
}
