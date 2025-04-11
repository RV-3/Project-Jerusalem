import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'

// If you're using React 18+, you may need Modal.setAppElement('#root') or similar
Modal.setAppElement('#root')

export default function WelcomePage() {
  const [chapels, setChapels] = useState([])
  const [expandedChapel, setExpandedChapel] = useState(null) // track which chapel is expanded
  const [selectedChapelForInfo, setSelectedChapelForInfo] = useState(null) // for the info modal

  useEffect(() => {
    // Fetch all chapel docs from Sanity
    client
      .fetch(
        `*[_type == "chapel"]{
          name,
          "slug": slug.current,
          // Optional fields if you want to store them in Sanity:
          // description,
          // imageUrl
        }`
      )
      .then((data) => {
        setChapels(data)
      })
      .catch((err) => {
        console.error('Error fetching chapels:', err)
      })
  }, [])

  // Toggle expand or collapse for a given chapel
  function handleChapelClick(slug) {
    if (expandedChapel === slug) {
      // If already expanded, collapse it
      setExpandedChapel(null)
    } else {
      // Expand this chapel
      setExpandedChapel(slug)
    }
  }

  // Show the info modal for a given chapel
  function handleInfo(chapelItem) {
    setSelectedChapelForInfo(chapelItem)
  }

  // Hide the modal
  function closeModal() {
    setSelectedChapelForInfo(null)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, #0f0f23 0%, #1b1b2f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f4f4f5',
        fontFamily: "'Inter', sans-serif",
        textAlign: 'center',
        padding: '2rem',
        zIndex: 0
      }}
    >
      <h1
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: '2.8rem',
          fontWeight: '700',
          marginBottom: '0.3rem',
          color: '#ffffff'
        }}
      >
        Legio Fidelis
      </h1>

      <p
        style={{
          fontSize: '1.1rem',
          color: '#9ca3af',
          marginBottom: '2rem'
        }}
      >
        A Global Mission for 24/7 Eucharistic Adoration
      </p>

      <p
        style={{
          fontSize: '1.2rem',
          maxWidth: '600px',
          color: '#cbd5e1',
          marginBottom: '2.5rem'
        }}
      >
        Choose an adoration chapel to experience perpetual prayer
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 160px)',
          gap: '1rem',
          width: '100%',
          maxWidth: '500px',
          justifyContent: 'center'
        }}
      >
        {chapels.map((chapelItem) => {
          const isExpanded = expandedChapel === chapelItem.slug

          return (
            <div key={chapelItem.slug} style={{ position: 'relative' }}>
              {/* The main "button" for the chapel */}
              <button
                onClick={() => handleChapelClick(chapelItem.slug)}
                style={{
                  width: '100%',
                  height: '48px',
                  background: 'linear-gradient(90deg, #6b21a8 0%, #8b5cf6 100%)',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  boxShadow: '0 0 10px rgba(139, 92, 246, 0.6)',
                  transition: 'transform 0.2s ease',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
              >
                {chapelItem.name}
              </button>

              {/* The dropdown area if expanded */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                    alignItems: 'center',
                    background: '#1f1f3c',
                    borderRadius: '8px',
                    padding: '0.5rem'
                  }}
                >
                  {/* 1) Calendar icon/link */}
                  <Link
                    to={`/${chapelItem.slug}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      color: '#fff',
                      textDecoration: 'none',
                      width: '60px'
                    }}
                  >
                    {/* Example icon could be a calendar image or FontAwesome icon */}
                    <img
                      src="/assets/calendar-favicon.png"
                      alt="Calendar"
                      style={{ width: '32px', marginBottom: '4px' }}
                    />
                    <span style={{ fontSize: '0.9rem' }}>Calendar</span>
                  </Link>

                  {/* 2) Info icon => opens modal */}
                  <button
                    onClick={() => handleInfo(chapelItem)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      width: '60px'
                    }}
                  >
                    <img
                      src="/assets/info.png"
                      alt="Info"
                      style={{ width: '32px', marginBottom: '4px' }}
                    />
                    <span style={{ fontSize: '0.9rem' }}>Info</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info Modal */}
      <Modal
        isOpen={!!selectedChapelForInfo}
        onRequestClose={closeModal}
        contentLabel="Chapel Info"
        style={{
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000
          },
          content: {
            maxWidth: '400px',
            margin: 'auto',
            borderRadius: '10px',
            padding: '20px',
            background: '#fff'
          }
        }}
      >
        {selectedChapelForInfo && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '1rem' }}>
              {selectedChapelForInfo.name} Info
            </h2>

            {/* If you have an image stored in the doc, use selectedChapelForInfo.imageUrl */}
            <img
              src="/assets/sample-chapel.jpg"
              alt={selectedChapelForInfo.name}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}
            />

            {/* If you have a doc field like selectedChapelForInfo.description, use it */}
            <p style={{ color: '#333', fontSize: '1rem' }}>
              {/* {selectedChapelForInfo.description || 'No description available.'} */}
              This is a short description about {selectedChapelForInfo.name}.
              More details can go here.
            </p>

            <button
              onClick={closeModal}
              style={{
                marginTop: '1rem',
                padding: '8px 16px',
                background: '#6b21a8',
                color: '#fff',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
