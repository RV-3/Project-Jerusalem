import React, { useEffect, useState } from 'react'

function JerusalemClock() {
  const [jerusalemTime, setJerusalemTime] = useState('')

  useEffect(() => {
    function updateTime() {
      // Format using locale strings, specifying Asia/Jerusalem
      const nowInJerusalem = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Jerusalem',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })
      setJerusalemTime(nowInJerusalem)
    }

    // Update right away and then every second
    updateTime()
    const intervalId = setInterval(updateTime, 1000)

    // Cleanup on unmount
    return () => clearInterval(intervalId)
  }, [])

  return (
    <div style={{ fontWeight: 'bold', margin: '1rem 0' }}>
       {jerusalemTime}
    </div>
  )
}

export default JerusalemClock
