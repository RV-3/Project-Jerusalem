import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback
} from 'react'
import { Link } from 'react-router-dom'
import { Map, Marker, Popup, GeolocateControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createClient } from '@sanity/client'
import supercluster from 'supercluster'
import './map.css' // Your custom overrides

import { MapPin, Calendar, MessageCircle } from 'lucide-react'

/** --- SANITY CLIENT --- **/
const sanityClient = createClient({
  projectId: 'gt19q25e',
  dataset: 'production',
  apiVersion: '2023-01-01',
  useCdn: true
})

/** --- MAPBOX TOKEN --- **/
const MAPBOX_TOKEN =
  'pk.eyJ1Ijoic2VudGluZWwxMiIsImEiOiJjbTlpZXA5YnAwMTdyMmpzY3NpdG11d2l6In0.TGPH36urzsXnF9N3mlN_Og'

function parseDescription(blocks) {
  if (!blocks || !Array.isArray(blocks)) return ''
  return blocks
    .map((block) => {
      if (!block.children) return ''
      return block.children.map((span) => span.text).join('')
    })
    .join('\n\n')
}

function getWhatsappLink(num) {
  if (!num || !num.trim()) {
    return 'https://wa.me/0000000000'
  }
  const cleaned = num.replace(/\D+/g, '')
  return `https://wa.me/${cleaned}`
}

export default function MapPage() {
  const [chapels, setChapels] = useState([])
  const [selectedChapel, setSelectedChapel] = useState(null)

  const [viewState, setViewState] = useState({
    longitude: -40,
    latitude: 20,
    zoom: 2.5
  })
  const [bounds, setBounds] = useState(null)
  const mapRef = useRef(null)

  // 1) Fetch data
  useEffect(() => {
    sanityClient
      .fetch(`*[_type == "chapel"]{
        _id,
        name,
        "slug": slug.current,
        description,
        whatsappNumber,
        chapelImage{
          asset-> {
            _id,
            url
          }
        },
        "lat": coalesce(location.lat, 0),
        "lng": coalesce(location.lng, 0)
      }`)
      .then((data) => {
        console.log('Fetched chapels =>', data)
        setChapels(data)
      })
      .catch(console.error)
  }, [])

  // 2) Convert chapels => GeoJSON features
  const points = useMemo(() => {
    return chapels.map((chap) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        chapelId: chap._id
      },
      geometry: {
        type: 'Point',
        coordinates: [chap.lng, chap.lat]
      }
    }))
  }, [chapels])

  // 3) Build supercluster
  const clusterIndex = useMemo(() => {
    return new supercluster({ radius: 50, maxZoom: 14 }).load(points)
  }, [points])

  // 4) Compute clusters for current bounds
  const clusters = useMemo(() => {
    if (!bounds) return []
    const zoom = Math.floor(viewState.zoom)
    return clusterIndex.getClusters(bounds, zoom)
  }, [clusterIndex, bounds, viewState.zoom])

  // Handle map move => update viewState
  const handleMove = (evt) => {
    setViewState(evt.viewState)
  }

  // onMoveEnd => update bounds
  const handleMoveEnd = useCallback(() => {
    const mapbox = mapRef.current?.getMap()
    if (!mapbox) return
    const newBounds = mapbox.getBounds()
    setBounds([
      newBounds.getWest(),
      newBounds.getSouth(),
      newBounds.getEast(),
      newBounds.getNorth()
    ])
  }, [])

  // 5) Expand or popup
  const handleMarkerClick = (feature, event) => {
    event.originalEvent.stopPropagation()

    const { cluster: isCluster, cluster_id: clusterId } = feature.properties

    if (isCluster) {
      const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId)
      setViewState((prev) => ({
        ...prev,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        zoom: expansionZoom,
        transitionDuration: 500
      }))
    } else {
      const chapelId = feature.properties.chapelId
      const found = chapels.find((c) => c._id === chapelId)
      setSelectedChapel(found || null)

      // SHIFT THE MAP HIGHER to reveal entire popup on mobile
      if (found && mapRef.current) {
        const mapbox = mapRef.current.getMap()
        const currentZoom = mapbox.getZoom()

        // negative offset => push popup up ~36% of screen
        const offsetY = -window.innerHeight * 0.36
        mapbox.easeTo({
          center: [found.lng, found.lat],
          zoom: currentZoom,
          offset: [0, offsetY],
          duration: 700
        })
      }
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Map
        ref={mapRef}
        {...viewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v10"
        mapboxAccessToken={MAPBOX_TOKEN}

        /* DISABLE TILT/ROTATION COMPLETELY */
        dragRotate={false}
        pitchWithRotate={false}
        touchZoomRotate={{ pinchToZoom: true, rotate: false }}
        maxPitch={0} // ensures no tilt

        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onClick={() => setSelectedChapel(null)}
      >
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserHeading
          style={{ margin: '10px' }}
        />

        {/* Render markers (cluster or single) */}
        {clusters.map((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates
          const { cluster: isCluster, point_count: pointCount } =
            feature.properties

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${feature.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="bottom"
                onClick={(evt) => handleMarkerClick(feature, evt)}
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
            )
          } else {
            return (
              <Marker
                key={feature.properties.chapelId}
                longitude={longitude}
                latitude={latitude}
                anchor="bottom"
                onClick={(evt) => handleMarkerClick(feature, evt)}
              >
                <MapPin
                  size={28}
                  strokeWidth={2.5}
                  color="#c084fc"
                  style={{ cursor: 'pointer' }}
                />
              </Marker>
            )
          }
        })}

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
                /* 20% smaller popup => smaller padding, image, and title font */
                borderRadius: '12px',
                padding: '24px', // was 24px
                background: '#1f1f3c',
                color: '#f4f4f5',
                textAlign: 'center',
                boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)'
              }}
            >
              <PopupContent chapel={selectedChapel} />
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}

function PopupContent({ chapel }) {
  const displayedDesc = parseDescription(chapel.description)
  const whatsappLink = getWhatsappLink(chapel.whatsappNumber)
  const chapelImageUrl = chapel.chapelImage?.asset?.url || ''

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Slightly smaller font for chapel name */}
      <h3
        style={{
          margin: '0 0 0.75rem 0',
          fontSize: '1.2rem', // was 1.3rem
          fontFamily: "'Cinzel', serif"
        }}
      >
        {chapel.name}
      </h3>

      {chapelImageUrl ? (
        <div
          style={{
            /* 20% smaller image => 160px instead of 200px */
            width: '100%',
            height: '180px',
            overflow: 'hidden',
            borderRadius: '8px',
            marginBottom: '0.75rem'
          }}
        >
          <img
            src={chapelImageUrl}
            alt={chapel.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '160px',
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

      <p
        style={{
          fontSize: '0.9rem', // slightly smaller
          marginBottom: '1rem',
          color: '#cbd5e1',
          whiteSpace: 'pre-wrap'
        }}
      >
        {displayedDesc.trim() ? displayedDesc : 'No description yet.'}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
        <Link
          to={`/${chapel.slug}`}
          style={{
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = '#ddd'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = '#fff'
          }}
        >
          <Calendar size={26} strokeWidth={1.8} />
          <span style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            Calendar
          </span>
        </Link>

        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = '#ddd'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = '#fff'
          }}
        >
          <MessageCircle size={26} strokeWidth={1.8} />
          <span style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            Contact
          </span>
        </a>
      </div>
    </div>
  )
}
