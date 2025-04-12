// WelcomePage.js
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Modal from 'react-modal'
import client from './utils/sanityClient.js'
import {
  Menu as MenuIcon,
  ChevronDown,
  ChevronUp,
  Calendar,
  MessageCircle
} from 'lucide-react'

Modal.setAppElement('#root')

/**
 * (Optional) If you want bigger icons on small screens
 */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  )

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= breakpoint)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

export default function WelcomePage() {
  const [chapels, setChapels] = useState([])
  const [selectedChapel, setSelectedChapel] = useState(null)
  // Controls the slide-out sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isMobile = useIsMobile(768)

  // Fetch chapel data
  useEffect(() => {
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

  // Convert block-based description to plain text
  function parseDescription(blocks) {
    if (!blocks || !Array.isArray(blocks)) return ''
    return blocks
      .map((block) => {
        if (!block.children) return ''
        return block.children.map((span) => span.text).join('')
      })
      .join('\n\n')
  }

  // Build WhatsApp link from phone number
  function getWhatsappLink(num) {
    if (!num || !num.trim()) {
      return 'https://wa.me/0000000000'
    }
    const cleaned = num.replace(/\D+/g, '')
    return `https://wa.me/${cleaned}`
  }

  // Chapel info for the modal
  let displayedDesc = ''
  let whatsappLink = ''
  let chapelImageUrl = ''
  if (selectedChapel) {
    displayedDesc = parseDescription(selectedChapel.description)
    whatsappLink = getWhatsappLink(selectedChapel.whatsappNumber)
    chapelImageUrl = selectedChapel.chapelImage?.asset?.url || ''
  }

  // The sidebar slides out from the right
  const SIDEBAR_WIDTH = 240

  // We'll use a `transform: translateX(...)` approach for the main container
  const mainSlideX = sidebarOpen ? -SIDEBAR_WIDTH : 0

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1b1b2f 100%)',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* MAIN CONTAINER that we transform left by SIDEBAR_WIDTH if open */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',   // so it can't shrink on iPhone
          height: '100vh',
          transform: `translateX(${mainSlideX}px)`,
          transition: 'transform 0.3s ease',
          // "display: flex; flex-direction: column; align-items: center; etc." for your layout
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Collapsed: top-right corner => Menu icon + Down arrow */}
        {!sidebarOpen && (
          <header
            style={{
              width: '100%',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              background: 'transparent'
            }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
                gap: '0.3rem'
              }}
            >
              <MenuIcon size={isMobile ? 32 : 24} strokeWidth={1.8} />
              <ChevronDown size={isMobile ? 32 : 24} strokeWidth={1.8} />
            </button>
          </header>
        )}

        {/* MAIN CONTENT */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
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

          {/* Chapel buttons */}
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
                  transition: 'transform 0.2s ease, opacity 0.2s ease',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = 'scale(1.05)')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = 'scale(1)'
                )}
                onMouseDown={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {chapelItem.name}
              </button>
            ))}
          </div>
        </main>
      </div>

      {/* SIDEBAR => if open => 240, else => 0 */}
      <aside
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          height: '100%',
          background: '#1f1f3c',
          borderLeft: '1px solid #6b21a8',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001
        }}
      >
        {/* If open => top row => Menu icon + "Menu" + up arrow */}
        {sidebarOpen && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid #6b21a8',
              gap: '0.3rem'
            }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
                gap: '0.3rem'
              }}
            >
              <MenuIcon size={isMobile ? 32 : 24} strokeWidth={1.8} />
              <span style={{ fontWeight: 500 }}>Menu</span>
              <ChevronUp size={isMobile ? 32 : 24} strokeWidth={1.8} />
            </button>
          </div>
        )}

        {/* Sidebar links */}
        <nav
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem'
          }}
        >
          <Link
            to="/leaderboard"
            style={{
              color: '#fff',
              textDecoration: 'none',
              marginBottom: '1rem',
              fontSize: '1.1rem',
              transition: 'color 0.2s ease, transform 0.2s ease'
            }}
            onClick={() => setSidebarOpen(false)}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#ddd'
              e.currentTarget.style.transform = 'scale(1.01)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseDown={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Leaderboard
          </Link>

          <Link
            to="/leaderboard"
            style={{
              color: '#fff',
              textDecoration: 'none',
              marginBottom: '1rem',
              fontSize: '1.1rem',
              transition: 'color 0.2s ease, transform 0.2s ease'
            }}
            onClick={() => setSidebarOpen(false)}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#ddd'
              e.currentTarget.style.transform = 'scale(1.01)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseDown={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Manager

          </Link>

          <Link
            to="/leaderboard"
            style={{
              color: '#fff',
              textDecoration: 'none',
              marginBottom: '1rem',
              fontSize: '1.1rem',
              transition: 'color 0.2s ease, transform 0.2s ease'
            }}
            onClick={() => setSidebarOpen(false)}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#ddd'
              e.currentTarget.style.transform = 'scale(1.01)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseDown={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Map
            
          </Link>
          {/* More links, etc. */}
        </nav>
      </aside>

      {/* Chapel Info Modal */}
      <Modal
        isOpen={!!selectedChapel}
        onRequestClose={() => setSelectedChapel(null)}
        contentLabel="Chapel Info"
        style={{
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 2000
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

            {chapelImageUrl ? (
              <div
                style={{
                  width: '100%',
                  height: '200px',
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
              {/* Calendar link (hover effect) */}
              <Link
                to={`/${selectedChapel.slug}`}
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#ddd'
                  e.currentTarget.style.transform = 'scale(1.01)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Calendar size={30} strokeWidth={1.8} />
                <span style={{ fontSize: '0.9rem', marginTop: '6px' }}>
                  Calendar
                </span>
              </Link>

              {/* WhatsApp link (same hover effect) */}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#ddd'
                  e.currentTarget.style.transform = 'scale(1.01)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <MessageCircle size={30} strokeWidth={1.8} />
                <span style={{ fontSize: '0.9rem', marginTop: '6px' }}>
                  Contact
                </span>
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
