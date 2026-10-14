import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, id, onClose, children }: { title: string; id: string; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    root.current?.querySelector<HTMLElement>('button')?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]') ?? [])].filter((el) => el.getClientRects().length > 0)
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', keys)
    return () => { window.removeEventListener('keydown', keys); previous?.focus() }
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section ref={root} className="modal managed-modal" role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2 id={id}>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} title="Close"><X size={18} aria-hidden /></button></div>
        {children}
      </section>
    </div>
  )
}
