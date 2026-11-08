import React, { useEffect, useRef, Component, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import type { Auction } from '../types/auction'
import { formatPriceLabel, formatCurrency, generateTitle, getPropertyMapColor } from '../utils/formatters'
import { TransitLayer, useTransitData, textOn } from './TransitLayer'

// U-Bahn lines + official colours, for the legend and toggle.
const UBAHN_LINES: { ref: string; colour: string }[] = [
  { ref: 'U1', colour: '#E3000F' },
  { ref: 'U2', colour: '#A862A4' },
  { ref: 'U3', colour: '#EF7C00' },
  { ref: 'U4', colour: '#319F49' },
  { ref: 'U6', colour: '#9D6830' },
]

function createPriceIcon(label: string, isSelected: boolean, isPast: boolean, cat: { bg: string; text: string; border: string }): L.DivIcon {
  const bg = isSelected ? '#B8922A' : isPast ? '#6E685F' : cat.bg
  const textColor = isSelected ? '#FFFFFF' : isPast ? '#C8C4BC' : cat.text
  const border = isSelected ? '#D4A843' : isPast ? '#9A9590' : cat.border
  const opacity = isPast ? '0.7' : '1'
  const scale = isSelected ? 'scale(1.15)' : 'scale(1)'
  // The icon box is a point at the auction's position; the label is centred above
  // it so the arrow tip marks the address whatever the label's width.
  const zIndex = isSelected ? 9999 : 1000

  return L.divIcon({
    className: '',
    html: `
      <div style="position:absolute;left:0;bottom:0;transform:translateX(-50%) ${scale};transform-origin:50% 100%;transition:transform 0.2s ease;z-index:${zIndex};opacity:${opacity};cursor:pointer">
        <div style="
          background:${bg};color:${textColor};border:1.5px solid ${border};border-radius:5px;
          padding:3px 9px;font-size:11px;font-weight:700;white-space:nowrap;
          font-family:Inter,system-ui,sans-serif;letter-spacing:0.03em;line-height:1.4;
          text-align:center;
          ${isSelected ? 'box-shadow:0 0 0 3px rgba(184,146,42,0.25),0 3px 8px rgba(0,0,0,0.4);' : 'box-shadow:0 2px 6px rgba(0,0,0,0.35);'}
        ">${label}</div>
        <div style="
          width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
          border-top:5px solid ${bg};margin:0 auto;position:relative;top:-1px;
        "></div>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  })
}

function validCoord(a: Auction) {
  return isFinite(a.latitude) && isFinite(a.longitude) &&
    a.latitude !== 0 && a.longitude !== 0
}

function MapController({
  selectedId, auctions, initialFit,
}: {
  selectedId: string
  auctions: Auction[]
  initialFit: React.MutableRefObject<boolean>
}) {
  const map = useMap()

  useEffect(() => {
    if (initialFit.current || auctions.length === 0) return
    const valid = auctions.filter(validCoord)
    if (valid.length === 0) return
    try {
      const bounds = L.latLngBounds(valid.map((a) => [a.latitude, a.longitude]))
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
      initialFit.current = true
    } catch {}
  }, [auctions, map, initialFit])

  useEffect(() => {
    if (!selectedId) return
    const auction = auctions.find((a) => a.id === selectedId)
    if (!auction || !validCoord(auction)) return
    try {
      map.flyTo([auction.latitude, auction.longitude], 15, { duration: 0.7 })
    } catch {}
  }, [selectedId, auctions, map])

  return null
}

// Error boundary — catches Leaflet crashes so only the map shows an error,
// not the entire page
class MapErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(e: Error) {
    return { error: e.message }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-cream-50 text-sm text-warm-500 p-6 text-center">
          <div>
            <div className="text-2xl mb-2">🗺️</div>
            <p className="font-medium text-warm-700 mb-1">地图加载失败</p>
            <p className="text-xs text-warm-400">{this.state.error}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-3 px-3 py-1.5 bg-forest-700 text-cream-100 text-xs rounded"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

interface Props {
  auctions: Auction[]
  selectedId: string
  onSelect: (id: string) => void
}

const LAYERS = {
  light: {
    label: '地图',
    // Austria's official basemap: free, no API key, native detail down to z19.
    url: 'https://mapsneu.wien.gv.at/basemap/bmapgrau/normal/google3857/{z}/{y}/{x}.png',
    attr: 'Grundkarte: <a href="https://basemap.at">basemap.at</a>',
    sub: undefined,
    maxNativeZoom: 19,
  },
  osm: {
    label: '街道',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap contributors',
    sub: 'abc',
    maxNativeZoom: 19,
  },
  satellite: {
    label: '卫星',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri',
    sub: undefined,
    maxNativeZoom: 19,
  },
}
type LayerKey = keyof typeof LAYERS

/** Several auctions at one address share one pin at the real position. */
function groupLabel(group: Auction[]): string {
  const min = Math.min(...group.map((a) => a.minimumBid).filter((v) => v > 0))
  return isFinite(min) ? `${group.length} 套 · ${formatPriceLabel(min)} 起` : `${group.length} 套`
}

export function MapView({ auctions, selectedId, onSelect }: Props) {
  const initialFit = useRef(false)
  const today = new Date().toISOString().split('T')[0]
  const validAuctions = auctions.filter(validCoord)
  const [layer, setLayer] = useState<LayerKey>('light')
  const [showSubway, setShowSubway] = useState(true)
  const [showTram, setShowTram] = useState(false)
  const transit = useTransitData(showSubway || showTram)
  const current = LAYERS[layer]

  // Group auctions by coordinate key
  const coordGroups = useMemo(() => {
    const groups = new Map<string, Auction[]>()
    for (const a of validAuctions) {
      const key = `${a.latitude.toFixed(4)},${a.longitude.toFixed(4)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(a)
    }
    return groups
  }, [validAuctions])

  return (
    <div className="relative w-full h-full">
      {/* Layer switcher */}
      <div className="absolute top-3 right-3 z-[1000] flex rounded-lg overflow-hidden shadow-md border border-cream-200">
        {(Object.keys(LAYERS) as LayerKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setLayer(k)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              layer === k
                ? 'bg-forest-700 text-cream-100'
                : 'bg-white text-warm-600 hover:bg-cream-50'
            }`}
          >
            {LAYERS[k].label}
          </button>
        ))}
      </div>

      {/* Transit toggle + line legends */}
      <div className="absolute bottom-3 left-3 z-[1000] max-w-[min(320px,calc(100%-72px))] rounded-lg overflow-hidden shadow-md border border-cream-200 bg-white/95 backdrop-blur-sm">
        <div className="flex">
          <button
            onClick={() => setShowSubway((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-cream-200 ${
              showSubway ? 'bg-forest-700 text-cream-100' : 'bg-white text-warm-600 hover:bg-cream-50'
            }`}
          >
            🚇 地铁
          </button>
          <button
            onClick={() => setShowTram((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              showTram ? 'bg-forest-700 text-cream-100' : 'bg-white text-warm-600 hover:bg-cream-50'
            }`}
          >
            🚊 电车
          </button>
        </div>
        {showSubway && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-cream-200">
            {UBAHN_LINES.map((l) => (
              <span key={l.ref} className="inline-flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.colour }} />
                <span className="text-[10px] font-semibold text-warm-600">{l.ref}</span>
              </span>
            ))}
          </div>
        )}
        {showTram && transit && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-cream-200">
            {transit.tram.map((l) => (
              <span
                key={l.ref}
                className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1 rounded text-[11px] font-bold tabular-nums"
                style={{ backgroundColor: l.colour, color: textOn(l.colour) }}
              >
                {l.ref}
              </span>
            ))}
          </div>
        )}
      </div>

      <MapErrorBoundary>
        <MapContainer
          center={[48.21, 16.37]}
          zoom={12}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={true}
          preferCanvas={true}
        >
          <TileLayer
            key={layer}
            url={current.url}
            attribution={current.attr}
            subdomains={current.sub ?? 'abc'}
            maxNativeZoom={current.maxNativeZoom}
            maxZoom={current.maxNativeZoom}
          />
          <ZoomControl position="bottomright" />

          <MapController
            selectedId={selectedId}
            auctions={validAuctions}
            initialFit={initialFit}
          />

          <TransitLayer data={transit} showSubway={showSubway} showTram={showTram} />

          {[...coordGroups.entries()].map(([coordKey, group]) => {
            if (group.length > 1) {
              const isSelected = group.some((a) => a.id === selectedId)
              const isPast = group.every((a) => a.auctionDate < today)
              const types = new Set(group.map((a) => getPropertyMapColor(a).bg))
              const colour = types.size === 1
                ? getPropertyMapColor(group[0])
                : { bg: '#1D3A2A', text: '#FFFFFF', border: '#1D3A2A' }
              return (
                <Marker
                  key={coordKey}
                  position={[group[0].latitude, group[0].longitude]}
                  icon={createPriceIcon(groupLabel(group), isSelected, isPast, colour)}
                  zIndexOffset={isSelected ? 2000 : 500}
                >
                  <Popup maxWidth={320} autoPanPaddingTopLeft={[24, 60]} autoPanPaddingBottomRight={[24, 24]}>
                    <GroupList group={group} selectedId={selectedId} onSelect={onSelect} />
                  </Popup>
                </Marker>
              )
            }

            const auction = group[0]
            const isSelected = auction.id === selectedId
            return (
              <Marker
                key={auction.id}
                position={[auction.latitude, auction.longitude]}
                icon={createPriceIcon(
                  formatPriceLabel(auction.minimumBid),
                  isSelected,
                  auction.auctionDate < today,
                  getPropertyMapColor(auction),
                )}
                zIndexOffset={isSelected ? 2000 : 0}
                eventHandlers={{ click: () => onSelect(auction.id) }}
              >
                <Tooltip direction="top" offset={[0, -32]} opacity={1} className="leaflet-custom-tooltip">
                  <MapTooltip auction={auction} />
                </Tooltip>
              </Marker>
            )
          })}
        </MapContainer>
      </MapErrorBoundary>

    </div>
  )
}

/** Every auction at one address, cheapest first, in the same format as a single pin's tooltip. */
function GroupList({
  group,
  selectedId,
  onSelect,
}: {
  group: Auction[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const rows = [...group].sort((a, b) => a.minimumBid - b.minimumBid)
  return (
    <div className="w-[280px] max-w-[calc(100vw-48px)]">
      <div className="pl-3 pr-8 pt-3 pb-2 border-b border-cream-200">
        <div className="text-sm font-semibold text-forest-700 leading-snug">同一地址 {group.length} 套</div>
        <div className="text-xs text-warm-600 leading-tight mt-1">{group[0].address}</div>
      </div>
      <ul className="max-h-[200px] md:max-h-[300px] overflow-y-auto">
        {rows.map((a) => {
          const active = a.id === selectedId
          return (
            <li key={a.id} className="border-b border-cream-200 last:border-b-0">
              <button
                type="button"
                // Picking the open one again keeps it open rather than toggling it shut.
                onClick={() => { if (!active) onSelect(a.id) }}
                className={`w-full text-left p-3 transition-colors ${active ? 'bg-gold-500/15' : 'hover:bg-cream-50'}`}
              >
                <AuctionSummary auction={a} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MapTooltip({ auction }: { auction: Auction }) {
  return (
    <div className="p-3 min-w-[220px] max-w-[280px]">
      <AuctionSummary auction={auction} showAddress />
    </div>
  )
}

/** Title, prices, date and case number: one auction on the map. */
function AuctionSummary({ auction, showAddress = false }: { auction: Auction; showAddress?: boolean }) {
  return (
    <>
      <div className="text-sm font-semibold text-forest-700 leading-snug mb-1 tabular-nums">
        {generateTitle(auction)}
      </div>
      {showAddress && <div className="text-xs text-warm-600 mb-2 leading-tight">{auction.address}</div>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <span className="text-warm-400">起拍价</span>
          <div className="font-semibold text-gold-600 tabular-nums">{formatCurrency(auction.minimumBid)}</div>
        </div>
        <div>
          <span className="text-warm-400">估值</span>
          <div className="font-semibold text-warm-700 tabular-nums">{formatCurrency(auction.estimatedValue)}</div>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-warm-400 tabular-nums">
        📅 {auction.auctionDate} · 案号 {auction.caseNumber}
      </div>
    </>
  )
}
