import { lazy, Suspense, useCallback, useState } from 'react'
import { Plus, ScanLine } from 'lucide-react'
import { makeAccount } from '../lib/chains'
import type { AccountView, ChainId } from '../lib/chains/types'
import { accountIdentity, candidateWarnings } from '../lib/account-overlap'
import { parseWatchInput } from '../lib/watch-input'
import { usePrivacy } from './Privacy'

const QrScanner = lazy(() => import('./QrScanner'))

export function AddAccount({ views, chain, onAdd }: { views: AccountView[]; chain?: ChainId; onAdd: (input: string, label?: string) => string | null }) {
  const { hidden } = usePrivacy()
  const [input, setInput] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [scanner, setScanner] = useState(false)
  const closeScanner = useCallback(() => setScanner(false), [])

  function change(value: string) { setInput(value); setWarnings([]); setAcknowledged(false); setError('') }
  function read(text: string) {
    setScanner(false)
    try {
      const parsed = parseWatchInput(text)
      change(parsed.value)
      if (!label && parsed.label) setLabel(parsed.label)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unsupported QR content') }
  }

  function add() {
    setError('')
    try {
      const parsed = parseWatchInput(input)
      const account = makeAccount(parsed.value, label || parsed.label)
      if (chain && account.chain !== chain) throw new Error(`This address does not belong to ${chain.toUpperCase()}`)
      if (views.some((v) => accountIdentity(v.account) === accountIdentity(account))) throw new Error('This key/address is already on the list')
      const found = candidateWarnings(account, views)
      if (found.length && !acknowledged) { setWarnings(found); return }
      const message = onAdd(account.value, account.label)
      if (message) throw new Error(message)
      change(''); setLabel(''); setWarnings([])
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid public key or address') }
  }

  return (
    <>
      <form className="account-form" onSubmit={(e) => { e.preventDefault(); add() }}>
        <div className="add">
          <input type={hidden ? 'password' : 'text'} autoComplete="off" aria-label="Public key or address" value={input} onChange={(e) => change(e.target.value)} placeholder={chain === 'eth' ? '0x... Ethereum address' : chain === 'btc' ? 'xpub / ypub / zpub or BTC address' : 'BTC public key / address or ETH address'} spellCheck={false} autoCapitalize="off" required />
          <button type="button" className="icon-btn scan-button" onClick={() => setScanner(true)} aria-label="Scan QR code" title="Scan QR code"><ScanLine size={20} aria-hidden /></button>
          <button type="submit" className="primary add-button"><Plus size={17} aria-hidden /><span>{warnings.length ? 'Add anyway' : 'Add'}</span></button>
        </div>
        <input className="label-add" aria-label="Account label" placeholder="Label (optional)" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        {warnings.map((warning) => <p className="overlap-warning" key={warning} role="status">{warning}</p>)}
        {warnings.length > 0 && <label className="check-setting"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />I understand the double-counting risk</label>}
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      {scanner && <Suspense fallback={<p className="section-status">Loading QR scanner...</p>}><QrScanner onRead={read} onClose={closeScanner} /></Suspense>}
    </>
  )
}
