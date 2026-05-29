import { useEffect, useState } from 'react'
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'

/**
 * TransitLayer — overlays Vienna U-Bahn (subway) and tram lines on the
 * auction map so users can gauge how close each property is to public
 * transport.
 *
 * Data: pre-baked from OpenStreetMap (Overpass) into
 * /public/data/transit-vienna.json — see scripts notes. Coordinates are
 * stored GeoJSON-style [lon, lat]; Leaflet wants [lat, lng], so we flip.
 *
 * Performance: each line is rendered as ONE multi-segment Polyline
 * (positions = array of segments) rather than hundreds of components.
 * The parent map sets `preferCanvas` so all of this draws on a single
 * canvas. Subway is on by default; tram (2900+ segments) is opt-in.
 */

type LonLat = [number, number]

interface TransitData {
  subway: { ref: string; colour: string; coords: LonLat[][] }[]
  stations: { name: string; lon: number; lat: number }[]
  tram: LonLat[][]
}

// GeoJSON [lon, lat] → Leaflet [lat, lng]
const toLatLng = (seg: LonLat[]): [number, number][] =>
  seg.map(([lon, lat]) => [lat, lon])

let cache: TransitData | null = null

export function TransitLayer({
  showSubway,
  showTram,
}: {
  showSubway: boolean
  showTram: boolean
}) {
  const [data, setData] = useState<TransitData | null>(cache)

  useEffect(() => {
    if (cache || (!showSubway && !showTram)) return
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
  }, [showSubway, showTram])

  if (!data) return null

  return (
    <>
      {/* Tram — drawn first so it sits beneath the U-Bahn lines */}
      {showTram && data.tram.length > 0 && (
        <Polyline
          positions={data.tram.map(toLatLng)}
          pathOptions={{ color: '#8A8A8A', weight: 1.5, opacity: 0.55 }}
          interactive={false}
        />
      )}

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
