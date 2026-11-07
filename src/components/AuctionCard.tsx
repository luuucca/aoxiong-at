import React, { useRef, useEffect } from 'react'
import {
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  FileDown,
  ChevronRight,
  Ruler,
} from 'lucide-react'
import type { Auction } from '../types/auction'
import {
  formatCurrency,
  formatDate,
  formatArea,
  formatPercent,
  formatPerSqm,
  bidRatio,
  getRiskTagStyle,
  getCategoryLabel,
  generateTitle,
  generateCnSummary, TENANCY_META } from '../utils/formatters'

interface Props {
  auction: Auction
  isSelected: boolean
  onClick: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  Eigentumswohnung: '#1D3A2A',
  Wohnungseigentumsobjekt: '#2A5040',
  Einfamilienhaus: '#3D6B52',
  Mehrfamilienhaus: '#1A3A5C',
  Mietshaus: '#4A3A1A',
  'gewerbliche Liegenschaft': '#5B21B6',
  Sonstiges: '#6E685F',
}

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#6E685F'
}

function DaysChip({ dateStr }: { dateStr: string }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const auc = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((auc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-warm-300 bg-opacity-30 text-warm-500">
        已结束
      </span>
    )
  if (diff === 0)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
        今日
      </span>
    )
  if (diff <= 7)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
        {diff}天后
      </span>
    )
  if (diff <= 30)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        {diff}天后
      </span>
    )
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-warm-500">
      {diff}天后
    </span>
  )
}

export function AuctionCard({ auction, isSelected, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const ratio = bidRatio(auction)
  const catColor = getCategoryColor(auction.category)

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`
        transition-card cursor-pointer rounded-xl border bg-white mx-3 mb-2.5 overflow-hidden
        ${
          isSelected
            ? 'border-gold-500 shadow-card-selected'
            : 'border-cream-200 shadow-card hover:border-cream-300 hover:shadow-card-hover'
        }
      `}
      style={isSelected ? { borderLeftWidth: 3, borderLeftColor: '#B8922A' } : {}}
    >
      {/* Card header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ backgroundColor: catColor + '08' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ backgroundColor: catColor }}
          >
            {getCategoryLabel(auction.category)}
          </span>
          <span className="text-xs text-warm-400 truncate font-mono">{auction.caseNumber}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <DaysChip dateStr={auction.auctionDate} />
          {isSelected && <ChevronRight size={14} className="text-gold-500" />}
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 pt-3 pb-3">
        {/* Title */}
        <h3 className="font-serif font-semibold text-forest-700 text-sm leading-tight mb-1">
          {generateTitle(auction)}
        </h3>

        {/* Address */}
        <div className="flex items-start gap-1.5 mb-3">
          <MapPin size={12} className="text-warm-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-warm-600 leading-tight">{auction.address}</span>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MetricCell label="估值" value={formatCurrency(auction.estimatedValue)} highlight={false} />
          <MetricCell
            label="起拍价"
            value={formatCurrency(auction.minimumBid)}
            highlight={true}
            highlightColor={ratio <= 0.5 ? '#B8922A' : '#1D3A2A'}
          />
          <MetricCell
            label="起拍/估值"
            value={formatPercent(ratio)}
            highlight={ratio <= 0.5}
            highlightColor="#B8922A"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <MetricCell label="面积" value={formatArea(auction.area)} highlight={false} />
          <MetricCell label="单价" value={formatPerSqm(auction.pricePerSqm)} highlight={false} />
          <MetricCell label="Vadium" value={formatCurrency(auction.deposit)} highlight={false} />
        </div>

        {/* Auction date */}
        <div className="flex items-center gap-1.5 mb-3">
          <Calendar size={12} className="text-warm-400 flex-shrink-0" />
          <span className="text-xs text-warm-500">
            拍卖日期：<span className="text-warm-700 font-medium">{formatDate(auction.auctionDate)}</span>
          </span>
        </div>

        {/* Summary */}
        <div className="mb-3 bg-cream-50 rounded-lg px-3 py-2 border border-cream-200">
          <div className="flex items-center gap-1 mb-1">
            <FileText size={11} className="text-warm-400" />
            <span className="text-xs font-medium text-warm-500">物业概况</span>
          </div>
          <p className="text-xs text-warm-600 leading-relaxed">{generateCnSummary(auction)}</p>
        </div>

        {/* Tenancy */}
        {(() => {
          const meta = TENANCY_META[auction.tenancyStatus ?? 'unknown']
          return (
            <span
              className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2"
              style={{ backgroundColor: meta.bg, color: meta.text, border: `1px solid ${meta.border}` }}
            >
              {meta.label}
            </span>
          )
        })()}

        {/* Risk tags */}
        {(auction.riskTags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(auction.riskTags ?? []).map((tag) => {
              const style = getRiskTagStyle(tag)
              return (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: style.bg,
                    color: style.text,
                    border: `1px solid ${style.border}`,
                  }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-cream-200">
          {auction.detailUrl && (
            <ActionButton
              href={auction.detailUrl}
              icon={<ExternalLink size={11} />}
              label="司法详情页"
              primary
            />
          )}
          {auction.pdfUrl && (
            <ActionButton
              href={auction.pdfUrl}
              icon={<FileDown size={11} />}
              label="专家报告 PDF"
            />
          )}
          {auction.shortReportUrl && (
            <ActionButton
              href={auction.shortReportUrl}
              icon={<FileText size={11} />}
              label="简版报告"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCell({
  label,
  value,
  highlight,
  highlightColor = '#B8922A',
}: {
  label: string
  value: string
  highlight: boolean
  highlightColor?: string
}) {
  return (
    <div className="bg-cream-50 rounded-md px-2 py-1.5">
      <div className="text-xs text-warm-400 leading-tight">{label}</div>
      <div
        className="text-xs font-semibold leading-tight mt-0.5 truncate"
        style={{ color: highlight ? highlightColor : '#1D3A2A' }}
      >
        {value}
      </div>
    </div>
  )
}

function ActionButton({
  href,
  icon,
  label,
  primary = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  primary?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors
        ${
          primary
            ? 'bg-forest-700 text-cream-100 hover:bg-forest-600'
            : 'bg-cream-100 text-warm-600 border border-cream-300 hover:border-forest-600 hover:text-forest-700'
        }
      `}
    >
      {icon}
      {label}
    </a>
  )
}
