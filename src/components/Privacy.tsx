import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const KEY = 'gazewallet:privacy:v1'
const PrivacyContext = createContext({ hidden: false, toggle: () => {} })

function loadHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === 'hidden'
  } catch {
    return false
  }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(loadHidden)

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) setHidden(loadHidden())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function toggle() {
    const next = !hidden
    setHidden(next)
    try {
      localStorage.setItem(KEY, next ? 'hidden' : 'visible')
    } catch {
      // Privacy still works for this session if storage is unavailable.
    }
  }

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
}

export const usePrivacy = () => useContext(PrivacyContext)

export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy()
  const label = hidden ? 'Show balances' : 'Hide balances'
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label} aria-pressed={hidden}>
      {hidden ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
    </button>
  )
}

export function PrivateValue({ children }: { children: ReactNode }) {
  const { hidden } = usePrivacy()
  return hidden ? <span className="private-value" aria-label="Hidden value">******</span> : <>{children}</>
}
