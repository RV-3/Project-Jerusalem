import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import client from './utils/sanityClient.js'
import Modal from 'react-modal'
import { Calendar, MessageCircle } from 'lucide-react'

Modal.setAppElement('#root')

export default function WelcomePage() {
  const [chapels, setChapels] = useState([])
  const [selectedChapel, setSelectedChapel] = useState(null)

  useEffect(() => {
    // Fetch data including chapelImage
    client
      .fetch(`*[_type == "chapel"]{
        name,
        "slug": slug.current,
        description,
        whatsappNumber,
        chapelImage{
          asset-> {
            _id,
            url
          }
        }
      }`)
      .then((data) => setChapels(data))
      .catch((err) => console.error('Error fetching chapels:', err))
  }, [])

  // Helper to parse the `description` (array of blocks) into plain text
  function parseDescription(blocks) {
    if (!blocks || !Array.isArray(blocks)) return ''
    return blocks
      .map((block) => {
        if (!block.children) return ''
        return block.children.map((span) => span.text).join('')
      })
      .join('\n\n')
  }

  // Build the WhatsApp link from the chapel's number
  function getWhatsappLink(num) {
    if (!num || !num.trim()) {
      return 'https://wa.me/0000000000' // fallback
    }
    const cleaned = num.replace(/\D+/g, '')
    return `https://wa.me/${cleaned}`
  }

  // If a chapel is selected => parse description, build WA link
  let displayedDesc = ''
  let whatsappLink = ''
  let chapelImageUrl = ''
  if (selectedChapel) {
    displayedDesc = parseDescription(selectedChapel.description)
    whatsappLink = getWhatsappLink(selectedChapel.whatsappNumber)
    chapelImageUrl = selectedChapel.chapelImage?.asset?.url || ''
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
        padding: '2rem'
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

      {/* Chapel Buttons */}
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
        {chapels.map((chapelItem) => (
          <button
            key={chapelItem.slug}
            onClick={() => setSelectedChapel(chapelItem)}
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
        ))}
      </div>

      {/* Info Modal */}
      <Modal
        isOpen={!!selectedChapel}
        onRequestClose={() => setSelectedChapel(null)}
        contentLabel="Chapel Info"
        style={{
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000
          },
          content: {
            maxWidth: '400px',
            margin: 'auto',
            borderRadius: '12px',
            padding: '24px',
            background: '#1f1f3c',
            color: '#f4f4f5',
            textAlign: 'center',
            border: '1px solid #6b21a8'
          }
        }}
      >
        {selectedChapel && (
          <div>
            <h2
              style={{
                fontSize: '1.6rem',
                marginBottom: '1rem',
                fontFamily: "'Cinzel', serif",
                color: '#fff'
              }}
            >
              {selectedChapel.name}
            </h2>

            {/* Uniform Chapel Image */}
            {chapelImageUrl ? (
              <div
                style={{
                  width: '100%',
                  height: '200px', // uniform height
                  overflow: 'hidden',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}
              >
                <img
                  src={chapelImageUrl}
                  alt={selectedChapel.name}
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
                  height: '200px',
                  background: '#3a3a5d',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ color: '#aaa' }}>No Image Available</span>
              </div>
            )}

            <p
              style={{
                fontSize: '1rem',
                marginBottom: '1.5rem',
                color: '#cbd5e1',
                whiteSpace: 'pre-wrap'
              }}
            >
              {displayedDesc.trim()
                ? displayedDesc
                : `No description available for ${selectedChapel.name} yet.`}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '2rem',
                marginBottom: '1rem'
              }}
            >
              {/* Calendar */}
              <Link
                to={`/${selectedChapel.slug}`}
                style={{ color: '#fff', textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <Calendar size={30} strokeWidth={1.8} />
                  <span style={{ fontSize: '0.9rem', marginTop: '6px' }}>
                    Calendar
                  </span>
                </div>
              </Link>

              {/* WhatsApp */}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#fff', textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <MessageCircle size={30} strokeWidth={1.8} />
                  <span style={{ fontSize: '0.9rem', marginTop: '6px' }}>
                    WhatsApp
                  </span>
                </div>
              </a>
            </div>

            <button
              onClick={() => setSelectedChapel(null)}
              style={{
                marginTop: '1rem',
                padding: '8px 16px',
                background: '#6b21a8',
                color: '#fff',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
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
