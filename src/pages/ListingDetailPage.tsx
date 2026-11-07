import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, MapPin, Maximize2, Home, Calendar, Building,
  ChevronLeft, ChevronRight, Loader2, ExternalLink, Heart, Share2,
  Bed, Bath, TreePine, Layers, Sparkles
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Lightbox } from '../components/ui/Lightbox'
import { DEFAULT_TITLE } from '../utils/seo'
import { MortgageCalculator } from '../components/ui/MortgageCalculator'
import { DistrictIntro } from '../components/ui/DistrictIntro'

// ─── POI types ───────────────────────────────────────────────────────────────
interface POIPoint { lat: number; lng: number; name: string; type: 'subway' | 'shop' }

// ─── Emoji map icons ─────────────────────────────────────────────────────────
const makeEmojiIcon = (emoji: string) =>
  L.divIcon({
    className: '',
    html: `<div style="font-size:26px;line-height:1;background:rgba(12,12,12,0.78);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.14);box-shadow:0 3px 12px rgba(0,0,0,0.5);cursor:pointer;">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
const subwayIcon = makeEmojiIcon('🚇')
const shopIcon   = makeEmojiIcon('🛒')

// ─── Fetch nearest POIs from Overpass ────────────────────────────────────────
async function fetchPOIs(lat: number, lng: number): Promise<{ subway: POIPoint | null; shop: POIPoint | null }> {
  const q = `[out:json][timeout:15];
(
  node(around:2500,${lat},${lng})[station=subway];
  node(around:2500,${lat},${lng})[railway=subway_entrance];
  node(around:2500,${lat},${lng})[railway=station][station=subway];
  node(around:1200,${lat},${lng})[shop=supermarket];
  node(around:1200,${lat},${lng})[shop=convenience];
  node(around:1200,${lat},${lng})[shop=grocery];
);
out body 30;`

  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
  const data = await r.json()
  const els: any[] = data.elements || []

  const dist = (e: any) => Math.hypot(e.lat - lat, e.lon - lng)

  const subwayEls = els.filter(e =>
    e.tags?.station === 'subway' || e.tags?.railway === 'subway_entrance' ||
    (e.tags?.railway === 'station' && e.tags?.station === 'subway')
  )
  const shopEls = els.filter(e =>
    e.tags?.shop === 'supermarket' || e.tags?.shop === 'convenience' || e.tags?.shop === 'grocery'
  )

  const nearest = (arr: any[]): POIPoint | null => {
    if (!arr.length) return null
    const e = arr.reduce((a, b) => dist(a) < dist(b) ? a : b)
    return { lat: e.lat, lng: e.lon, name: e.tags?.name || '', type: 'subway' }
  }

  const sub = nearest(subwayEls)
  const sh  = shopEls.length
    ? (() => { const e = shopEls.reduce((a, b) => dist(a) < dist(b) ? a : b); return { lat: e.lat, lng: e.lon, name: e.tags?.name || '', type: 'shop' as const } })()
    : null

  return { subway: sub, shop: sh }
}

// ─── Fetch walking route from OSRM ───────────────────────────────────────────
async function fetchRoute(from: POIPoint, toLat: number, toLng: number): Promise<[number,number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${toLng},${toLat}?overview=full&geometries=geojson`
    const r = await fetch(url)
    const d = await r.json()
    const coords = d.routes?.[0]?.geometry?.coordinates
    if (!coords) return null
    return coords.map(([lng, lat]: [number, number]) => [lat, lng])
  } catch { return null }
}

