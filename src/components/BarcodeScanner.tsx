// Camera barcode scanner using the browser's built-in BarcodeDetector (Chrome / Android WebView).
// No library. Falls back to typing the number printed under the barcode.
import { useEffect, useRef, useState } from 'react'
import { Field, PrimaryButton } from './Sheet'

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
declare global {
  interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }
}

export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(window.BarcodeDetector ? '' : "This browser can't scan barcodes. Type the number under the barcode instead.")
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!window.BarcodeDetector) return
    let stream: MediaStream | null = null
    let stop = false
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => [])
          if (codes[0]?.rawValue) {
            navigator.vibrate?.(40)
            onCode(codes[0].rawValue)
            return
          }
          await new Promise((r) => setTimeout(r, 250))
        }
      } catch {
        setError('Camera access was blocked. Allow the camera, or type the number under the barcode.')
      }
    })()
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])

  return (
    <div>
      {!error && (
        <div className="relative overflow-hidden rounded-[14px] bg-black aspect-[4/3]">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--ring-food)] opacity-80" aria-hidden />
          <p className="absolute bottom-2 inset-x-0 text-center text-[13px] text-white/85">Point at the barcode on the packet</p>
        </div>
      )}
      {error && <p className="mb-3 text-[14px] text-muted-foreground">{error}</p>}
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (typed.length >= 8) onCode(typed) }}>
        <Field label="Or type the barcode number">
          <input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} placeholder="8901058000290" />
        </Field>
        <PrimaryButton disabled={typed.length < 8} className="!bg-[var(--ring-food)]">Look up</PrimaryButton>
      </form>
    </div>
  )
}
