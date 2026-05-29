import React, { useEffect, useRef, Component, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import type { Auction } from '../types/auction'
import { formatPriceLabel, formatCurrency, generateTitle } from '../utils/formatters'
import { TransitLayer } from './TransitLayer'

// U-Bahn lines + official colours, for the legend and toggle.
const UBAHN_LINES: { ref: string; colour: string }[] = [
  { ref: 'U1', colour: '#E3000F' },
  { ref: 'U2', colour: '#A862A4' },
  { ref: 'U3', colour: '#EF7C00' },
  { ref: 'U4', colour: '#319F49' },
  { ref: 'U6', colour: '#9D6830' },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Eigentumswohnung:         { bg: '#1A4A7A', text: '#A8D4FF', border: '#5B9BD5' },
  Wohnungseigentumsobjekt:  { bg: '#1A4A7A', text: '#A8D4FF', border: '#5B9BD5' },
  Einfamilienhaus:          { bg: '#1D3A2A', text: '#7EC8A0', border: '#3D8A60' },
  Mehrfamilienhaus:         { bg: '#2A4A3A', text: '#A8E6C8', border: '#4DAA80' },
  Mietshaus:                { bg: '#5C3A00', text: '#FFD080', border: '#C87800' },
  'gewerbliche Liegenschaft':{ bg: '#4A1A6A', text: '#D4A8FF', border: '#8A5BBD' },
  Sonstiges:                { bg: '#4A4A4A', text: '#D4D4D4', border: '#888888' },
}

function getCategoryColor(category: string) {
  const primary = category.split(',')[0].trim()
  return CATEGORY_COLORS[primary] ?? CATEGORY_COLORS['Sonstiges']
}

function createPriceIcon(label: string, isSelected: boolean, isPast: boolean, category: string): L.DivIcon {
  const cat = getCategoryColor(category)
  const bg = isSelected ? '#B8922A' : isPast ? '#6E685F' : cat.bg
  const textColor = isSelected ? '#FFFFFF' : isPast ? '#C8C4BC' : cat.text
  const border = isSelected ? '#D4A843' : isPast ? '#9A9590' : cat.border
  const opacity = isPast ? '0.7' : '1'
  const scale = isSelected ? 'scale(1.15)' : 'scale(1)'
  const zIndex = isSelected ? 9999 : 1000

  return L.divIcon({
    className: '',
    html: `
      <div style="transform:${scale};transition:transform 0.2s ease;z-index:${zIndex};position:relative;opacity:${opacity};display:inline-block">
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
    iconSize: [70, 36],
    iconAnchor: [35, 36],
    popupAnchor: [0, -38],
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
  light:     { label: '地图', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',     attr: '© OpenStreetMap © CARTO', sub: 'abcd' },
  osm:       { label: '街道', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                   attr: '© OpenStreetMap', sub: 'abc' },
  satellite: { label: '卫星', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri', sub: undefined },
}
type LayerKey = keyof typeof LAYERS

// Spread positions in a small fan when multiple auctions share the same coords
function spreadPositions(lat: number, lng: number, count: number, index: number): [number, number] {
  if (count === 1) return [lat, lng]
  const angle = (2 * Math.PI * index) / count - Math.PI / 2
  const radius = 0.0004
  return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)]
}

function createClusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#B8922A;color:#fff;border:2px solid #fff;border-radius:50%;
      width:32px;height:32px;display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;font-family:Inter,system-ui,sans-serif;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;
    ">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

export function MapView({ auctions, selectedId, onSelect }: Props) {
  const initialFit = useRef(false)
  const today = new Date().toISOString().split('T')[0]
  const validAuctions = auctions.filter(validCoord)
  const [layer, setLayer] = useState<LayerKey>('light')
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const [showSubway, setShowSubway] = useState(true)
  const [showTram, setShowTram] = useState(false)
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

  function toggleCluster(key: string) {
    setExpandedClusters(prev => prev.has(key) ? new Set() : new Set([key]))
  }

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

      {/* Transit toggle + U-Bahn legend */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg overflow-hidden shadow-md border border-cream-200 bg-white/95 backdrop-blur-sm">
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
            maxZoom={20}
          />
          <ZoomControl position="bottomright" />

          <MapController
            selectedId={selectedId}
            auctions={validAuctions}
            initialFit={initialFit}
          />

          <TransitLayer showSubway={showSubway} showTram={showTram} />

          {[...coordGroups.entries()].map(([coordKey, group]) => {
            const isExpanded = expandedClusters.has(coordKey)
            const isCluster = group.length > 1

            // Collapsed cluster: show count badge
            if (isCluster && !isExpanded) {
              const [lat, lng] = coordKey.split(',').map(Number)
              return (
                <Marker
                  key={coordKey}
                  position={[lat, lng]}
                  icon={createClusterIcon(group.length)}
                  zIndexOffset={1500}
                  eventHandlers={{ click: () => toggleCluster(coordKey) }}
                />
              )
            }

            // Single or expanded: show individual markers
            return group.map((auction, idx) => {
              const isSelected = auction.id === selectedId
              const isPast = auction.auctionDate < today
              const label = formatPriceLabel(auction.minimumBid)
              const icon = createPriceIcon(label, isSelected, isPast, auction.category)
              const [lat, lng] = isCluster
                ? spreadPositions(auction.latitude, auction.longitude, group.length, idx)
                : [auction.latitude, auction.longitude]

              return (
                <Marker
                  key={auction.id}
                  position={[lat, lng]}
                  icon={icon}
                  zIndexOffset={isSelected ? 2000 : 0}
                  eventHandlers={{ click: () => onSelect(auction.id) }}
              >
                <Tooltip direction="top" offset={[0, -40]} opacity={1} className="leaflet-custom-tooltip">
                  <MapTooltip auction={auction} />
                </Tooltip>
              </Marker>
            )
            })
          })}
        </MapContainer>
      </MapErrorBoundary>

    </div>
  )
}

function MapTooltip({ auction }: { auction: Auction }) {
  return (
    <div className="p-3 min-w-[220px] max-w-[280px]">
      <div className="text-xs font-semibold text-forest-700 font-serif leading-tight mb-1">
        {generateTitle(auction)}
      </div>
      <div className="text-xs text-warm-600 mb-2 leading-tight">{auction.address}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <span className="text-warm-400">起拍价</span>
          <div className="font-semibold text-gold-600">{formatCurrency(auction.minimumBid)}</div>
        </div>
        <div>
          <span className="text-warm-400">估值</span>
          <div className="font-semibold text-warm-700">{formatCurrency(auction.estimatedValue)}</div>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-warm-400">
        📅 {auction.auctionDate} · 案号 {auction.caseNumber}
      </div>
    </div>
  )
}