// ─── POI Layer (must live inside MapContainer) ────────────────────────────────
function POILayer({ propLat, propLng }: { propLat: number; propLng: number }) {
  const map = useMap()
  const [subway, setSubway]         = useState<POIPoint | null>(null)
  const [shop, setShop]             = useState<POIPoint | null>(null)
  const [route, setRoute]           = useState<[number,number][] | null>(null)
  const [activeType, setActiveType] = useState<'subway' | 'shop' | null>(null)
  const [fetching, setFetching]     = useState(false)

  useEffect(() => {
    fetchPOIs(propLat, propLng).then(({ subway: s, shop: sh }) => {
      setSubway(s)
      setShop(sh)
    })
  }, [propLat, propLng])

  const handleClick = async (poi: POIPoint) => {
    if (activeType === poi.type) {           // toggle off
      setRoute(null); setActiveType(null); return
    }
    setActiveType(poi.type)
    setFetching(true)
    const r = await fetchRoute(poi, propLat, propLng)
    setRoute(r)
    setFetching(false)
    if (r) {
      // Fit map to show both property and POI
      const bounds = L.latLngBounds([[propLat, propLng], [poi.lat, poi.lng]])
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }

  return (
    <>
      {subway && (
        <Marker position={[subway.lat, subway.lng]} icon={subwayIcon}
          eventHandlers={{ click: () => handleClick({ ...subway, type: 'subway' }) }}>
          <Popup className="custom-popup">
            <div style={{ fontWeight: 700, fontSize: 13 }}>🚇 {subway.name || 'U-Bahn Station'}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
              {activeType === 'subway' ? '点击关闭路线' : '点击查看步行路线'}
            </div>
          </Popup>
        </Marker>
      )}
      {shop && (
        <Marker position={[shop.lat, shop.lng]} icon={shopIcon}
          eventHandlers={{ click: () => handleClick({ ...shop, type: 'shop' }) }}>
          <Popup className="custom-popup">
            <div style={{ fontWeight: 700, fontSize: 13 }}>🛒 {shop.name || '超市'}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
              {activeType === 'shop' ? '点击关闭路线' : '点击查看步行路线'}
            </div>
          </Popup>
        </Marker>
      )}
      {route && (
        <Polyline positions={route}
          pathOptions={{ color: '#d4af37', weight: 4, opacity: 0.9, dashArray: '10 7' }} />
      )}
    </>
  )
}

// ─── Detail map: uses Notion stored coords directly (most reliable) ──────────
function DetailMap({ street, plz, storedLat, storedLng, title, hasHouseNumber }:
  { street: string; plz: string; storedLat: number; storedLng: number; title: string; hasHouseNumber: boolean }) {

  if (!storedLat || !storedLng) return (
    <div className="flex items-center justify-center" style={{ height: 420, color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
      暂无位置信息
    </div>
  )

  return (
    <div className="relative dark-map" style={{ height: 420 }}>
      <MapContainer
        center={[storedLat, storedLng]}
        zoom={16}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', background: '#0e0e0e' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
        <Marker position={[storedLat, storedLng]} icon={goldPinIcon}>
          <Popup className="custom-popup">
            <div style={{ color: '#141414', fontWeight: 600, fontSize: 12 }}>{title}</div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{plz} Wien · {street}</div>
          </Popup>
        </Marker>
        {hasHouseNumber && <POILayer propLat={storedLat} propLng={storedLng} />}
      </MapContainer>

      {/* Legend */}
      {hasHouseNumber && (
        <div className="absolute bottom-3 left-3 z-[400] flex gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(12,12,12,0.82)', color: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            🚇 地铁站
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(12,12,12,0.82)', color: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            🛒 超市
          </div>
        </div>
      )}

      {/* Google Maps link */}
      <a href={`https://www.google.com/maps/search/${encodeURIComponent(street + ', ' + plz + ' Wien')}`}
        target="_blank" rel="noopener noreferrer"
        className="absolute bottom-3 right-3 z-[400] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all hover:scale-105"
        style={{ background: 'rgba(20,20,20,0.85)', color: '#d4af37', backdropFilter: 'blur(10px)', border: '1px solid rgba(212,175,55,0.3)' }}>
        Google 地图 <ExternalLink size={11} />
      </a>
    </div>
  )
}

const goldPinIcon = L.divIcon({
  className: 'custom-gold-pin',
  html: `<div style="
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #e8c552 0%, #d4af37 100%);
    border: 3px solid #141414;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 6px 18px rgba(212,175,55,0.45), 0 0 0 2px rgba(212,175,55,0.25);
    animation: pulse-gold 2s infinite;
  "><div style="
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%,-50%) rotate(45deg);
    width: 12px; height: 12px;
    background: #141414; border-radius: 50%;
  "></div></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
})

interface Listing {
  id: string
  objektnummer: string
  title: string
  type: string
  typeName: string
  forRent: boolean
  price: number
  priceOnRequest: boolean
  currency: string
  rooms: number
  bedrooms: number
  bathrooms: number
  sqm: number
  plotSqm: number
  balconyTerraceSqm: number
  floors: number
  buildYear: number
  address: { street: string; plz: string; city: string; district: string; state: string; raw: string }
  location: { lat: number; lng: number }
  images: string[]
  coverImage: string | null
  imageCount: number
  description: string
  locationText: string
  featuresText: string
  contact: { name: string; email: string; phone: string; company: string }
}

function fmtPrice(p: number, rent: boolean, onReq: boolean) {
  if (onReq || !p) return '价格面议'
  const f = p.toLocaleString('de-AT')
  return rent ? `€ ${f}/月` : `€ ${f}`
}

/* ─────────────────────────────────────────────
   Hero Gallery — touch/keyboard navigation + click-to-expand lightbox
───────────────────────────────────────────── */
function HeroGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const go = (delta: number) => {
    setDirection(delta)
    setIdx((i) => (i + delta + images.length) % images.length)
  }

  useEffect(() => {
    if (lightboxOpen) return // lightbox handles its own keyboard
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, lightboxOpen])

  // Preload neighbors for instant nav
  useEffect(() => {
    if (!images.length) return
    const preload = (src: string) => { const i = new Image(); i.src = src }
    if (images[(idx + 1) % images.length]) preload(images[(idx + 1) % images.length])
    if (images[(idx - 1 + images.length) % images.length])
      preload(images[(idx - 1 + images.length) % images.length])
  }, [idx, images])

  if (!images.length) {
    return (
      <div className="relative w-full max-w-content mx-auto rounded-2xl overflow-hidden bg-bg-elev-2 flex items-center justify-center text-fg-disabled" style={{ aspectRatio: '16/10' }}>
        无图片
      </div>
    )
  }

  return (
    <>
      <div
        className="relative w-full max-w-content mx-auto overflow-hidden rounded-2xl bg-bg-elev-2 cursor-zoom-in"
        style={{ aspectRatio: '16/10' }}
        onClick={() => setLightboxOpen(true)}
      >
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.img
            key={idx}
            src={images[idx]}
            alt={title}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full object-cover select-none"
            draggable={false}
            loading="eager"
            decoding="async"
            // @ts-ignore - fetchpriority is a valid HTML attribute
            fetchpriority="high"
            // Touch swipe within the hero (without opening lightbox).
            // Threshold lowered 80 → 40px and velocity-aware so a light
            // mobile flick is enough to advance — previously took a
            // forceful drag to register.
            drag={images.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.22}
            onDragEnd={(_, info) => {
              const dist = info.offset.x
              const vel  = info.velocity.x
              if (dist < -40 || (dist < -10 && vel < -400))      go(1)
              else if (dist > 40 || (dist > 10 && vel > 400))    go(-1)
            }}
          />
        </AnimatePresence>

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.55) 100%)' }} />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(-1) }}
              aria-label="上一张"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-md border border-white/[0.12] text-fg-primary transition-[background,transform] duration-base ease-standard hover:bg-black/75 active:scale-95"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(1) }}
              aria-label="下一张"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-md border border-white/[0.12] text-fg-primary transition-[background,transform] duration-base ease-standard hover:bg-black/75 active:scale-95"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>

            {/* Counter */}
            <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full text-caption font-medium tabular bg-black/65 backdrop-blur-md text-fg-primary border border-white/[0.1]">
              {idx + 1} / {images.length}
            </div>

            {/* Expand hint */}
            <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider bg-black/65 backdrop-blur-md text-fg-secondary border border-white/[0.1] hidden sm:block">
              点击查看大图
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-10 mt-3">
          <div className="flex gap-2 overflow-x-auto pb-2 thumb-strip">
            {images.slice(0, 30).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setDirection(i > idx ? 1 : -1); setIdx(i) }}
                className={[
                  'flex-shrink-0 rounded-lg overflow-hidden',
                  'transition-[border-color,opacity] duration-base ease-standard',
                  'active:scale-[0.96]',
                  i === idx
                    ? 'border-2 border-gold opacity-100'
                    : 'border-2 border-white/[0.08] opacity-60 hover:opacity-100',
                ].join(' ')}
                style={{ width: 88, height: 60 }}
              >
                <img src={img} alt="" loading={i < 6 ? 'eager' : 'lazy'} decoding="async"
                  className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Lightbox images={images} startIndex={idx} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  )
}

/* ─────────────────────────────────────────────
   Stat Card
───────────────────────────────────────────── */
function StatCard({ icon, label, value, delay = 0 }: { icon: React.ReactNode; label: string; value: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, borderColor: 'rgba(212,175,55,0.35)' }}
      className="rounded-2xl p-4 transition-colors"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'rgba(212,175,55,0.75)' }}>
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold text-white tracking-tight tabular">{value}</p>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve the URL the "返回列表" button should link to. We restore
  // whatever filtered listings view the user was on last (saved by
  // ListingsPage into sessionStorage). Falls back to plain /listings
  // if they reached this detail page through a direct/share link.
  const backToListings = useMemo(() => {
    if (typeof window === 'undefined') return '/listings'
    try { return sessionStorage.getItem('lastListingsURL') || '/listings' }
    catch { return '/listings' }
  }, [])


  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/listings?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
        setLoading(false)
      })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [id])

  // The server sets these on direct loads; this covers in-app navigation.
  useEffect(() => {
    if (!data) return
    document.title = `${data.title} | 奥匈置业研究所`
    return () => { document.title = DEFAULT_TITLE }
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base text-fg-primary pt-16">
        <Loader2 size={32} className="animate-spin mb-3" style={{ color: '#d4af37' }} />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>加载房源…</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base text-fg-primary pt-16 px-4 text-center">
        <p className="text-3xl mb-3">😶</p>
        <p className="font-semibold mb-2">房源未找到</p>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>{error || '该房源可能已下架'}</p>
        <Link to={backToListings} className="px-5 py-2 rounded-xl text-sm font-semibold" style={{ background: '#d4af37', color: '#141414' }}>
          返回房源列表
        </Link>
      </div>
    )
  }

  const district = String(data.address.district || '').match(/Wien\s+(\d+)/i)
  const districtNum = district ? district[1] : ''
  const districtName = data.address.district?.split(',')[1]?.trim() || ''

  return (
    <div className="min-h-screen bg-bg-base text-fg-primary pt-16">
      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 6px 18px rgba(212,175,55,0.45), 0 0 0 2px rgba(212,175,55,0.25); }
          50% { box-shadow: 0 8px 24px rgba(212,175,55,0.65), 0 0 0 8px rgba(212,175,55,0.08); }
        }
        .thumb-strip::-webkit-scrollbar { height: 6px; }
        .thumb-strip::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 3px; }
        .listing-desc h1, .listing-desc h2 { font-size: 18px; font-weight: 600; color: #d4af37; margin: 1.5em 0 0.6em; letter-spacing: -0.01em; }
        .listing-desc h3, .listing-desc h4 { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.95); margin: 1.2em 0 0.5em; }
        .listing-desc p { margin: 0.7em 0; }
        .listing-desc ul { margin: 0.6em 0; padding-left: 1.2em; }
        .listing-desc li { margin: 0.3em 0; list-style: disc; }
        .listing-desc strong { color: rgba(255,255,255,0.95); font-weight: 600; }
        .listing-desc hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1.5em 0; }
        .listing-desc a { color: #d4af37; text-decoration: underline; text-underline-offset: 2px; }
      `}</style>

      {/* Top toolbar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 pb-2 flex items-center justify-between">
        <Link to={backToListings}
          className="inline-flex items-center gap-1.5 text-sm transition-all px-3 py-1.5 rounded-xl"
          style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#d4af37'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
          <ArrowLeft size={13} /> 返回列表
        </Link>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            title="收藏">
            <Heart size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          <button onClick={() => navigator.share && navigator.share({ url: window.location.href, title: data.title })}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            title="分享">
            <Share2 size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>
      </div>

      {/* Hero Gallery */}
      <div className="mt-4 px-4 sm:px-6 lg:px-10">
        <HeroGallery images={data.images} title={data.title} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16 grid lg:grid-cols-3 gap-8">

        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Title block */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase bg-gold-tint border border-gold-line text-gold">
                {data.forRent ? '出租' : '出售'}
              </span>
              <span className="text-caption text-fg-secondary">{data.typeName || data.type}</span>
              {districtNum && (
                <>
                  <span className="text-fg-disabled">·</span>
                  <span className="text-caption text-fg-secondary">{districtNum} 区 {districtName}</span>
                </>
              )}
            </div>
            <h1
              className="text-heading-xl sm:text-display-lg text-fg-primary mb-5 tracking-tight font-semibold"
              style={{ lineHeight: 1.25 }}
            >
              {data.title}
            </h1>
            <div className="flex items-center gap-2 text-body text-fg-secondary">
              <MapPin size={14} strokeWidth={1.5} className="text-gold" />
              <span>{data.address.plz} {data.address.city}{data.address.street ? ` · ${data.address.street}` : ''}</span>
            </div>
          </motion.div>

          {/* Neighborhood intro video — fires only for districts that
              have a clip generated (currently 22; falls through silently
              for others). */}
          {districtNum && (
            <DistrictIntro district={parseInt(districtNum, 10)} />
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.sqm > 0 && (
              <StatCard icon={<Maximize2 size={11} />} label="居住面积" value={`${Math.round(data.sqm)} m²`} delay={0.05} />
            )}
            {data.rooms > 0 && (
              <StatCard icon={<Home size={11} />} label="房间数" value={`${data.rooms} 间`} delay={0.1} />
            )}
            {data.bedrooms > 0 && (
              <StatCard icon={<Bed size={11} />} label="卧室" value={`${data.bedrooms}`} delay={0.15} />
            )}
            {data.bathrooms > 0 && (
              <StatCard icon={<Bath size={11} />} label="浴室" value={`${data.bathrooms}`} delay={0.2} />
            )}
            {data.balconyTerraceSqm > 0 && (
              <StatCard icon={<TreePine size={11} />} label="阳台/露台" value={`${Math.round(data.balconyTerraceSqm)} m²`} delay={0.25} />
            )}
            {data.buildYear > 0 && (
              <StatCard icon={<Calendar size={11} />} label="建造年份" value={String(data.buildYear)} delay={0.3} />
            )}
            {data.floors > 0 && (
              <StatCard icon={<Layers size={11} />} label="楼层数" value={`${data.floors} 层`} delay={0.35} />
            )}
            {data.plotSqm > 0 && (
              <StatCard icon={<Building size={11} />} label="土地面积" value={`${Math.round(data.plotSqm)} m²`} delay={0.4} />
            )}
          </div>

          {/* Features */}
          {data.featuresText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl p-6"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} style={{ color: '#d4af37' }} />
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: '#d4af37' }}>配置与亮点</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{data.featuresText}</p>
            </motion.div>
          )}

          {/* Description */}
          {data.description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] mb-5" style={{ color: '#d4af37' }}>房源详情</h3>
              <div className="prose prose-sm prose-invert max-w-none listing-desc"
                style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14.5, lineHeight: 1.75 }}
                dangerouslySetInnerHTML={{ __html: data.description }} />
            </motion.div>
          )}

          {/* Mortgage calculator — only when there is a real price */}
          {data.price > 0 && !data.priceOnRequest && !data.forRent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="mb-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] mb-1" style={{ color: '#d4af37' }}>贷款估算</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  基于本房源售价的月供 + Nebenkosten 估算（实时调整）
                </p>
              </div>
              <MortgageCalculator initialPrice={data.price} variant="compact" />
            </motion.div>
          )}

          {/* Map — show if stored coords exist OR there's a geocodeable street address */}
          {(data.location.lat > 0 || data.address.street) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="p-6 pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] mb-1" style={{ color: '#d4af37' }}>地理位置</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {data.address.plz} {data.address.city}{data.address.street ? ` · ${data.address.street}` : ''}
                </p>
              </div>
              <DetailMap
                street={data.address.street}
                plz={data.address.plz}
                storedLat={data.location.lat}
                storedLng={data.location.lng}
                title={data.title}
                hasHouseNumber={!!(data.address.street && /\d/.test(data.address.street))}
              />
            </motion.div>
          )}
        </div>

        {/* Sticky sidebar. On mobile, ordered first so 出售价格
            and CTA sit above the body content. On lg+, returns to
            its natural right-column position via order-none. */}
        <aside className="space-y-4 order-first lg:order-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:sticky lg:top-24 space-y-4"
          >
            <div className="rounded-2xl p-6 bg-bg-elev-1 border border-white/[0.06]">
              <p className="text-overline text-fg-tertiary uppercase mb-3">
                {data.forRent ? '月租金' : '出售价格'}
              </p>
              <p className="text-display-lg font-semibold text-gold tabular leading-none">
                {fmtPrice(data.price, data.forRent, data.priceOnRequest)}
              </p>
              {data.sqm > 0 && data.price > 0 && !data.priceOnRequest && !data.forRent && (
                <p className="mt-3 text-caption text-fg-tertiary tabular">
                  约 € {Math.round(data.price / data.sqm).toLocaleString()} / m²
                </p>
              )}
            </div>

            <Link
              to="/about"
              className="block w-full text-center py-3.5 rounded-lg text-body-lg font-semibold bg-gold text-bg-base hover:bg-gold-hover transition-[background,transform] duration-base ease-standard active:scale-[0.98]"
            >
              咨询此房源 →
            </Link>

            {data.objektnummer && (
              <div className="px-4 py-3 rounded-lg flex items-center justify-between bg-bg-elev-1 border border-white/[0.06]">
                <span className="text-caption text-fg-tertiary">房源编号</span>
                <span className="font-mono text-caption text-fg-secondary tabular">{data.objektnummer}</span>
              </div>
            )}
          </motion.div>
        </aside>

      </div>
    </div>
  )
}
