import { useCallback, useRef, useState } from 'react'
import { Download, Upload, LockKeyhole } from 'lucide-react'
import type { Account } from '../lib/chains/types'
import { accountIdentity, portfolioOverlapWarning } from '../lib/account-overlap'
import { exportBackup, importBackup, isEncryptedBackup, MAX_BACKUP_BYTES, mergeAccounts, type BackupPayload, type BackupSettings } from '../lib/backup'
import { Modal } from './Modal'
import { PrivateValue } from './Privacy'

export function BackupControls({ accounts, settings, onImport }: { accounts: Account[]; settings: BackupSettings; onImport: (backup: BackupPayload, mode: 'merge' | 'replace', restoreSettings: boolean) => void }) {
  const [open, setOpen] = useState<'export' | 'import' | null>(null)
  const [encrypt, setEncrypt] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [text, setText] = useState('')
  const [encryptedFile, setEncryptedFile] = useState(false)
  const [preview, setPreview] = useState<BackupPayload | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [restore, setRestore] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef(0)
  const close = useCallback(() => {
    operation.current++
    setOpen(null); setPassword(''); setConfirm(''); setText(''); setPreview(null); setError(''); setBusy(false); setEncryptedFile(false)
  }, [])

  async function read(file?: File) {
    if (!file) return
    const id = ++operation.current
    setBusy(true); setError(''); setPreview(null); setPassword(''); setEncryptedFile(false); setText('')
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup must be smaller than 5 MB')
      const raw = await file.text()
      if (id !== operation.current) return
      setText(raw)
      const encrypted = isEncryptedBackup(raw)
      setEncryptedFile(encrypted)
      if (!encrypted) {
        const parsed = await importBackup(raw)
        if (id === operation.current) setPreview(parsed)
      }
    } catch (e) { if (id === operation.current) setError(e instanceof Error ? e.message : 'Could not read backup') }
    finally { if (id === operation.current) setBusy(false) }
  }

  async function unlock() {
    const id = ++operation.current
    setBusy(true); setError('')
    try {
      const parsed = await importBackup(text, password)
      if (id === operation.current) { setPreview(parsed); setPassword('') }
    } catch (e) { if (id === operation.current) setError(e instanceof Error ? e.message : 'Could not unlock backup') }
    finally { if (id === operation.current) setBusy(false) }
  }

  async function download() {
    const id = ++operation.current
    setBusy(true); setError('')
    try {
      if (encrypt && password !== confirm) throw new Error('Passwords do not match')
      const data = await exportBackup(accounts, settings, encrypt ? password : undefined)
      if (id !== operation.current) return
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `gazewallet-${encrypt ? 'encrypted-' : ''}backup.json`
      document.body.append(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      close()
    } catch (e) { if (id === operation.current) setError(e instanceof Error ? e.message : 'Could not export backup') }
    finally { if (id === operation.current) setBusy(false) }
  }

  const incomingNew = preview?.accounts.filter((a) => !accounts.some((current) => accountIdentity(current) === accountIdentity(a))).length ?? 0
  let desired: Account[] = []
  let mergeError = ''
  try { desired = preview ? mode === 'merge' ? mergeAccounts(accounts, preview.accounts) : preview.accounts : [] }
  catch (e) { mergeError = e instanceof Error ? e.message : 'Could not merge accounts' }
  const warning = portfolioOverlapWarning(desired.map((account) => ({ account, isLoading: false, isFetching: false, isError: false, dataUpdatedAt: 0 })))

  return (
    <>
      <footer className="footer backup-controls">
        <button type="button" onClick={() => { setEncrypt(false); setOpen('export') }}><Download size={16} aria-hidden />Export backup</button>
        <button type="button" onClick={() => { setMode('merge'); setRestore(true); setOpen('import') }}><Upload size={16} aria-hidden />Import backup</button>
      </footer>
      {open && <Modal title={open === 'export' ? 'Export backup' : 'Import backup'} id="backup-title" onClose={close}>
        {open === 'export' ? (
          <>
            <p className="section-note">Accounts, labels and settings. History and API caches are not included.</p>
            <label className="check-setting"><input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />Encrypt with a password</label>
            {encrypt ? <>
              <label className="field-label">Backup password<input type="password" autoComplete="new-password" value={password} maxLength={1024} onChange={(e) => setPassword(e.target.value)} /></label>
              <label className="field-label">Confirm password<input type="password" autoComplete="new-password" value={confirm} maxLength={1024} onChange={(e) => setConfirm(e.target.value)} /></label>
              <p className="section-note">Minimum 12 characters. A lost password cannot be recovered.</p>
            </> : <p className="overlap-warning">Unencrypted backups reveal your public keys, addresses and labels.</p>}
            <button type="button" className="primary backup-primary" disabled={busy} onClick={download}>{encrypt && <LockKeyhole size={16} aria-hidden />}{busy ? 'Creating backup...' : 'Download backup'}</button>
          </>
        ) : (
          <>
            <label className="field-label">Backup file<input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => { void read(e.target.files?.[0]) }} /></label>
            {encryptedFile && !preview && <>
              <label className="field-label">Backup password<input type="password" autoComplete="current-password" value={password} maxLength={1024} onChange={(e) => setPassword(e.target.value)} /></label>
              <button type="button" className="secondary" disabled={busy} onClick={unlock}><LockKeyhole size={16} aria-hidden />{busy ? 'Unlocking...' : 'Unlock backup'}</button>
            </>}
            {preview && <>
              <p className="section-note">{preview.accounts.length} accounts · {incomingNew} new · {preview.accounts.length - incomingNew} already watched</p>
              <ul className="backup-preview">{preview.accounts.map((a) => <li key={a.id}><strong>{a.chain.toUpperCase()}</strong><span>{a.label || 'Unlabelled account'}</span><code><PrivateValue>{a.value}</PrivateValue></code></li>)}</ul>
              <div className="backup-modes" role="group" aria-label="Import mode">
                <button type="button" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>Merge</button>
                <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>Replace</button>
              </div>
              <p className="section-note">{mode === 'merge' ? 'Existing accounts and labels are kept. Missing labels are filled from the backup.' : 'Your watched account list will be replaced by this backup.'}</p>
              {preview.settings && <label className="check-setting"><input type="checkbox" checked={restore} onChange={(e) => setRestore(e.target.checked)} />Restore settings ({preview.settings.currency}, privacy {preview.settings.privacyHidden ? 'hidden' : 'visible'})</label>}
              {warning && <p className="overlap-warning">{warning}</p>}
              {mergeError && <p className="error" role="alert">{mergeError}</p>}
              <button type="button" className="primary backup-primary" disabled={busy || !!mergeError} onClick={() => {
                try { onImport(preview, mode, restore && !!preview.settings); close() }
                catch (e) { setError(e instanceof Error ? e.message : 'Could not restore backup') }
              }}>Apply {mode === 'merge' ? 'merge' : 'replacement'}</button>
            </>}
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Modal>}
    </>
  )
}
