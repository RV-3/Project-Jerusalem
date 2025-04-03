// src/utils/LiveClock.js
import React, { useEffect, useState } from 'react'

function LiveClock({ timezone = 'Asia/Jerusalem' }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    function updateTime() {
      const now = new Date().toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      })
      setTime(now)
    }

    updateTime()
    const intervalId = setInterval(updateTime, 1000)
    return () => clearInterval(intervalId)
  }, [timezone])

  return (
    <div style={{ fontWeight: 'bold', margin: '1rem 0' }}>
      {time}
    </div>
  )
}

export default LiveClock
