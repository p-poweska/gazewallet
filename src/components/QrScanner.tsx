import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'
import { Modal } from './Modal'

export default function QrScanner({ onRead, onClose }: { onRead: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<IScannerControls>()
  const stream = useRef<MediaStream>()
  const active = useRef(true)
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function stop() {
    controls.current?.stop()
    controls.current = undefined
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = undefined
  }

  useEffect(() => {
    active.current = true
    return () => { active.current = false; stop() }
  }, [])

  async function camera() {
    setBusy(true); setError(''); setRunning(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS and a supported browser. You can use an image instead.')
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (!active.current) { media.getTracks().forEach((track) => track.stop()); return }
      stream.current = media
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (!active.current || !video.current) { stop(); return }
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 300 })
      const result = await reader.decodeFromStream(media, video.current, (qr, _error, scan) => {
        if (qr && active.current) { scan.stop(); stop(); onRead(qr.getText()) }
      })
      if (!active.current) result.stop()
      else controls.current = result
    } catch (e) {
      stop()
      if (active.current) { setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Camera permission denied. Choose a QR image or paste the address.' : e instanceof Error ? e.message : 'Could not start camera'); setRunning(false) }
    } finally { if (active.current) setBusy(false) }
  }

  async function image(file?: File) {
    if (!file) return
    stop(); setRunning(false); setBusy(true); setError('')
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP image smaller than 10 MB')
      const data = await new Promise<string>((resolve, reject) => {
        const fileReader = new FileReader()
        fileReader.onload = () => resolve(String(fileReader.result))
        fileReader.onerror = () => reject(new Error('Could not read image'))
        fileReader.readAsDataURL(file)
      })
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const qr = await new BrowserQRCodeReader().decodeFromImageUrl(data)
      if (active.current) onRead(qr.getText())
    } catch (e) {
      if (active.current) setError(e instanceof Error && e.message ? e.message : 'No readable QR code found in this image')
    } finally { if (active.current) setBusy(false) }
  }

  return (
    <Modal title="Scan QR" id="qr-title" onClose={onClose}>
        <div className="qr-preview">{running ? <video ref={video} muted playsInline aria-label="Camera preview" /> : <Camera size={36} aria-hidden />}</div>
        <div className="form-actions">
          <button type="button" className="secondary" disabled={busy || running} onClick={camera}><Camera size={16} aria-hidden />Use camera</button>
          <label className="secondary file-action"><ImagePlus size={16} aria-hidden />Choose image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => { void image(e.target.files?.[0]); e.target.value = '' }} /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
    </Modal>
  )
}
