// Bottom sheet built on <dialog> (focus trap, Esc to close, backdrop for free).
import { useEffect, useRef, type ReactNode } from 'react'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/55 open:flex open:flex-col"
      style={{ maxHeight: '92dvh' }}
    >
      <div className="mx-auto w-full max-w-[480px] rounded-t-[22px] bg-surface text-ink pb-safe">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted text-[14px] px-2 py-1">Close</button>
        </div>
        <div className="max-h-[78dvh] overflow-y-auto px-5 pb-6">{open && children}</div>
      </div>
    </dialog>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-[13px] text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted mt-1">{hint}</span>}
    </label>
  )
}

export function PrimaryButton({ children, tone = 'money', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'money' | 'body' }) {
  return (
    <button
      {...p}
      className={`w-full rounded-[12px] py-3 text-[16px] font-semibold text-[#0E1822] disabled:opacity-40 ${tone === 'body' ? 'bg-body' : 'bg-money'} ${p.className ?? ''}`}
    >
      {children}
    </button>
  )
}
