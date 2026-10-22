import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const KEY = 'gazewallet:privacy:v1'
const PrivacyContext = createContext({ hidden: false, toggle: () => {}, setHidden: (_value: boolean) => {} })

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

  function changeHidden(next: boolean) {
    setHidden(next)
    try {
      localStorage.setItem(KEY, next ? 'hidden' : 'visible')
    } catch {
      // Privacy still works for this session if storage is unavailable.
    }
  }

  return <PrivacyContext.Provider value={{ hidden, toggle: () => changeHidden(!hidden), setHidden: changeHidden }}>{children}</PrivacyContext.Provider>
}

export const usePrivacy = () => useContext(PrivacyContext)

export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy()
  const label = hidden ? 'Show balances' : 'Hide balances'
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label} aria-pressed={hidden}>
      {/* The lid closes over the pupil in privacy mode, matching the logo. */}
      <svg className={`eye-icon${hidden ? ' eye-icon--closed' : ''}`} viewBox="-12 -12 24 24" aria-hidden="true">
        <path className="eye-icon-lid" d="M-9 0Q0 -11 9 0Q0 11 -9 0Z" />
        <circle className="eye-icon-pupil" r="2.6" />
      </svg>
    </button>
  )
}

export function PrivateValue({ children }: { children: ReactNode }) {
  const { hidden } = usePrivacy()
  return hidden ? <span className="private-value" aria-label="Hidden value">******</span> : <>{children}</>
}
