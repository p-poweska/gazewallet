import { useEffect, useState } from 'react'

export function useDataEnvironment() {
  const [environment, setEnvironment] = useState(() => ({ online: navigator.onLine, now: Date.now() }))

  useEffect(() => {
    const update = () => setEnvironment({ online: navigator.onLine, now: Date.now() })
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return environment
}
