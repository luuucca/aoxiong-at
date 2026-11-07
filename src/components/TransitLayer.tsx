import { useEffect, useState } from 'react'
import L from 'leaflet'
import { Polyline, CircleMarker, Marker, Tooltip } from 'react-leaflet'

/**
 * TransitLayer — overlays Vienna U-Bahn (subway) and tram lines on the
 * auction map so users can gauge how close each property is to public
 * transport.
 *
 * Data: pre-baked from OpenStreetMap (Overpass) into
 * /public/data/transit-vienna.json (trams: scripts/build-tram-lines.mjs).
 * Coordinates are stored GeoJSON-style [lon, lat]; Leaflet wants [lat, lng],
 * so we flip.
 *
 * Performance: each line is rendered as ONE multi-segment Polyline
 * (positions = array of segments) rather than hundreds of components.
 * The parent map sets `preferCanvas` so all of this draws on a single
 * canvas. Subway is on by default; tram is opt-in.
 */

type LonLat = [number, number]

export interface TramLine {
  ref: string
  colour: string
  label: LonLat
  coords: LonLat[][]
}

export interface TransitData {
  subway: { ref: string; colour: string; coords: LonLat[][] }[]
  stations: { name: string; lon: number; lat: number }[]
  tram: TramLine[]
}

// GeoJSON [lon, lat] → Leaflet [lat, lng]
const toLatLng = (seg: LonLat[]): [number, number][] =>
  seg.map(([lon, lat]) => [lat, lon])

/** Dark or white text, whichever reads better on a line colour. */
export function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#141414' : '#FFFFFF'
}

let cache: TransitData | null = null

export function useTransitData(enabled: boolean): TransitData | null {
  const [data, setData] = useState<TransitData | null>(cache)

  useEffect(() => {
    if (cache || !enabled) return
    let cancelled = false
    fetch('/data/transit-vienna.json')
      .then((r) => r.json())
      .then((d: TransitData) => {
        cache = d
        if (!cancelled) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled])

  return data
}

function tramLabelIcon(line: TramLine): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="min-width:20px;height:18px;padding:0 4px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:4px;border:1.5px solid #FFFFFF;background:${line.colour};color:${textOn(line.colour)};font:700 11px/1 Inter,system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${line.ref}</div>`,
    iconSize: [24, 18],
    iconAnchor: [12, 9],
  })
}

export function TransitLayer({
  data,
  showSubway,
  showTram,
}: {
  data: TransitData | null
  showSubway: boolean
  showTram: boolean
}) {
  if (!data) return null

  return (
    <>
      {/* Tram — drawn first so it sits beneath the U-Bahn lines. A white edge keeps
          each line readable on the grey basemap and where lines run side by side. */}
      {showTram &&
        data.tram.map((line) => (
          <Polyline
            key={`edge-${line.ref}`}
            positions={line.coords.map(toLatLng)}
            pathOptions={{ color: '#FFFFFF', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
            interactive={false}
          />
        ))}
      {showTram &&
        data.tram.map((line) => (
          <Polyline
            key={line.ref}
            positions={line.coords.map(toLatLng)}
            pathOptions={{ color: line.colour, weight: 3, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
          >
            <Tooltip sticky opacity={1}>
              <span style={{ fontWeight: 600 }}>电车 {line.ref} 路</span>
            </Tooltip>
          </Polyline>
        ))}
      {showTram &&
        data.tram.map((line) => (
          <Marker
            key={`label-${line.ref}`}
            position={[line.label[1], line.label[0]]}
            icon={tramLabelIcon(line)}
            interactive={false}
            keyboard={false}
            zIndexOffset={-500}
          />
        ))}

      {/* U-Bahn lines — official colours */}
      {showSubway &&
        data.subway.map((line) => (
          <Polyline
            key={line.ref}
            positions={line.coords.map(toLatLng)}
            pathOptions={{
              color: line.colour || '#888',
              weight: 4,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            interactive={false}
          />
        ))}

      {/* U-Bahn stations */}
      {showSubway &&
        data.stations.map((s) => (
          <CircleMarker
            key={s.name}
            center={[s.lat, s.lon]}
            radius={3.5}
            pathOptions={{
              color: '#1a1a1a',
              weight: 1.5,
              fillColor: '#ffffff',
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <span style={{ fontWeight: 600 }}>🚇 {s.name}</span>
            </Tooltip>
          </CircleMarker>
        ))}
    </>
  )
}
