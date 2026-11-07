import type { Auction, PropertyType, TenancyStatus } from '../types/auction'

export function formatCurrency(value: number): string {
  // Überbot / archival rows often have 0 for these fields — render an
  // em-dash placeholder so the card doesn't show a misleading "€ 0".
  if (!value || value <= 0) return '—'
  if (value >= 1_000_000) {
    const mio = value / 1_000_000
    return `€ ${mio % 1 === 0 ? mio.toFixed(0) : mio.toFixed(2).replace('.', ',')} Mio.`
  }
  return `€ ${value.toLocaleString('de-AT')}`
}

/** Every digit, for the detail panel where amounts are compared side by side. */
export function formatFullCurrency(value: number): string {
  if (!value || value <= 0) return '—'
  return `€ ${value.toLocaleString('de-AT')}`
}

export function formatPriceLabel(value: number): string {
  if (value >= 1_000_000) {
    const mio = value / 1_000_000
    return `${mio % 1 === 0 ? mio.toFixed(0) : mio.toFixed(1).replace('.', ',')}M`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`
  }
  return `€${value}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatArea(area: number): string {
  if (!area || area <= 0) return '—'
  return `${area.toFixed(2).replace('.', ',')} m²`
}

export function formatPerSqm(value: number): string {
  if (!value || value <= 0) return '—'
  return `€ ${Math.round(value).toLocaleString('de-AT')}/m²`
}

export function formatPercent(value: number): string {
  if (!isFinite(value) || value <= 0) return '—'
  return `${Number((value * 100).toFixed(1))}%`
}

export function bidRatio(auction: Auction): number {
  if (!auction.estimatedValue || auction.estimatedValue <= 0) return 0
  return auction.minimumBid / auction.estimatedValue
}

export function daysUntilAuction(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const auction = new Date(dateStr + 'T00:00:00')
  return Math.round((auction.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export const RISK_TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  已出租: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  空置: { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' },
  Baurecht: { bg: '#FEF3C7', text: '#78350F', border: '#FDE68A' },
  商业用途: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  需复核负担: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  能耗待确认: { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
  能源证书待确认: { bg: '#FFFBEB', text: '#78350F', border: '#FCD34D' },
  需进一步确认: { bg: '#FFF7ED', text: '#9A3412', border: '#FDBA74' },
  法律负担复杂: { bg: '#FFF1F2', text: '#9F1239', border: '#FDA4AF' },
  分割产权: { bg: '#F0FDF4', text: '#14532D', border: '#86EFAC' },
  历史建筑: { bg: '#F0F9FF', text: '#0C4A6E', border: '#7DD3FC' },
}

export const TENANCY_META: Record<TenancyStatus, { label: string; bg: string; text: string; border: string }> = {
  vacant: { label: '无租约（空置/自用）', bg: '#F0FDF4', text: '#14532D', border: '#86EFAC' },
  limited: { label: '定期出租', bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
  rented: { label: '已出租·期限未注明', bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  unlimited: { label: '无限期出租', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  unknown: { label: '租赁情况未注明', bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' },
}

export function getRiskTagStyle(tag: string): { bg: string; text: string; border: string } {
  return RISK_TAG_STYLES[tag] ?? { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' }
}

/** Darker than the brand gold so highlighted amounts stay readable on cream. */
export const HIGHLIGHT_COLOR = '#8A6A12'

export const PROPERTY_TYPES: Exclude<PropertyType, '车位'>[] = ['公寓', '独栋住宅', '出租楼', '店铺', '办公商业', '地皮', '阁楼毛坯', '其他']

const PROPERTY_COLORS: Record<PropertyType, { card: string; bg: string; text: string; border: string }> = {
  公寓: { card: '#1D3A2A', bg: '#1A4A7A', text: '#A8D4FF', border: '#5B9BD5' },
  独栋住宅: { card: '#3D6B52', bg: '#1D3A2A', text: '#7EC8A0', border: '#3D8A60' },
  出租楼: { card: '#7A4A00', bg: '#5C3A00', text: '#FFD080', border: '#C87800' },
  店铺: { card: '#5B21B6', bg: '#4A1A6A', text: '#D4A8FF', border: '#8A5BBD' },
  办公商业: { card: '#1A3A5C', bg: '#0F4C5C', text: '#9FE3F0', border: '#3AA0B5' },
  地皮: { card: '#6B5A12', bg: '#4F4A12', text: '#E8E08A', border: '#A89C2E' },
  阁楼毛坯: { card: '#57524A', bg: '#4A4A4A', text: '#D4D4D4', border: '#888888' },
  车位: { card: '#57524A', bg: '#4A4A4A', text: '#D4D4D4', border: '#888888' },
  其他: { card: '#57524A', bg: '#4A4A4A', text: '#D4D4D4', border: '#888888' },
}

export function propertyType(auction: Auction): PropertyType {
  return auction.propertyType ?? '其他'
}

export function propertyLabel(auction: Auction): string {
  return auction.propertyNote ? `${propertyType(auction)}·${auction.propertyNote}` : propertyType(auction)
}

export function getPropertyColor(auction: Auction): string {
  return PROPERTY_COLORS[propertyType(auction)].card
}

export function getPropertyMapColor(auction: Auction): { bg: string; text: string; border: string } {
  return PROPERTY_COLORS[propertyType(auction)]
}

export function generateTitle(auction: Auction): string {
  // Extract district number from postal code: "1190 Wien ..." → "19区"
  const match = auction.address.match(/^1(\d)(\d)0\s/)
  const district = match ? `${parseInt(match[1] + match[2])}区` : ''

  const type = propertyLabel(auction)

  const area = auction.area > 0 ? `${Math.round(auction.area)}㎡` : ''

  return [district, type, area].filter(Boolean).join(' ')
}
