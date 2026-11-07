import type { Auction, TenancyStatus } from '../types/auction'

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
  return `${(value * 100).toFixed(1)} %`
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

export const CATEGORY_LABELS: Record<string, string> = {
  Eigentumswohnung: '公寓',
  Wohnungseigentumsobjekt: '公寓',
  Einfamilienhaus: '独栋住宅',
  Mehrfamilienhaus: '多户住宅',
  Mietshaus: '出租楼',
  'gewerbliche Liegenschaft': '商业物业',
  Sonstiges: '其他',
}

export function getCategoryLabel(cat: string): string {
  const primary = cat.split(',')[0].trim()
  return CATEGORY_LABELS[primary] ?? CATEGORY_LABELS[cat] ?? primary
}

function inferTypeFromOwnership(ownershipType: string): string {
  const s = ownershipType.toLowerCase()
  if (/villa|herrschaftlich/.test(s)) return '别墅'
  if (/dachgeschoss/.test(s)) return '顶层公寓'
  if (/reihenhaus/.test(s)) return '联排住宅'
  if (/wohnhaus|wohngebäude|wohnungen|mehrere wohnungen/.test(s)) return '住宅楼'
  if (/bürogebäude|büro/.test(s)) return '办公楼'
  if (/hotel|pension/.test(s)) return '酒店'
  if (/geschäftslokal|geschäftshaus|geschäft/.test(s)) return '商铺'
  if (/gewerbe|gewerblich/.test(s)) return '商业物业'
  if (/lager|lagerhalle/.test(s)) return '仓库'
  if (/grundstück|baugrund|liegenschaft/.test(s)) return '地皮'
  return '其他'
}

export function generateCnSummary(auction: Auction): string {
  const parts: string[] = []

  const catLabel = getCategoryLabel(auction.category)
  const areaStr = auction.area > 0 ? `${Math.round(auction.area)} ㎡` : ''
  const psmStr = auction.pricePerSqm > 0
    ? `均价 €${Math.round(auction.pricePerSqm).toLocaleString('de-AT')}/㎡`
    : ''

  if (areaStr && psmStr) parts.push(`${catLabel} · ${areaStr} · ${psmStr}`)
  else if (areaStr) parts.push(`${catLabel} · ${areaStr}`)
  else parts.push(catLabel)

  const ratio = auction.estimatedValue > 0
    ? Math.round((auction.minimumBid / auction.estimatedValue) * 100)
    : 0
  if (ratio > 0) parts.push(`起拍价为估值 ${ratio}%`)

  if (auction.ownershipType) {
    const s = auction.ownershipType.toLowerCase()
    const hints: string[] = []
    if (/dachgeschoss/.test(s)) hints.push('顶层')
    if (/nicht fertig|unfertig|rohbau/.test(s)) hints.push('未竣工')
    if (/garten|terrasse|loggia/.test(s)) hints.push('带花园/露台')
    if (/renovier|saniert/.test(s)) hints.push('已翻新')
    if (/leer|unvermiet/.test(s)) hints.push('空置')
    if (/vermietet/.test(s)) hints.push('已出租')
    if (/garage|stellplatz/.test(s)) hints.push('含车位')
    if (/villa|herrschaftlich/.test(s)) hints.push('别墅')
    if (/denkmal|historisch/.test(s)) hints.push('历史建筑')
    if (hints.length) parts.push(hints.join('·'))
  }

  return parts.join('　|　')
}

export function generateTitle(auction: Auction): string {
  // Extract district number from postal code: "1190 Wien ..." → "19区"
  const match = auction.address.match(/^1(\d)(\d)0\s/)
  const district = match ? `${parseInt(match[1] + match[2])}区` : ''

  // Handle compound categories like "Wohnungseigentumsobjekt, Sonstiges"
  const primaryCat = auction.category.split(',')[0].trim()
  let type = CATEGORY_LABELS[primaryCat] ?? CATEGORY_LABELS[auction.category] ?? primaryCat
  // For any entry containing "Sonstiges", try to infer from the German land-register text
  if (auction.category.includes('Sonstiges')) {
    type = auction.ownershipType ? inferTypeFromOwnership(auction.ownershipType) : '物业'
  }

  const area = auction.area > 0 ? `${Math.round(auction.area)}㎡` : ''

  return [district, type, area].filter(Boolean).join(' ')
}
