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
        // 1) Fetch all chapels
        const chapels = await client.fetch(
          `*[_type == "chapel"]{ _id, name, "slug": slug.current }`
        )

        // 2) Fetch only reservations that have ended (past)
        //    If you have a "deleted" or "canceled" field, add:
        //       && deleted != true
        //    or similar to exclude canceled reservations.
        const reservations = await client.fetch(`
          *[_type == "reservation" && end < now()]{
            _id,
            chapel,
            start,
            end
          }
        `)

        // 3) Calculate total hours for each chapel
        const totals = chapels.map(chapel => {
          // Filter reservations for this chapel
          const chapelReservations = reservations.filter(
            res => res.chapel?._ref === chapel._id
          )

          // Sum total hours from 'start' to 'end'
          const totalHours = chapelReservations.reduce((sum, res) => {
            const startTime = new Date(res.start)
            const endTime = new Date(res.end)
            // Convert ms difference to hours
            const diffInHours = (endTime - startTime) / (1000 * 60 * 60)
            return sum + diffInHours
          }, 0)

          return { ...chapel, totalHours }
        })

        // 4) Sort descending by totalHours
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
      {/* MAP Button (with arrow icon) */}
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: 'transparent',
            color: '#9ca3af',
            fontSize: '1rem',
            fontWeight: 500,
            padding: '0.5rem 1rem',
            border: '1px solid #6b7280',
            borderRadius: '6px',
            textDecoration: 'none',
            transition: 'background-color 0.2s ease, color 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#6b7280'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#9ca3af'
          }}
        >
          {/* Arrow Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            style={{ width: '1em', height: '1em' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5l-7.5-7.5m0 0l7.5-7.5m-7.5 7.5h18"
            />
          </svg>
          MAP
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
            maxWidth: '700px',
            marginTop: '1rem',
            background: 'rgba(31, 31, 60, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            overflowX: 'auto'
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left'
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: '0.8rem', color: '#9ca3af' }}>Rank</th>
                <th style={{ padding: '0.8rem', color: '#9ca3af' }}>Chapel</th>
                <th style={{ padding: '0.8rem', color: '#9ca3af' }}>Hours</th>
                <th style={{ padding: '0.8rem', color: '#9ca3af' }}>Days</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((chapel, index) => {
                const totalHours = chapel.totalHours
                const days = totalHours / 24
                const daysFormatted = days.toFixed(1)

                return (
                  <tr
                    key={chapel._id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <td style={{ padding: '0.8rem', fontWeight: '600' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '0.8rem' }}>{chapel.name}</td>
                    <td style={{ padding: '0.8rem' }}>
                      {totalHours.toFixed(1)}
                    </td>
                    <td style={{ padding: '0.8rem' }}>{daysFormatted}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
