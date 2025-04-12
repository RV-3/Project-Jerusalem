import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from './utils/sanityClient.js'

export default function LeaderboardPage() {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)

    const fetchLeaderboard = async () => {
      try {
        const chapels = await client.fetch(
          `*[_type == "chapel"]{ _id, name, "slug": slug.current }`
        )

        const reservations = await client.fetch(
          `*[_type == "reservation"]{ _id, chapel }`
        )

        const totals = chapels.map((chapel) => {
          const count = reservations.filter(
            (res) => res.chapel?._ref === chapel._id
          ).length

          return {
            ...chapel,
            totalHours: count
          }
        })

        // Sort descending by hours
        totals.sort((a, b) => b.totalHours - a.totalHours)
        setRanking(totals)
      } catch (err) {
        console.error('Error loading leaderboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  return (
    <div
      style={{
        // Full-screen gradient background
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
      {/* "Main" Button (top-left corner) */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.5rem'
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(90deg, #6b21a8 0%, #8b5cf6 100%)',
            color: '#fff',
            fontWeight: '600',
            fontSize: '1rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            textDecoration: 'none',
            boxShadow: '0 0 8px rgba(139, 92, 246, 0.5)',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
        >
          ⬅ Main
        </Link>
      </div>

      {/* Heading */}
      <h2
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: '2.8rem',
          fontWeight: 700,
          marginBottom: '1rem',
          color: '#ffffff'
        }}
      >
        Leaderboard
      </h2>

      {/* Loading Spinner or Leaderboard */}
      {loading ? (
        <>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div
            style={{
              margin: '2rem auto',
              width: '48px',
              height: '48px',
              border: '6px solid #e5e7eb',
              borderTop: '6px solid #6b21a8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ color: '#9ca3af', marginTop: '1rem' }}>
            Loading leaderboard...
          </p>
        </>
      ) : (
        <div
          style={{
            width: '100%',
            maxWidth: '500px',
            marginTop: '1rem',
            background: 'rgba(31, 31, 60, 0.3)',
            borderRadius: '8px',
            padding: '1rem'
          }}
        >
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ranking.map((chapel, index) => {
              const days = chapel.totalHours / 24
              const daysFormatted = days.toFixed(1)

              return (
                <li
                  key={chapel._id}
                  style={{
                    padding: '0.8rem 0',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#f4f4f5'
                  }}
                >
                  <span style={{ fontWeight: '600' }}>
                    {index + 1}. {chapel.name}
                  </span>
                  <span>
                    {chapel.totalHours} hrs ({daysFormatted} days)
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
