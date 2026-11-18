// Route map (Leaflet + OpenStreetMap tiles; attribution required by OSM). Needs internet for the map tiles only.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

export function RouteMap({ points, follow = false, height = 260 }: { points: [number, number][]; follow?: boolean; height?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const line = useRef<L.Polyline | null>(null)
  const dot = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0E9F8E'
    line.current = L.polyline([], { color, weight: 5, opacity: 0.9, lineJoin: 'round' }).addTo(m)
    dot.current = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 })
    m.setView([20.59, 78.96], 4) // India until we have a fix
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !line.current || !dot.current) return
    line.current.setLatLngs(points)
    if (!points.length) return
    const last = points[points.length - 1]
    dot.current.setLatLng(last)
    if (!m.hasLayer(dot.current)) dot.current.addTo(m)
    if (follow) m.setView(last, Math.max(m.getZoom(), 17), { animate: true })
    else if (points.length > 1) m.fitBounds(line.current.getBounds(), { padding: [24, 24] })
    else m.setView(last, 17)
  }, [points, follow])

  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-[var(--radius)]" role="img" aria-label="Map of the route" />
}
