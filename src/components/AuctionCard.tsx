import React, { useRef, useEffect } from 'react'
import {
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  FileDown,
  ChevronDown,
  AlertTriangle,
  TrainFront,
} from 'lucide-react'
import type { Auction } from '../types/auction'
import {
  formatCurrency,
  formatFullCurrency,
  formatDate,
  formatArea,
  formatPercent,
  formatPerSqm,
  formatStationDistance,
  bidRatio,
  getRiskTagStyle,
  getPropertyColor,
  propertyLabel,
  generateTitle,
  HIGHLIGHT_COLOR,
  SUBWAY_COLORS,
  TENANCY_META,
} from '../utils/formatters'

interface Props {
  auction: Auction
  /** Selected cards expand in place to show the full report details. */
  isSelected: boolean
  onClick: () => void
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

export function AuctionCard({ auction, isSelected: expanded, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const ratio = bidRatio(auction)
  const catColor = getPropertyColor(auction)
  const tenancy = TENANCY_META[auction.tenancyStatus ?? 'unknown']
  const money = expanded ? formatFullCurrency : formatCurrency
  const station = auction.nearestStation

  // Bring an opened card to the top of the list, also when opened from a map pin.
  useEffect(() => {
    if (expanded && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [expanded])

  return (
    <div
      ref={ref}
      // An open card only closes from its header, so reading or selecting text inside does not close it.
      onClick={expanded ? undefined : onClick}
      className={`
        transition-card rounded-xl border bg-white mx-3 mb-2.5 overflow-hidden scroll-mt-2
        ${
          expanded
            ? 'border-gold-500 shadow-card-selected'
            : 'cursor-pointer border-cream-200 shadow-card hover:border-cream-300 hover:shadow-card-hover'
        }
      `}
      style={expanded ? { borderLeftWidth: 3, borderLeftColor: '#B8922A' } : {}}
    >
      {/* Card header */}
      <div
        onClick={expanded ? onClick : undefined}
        title={expanded ? '收起' : undefined}
        className={`px-4 py-2.5 flex items-center justify-between gap-2 ${expanded ? 'cursor-pointer' : ''}`}
        style={{ backgroundColor: catColor + '08' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ backgroundColor: catColor }}
          >
            {propertyLabel(auction)}
          </span>
          <span className="text-xs text-warm-500 truncate tabular-nums">{auction.caseNumber}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <DaysChip dateStr={auction.auctionDate} />
          <ChevronDown
            size={15}
            className={`text-warm-400 transition-transform duration-200 ${expanded ? 'rotate-180 text-gold-500' : ''}`}
            aria-label={expanded ? '收起' : '展开'}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 pt-3 pb-3">
        <h3
          className={`font-sans font-semibold text-forest-700 leading-snug mb-1 tabular-nums ${expanded ? 'text-lg' : 'text-base'}`}
        >
          {generateTitle(auction)}
        </h3>

        <div className="flex items-start gap-1.5 mb-1.5">
          <MapPin size={12} className="text-warm-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-warm-600 leading-snug">{auction.address}</span>
        </div>

        {/* Nearest U-Bahn station */}
        {station && (
          <div className="flex items-center gap-1.5 mb-3 min-w-0">
            <TrainFront size={12} className="text-warm-400 flex-shrink-0" />
            {station.lines.map((l) => (
              <span
                key={l}
                className="text-[10px] leading-none font-bold px-1 py-[3px] rounded-sm text-white flex-shrink-0"
                style={{ backgroundColor: SUBWAY_COLORS[l] ?? '#555' }}
              >
                {l}
              </span>
            ))}
            <span className="text-sm text-warm-600 truncate">
              {station.name}
              <span className="text-warm-500 tabular-nums"> · {formatStationDistance(station)}</span>
            </span>
          </div>
        )}
        {!station && <div className="mb-1.5" />}

        {/* Key metrics grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MetricCell label="估值" value={money(auction.estimatedValue)} highlight={false} />
          <MetricCell
            label="起拍价"
            value={money(auction.minimumBid)}
            highlight={true}
            highlightColor={ratio <= 0.5 ? HIGHLIGHT_COLOR : '#1D3A2A'}
          />
          <MetricCell
            label="起拍/估值"
            value={formatPercent(ratio)}
            highlight={ratio <= 0.5}
            highlightColor={HIGHLIGHT_COLOR}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <MetricCell label="面积" value={formatArea(auction.area)} highlight={false} />
          <MetricCell label="单价" value={formatPerSqm(auction.pricePerSqm)} highlight={false} />
          <MetricCell label="保证金" value={money(auction.deposit)} highlight={false} />
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <Calendar size={12} className="text-warm-400 flex-shrink-0" />
          <span className="text-xs text-warm-500">
            拍卖日期：<span className="text-warm-700 font-medium">{formatDate(auction.auctionDate)}</span>
          </span>
        </div>

        {/* Collapsed: two lines of the summary */}
        {!expanded && auction.summarizedAt && (
          <p className="text-sm text-warm-600 leading-6 mb-3 line-clamp-2 tabular-nums">{auction.summary}</p>
        )}

        {/* Expanded: the full report details */}
        {expanded && (
          <div className="space-y-4 mb-4">
            {auction.summarizedAt ? (
              <section>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <h4 className="text-sm font-semibold text-forest-700">报告摘要</h4>
                  <span className="text-xs text-warm-500 flex-shrink-0">AI 整理，仅供参考</span>
                </div>
                <p className="text-sm text-warm-700 leading-7 tabular-nums">{auction.summary}</p>
              </section>
            ) : (
              auction.ownershipType && (
                <section>
                  <h4 className="text-sm font-semibold text-forest-700 mb-1.5">法院描述（德语原文）</h4>
                  <p className="text-xs text-warm-600 leading-relaxed">{auction.ownershipType}</p>
                </section>
              )
            )}

            <section>
              <h4 className="text-sm font-semibold text-forest-700 mb-1.5">租赁状况</h4>
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: tenancy.bg, color: tenancy.text, border: `1px solid ${tenancy.border}` }}
              >
                {tenancy.label}
              </span>
              {auction.tenancyText && (
                <p className="text-xs text-warm-500 leading-relaxed mt-1.5">报告原文：{auction.tenancyText}</p>
              )}
            </section>

            {(auction.riskTags ?? []).length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={13} className="text-amber-600" />
                  <h4 className="text-sm font-semibold text-forest-700">风险提示</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(auction.riskTags ?? []).map((tag) => (
                    <RiskTag key={tag} tag={tag} />
                  ))}
                </div>
              </section>
            )}

            {auction.geocodeSource === 'approximate' && (
              <p className="text-xs text-amber-700">地图位置为区级近似坐标，不是准确门牌。</p>
            )}
          </div>
        )}

        {/* Collapsed: tenancy and risks in one row */}
        {!expanded && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: tenancy.bg, color: tenancy.text, border: `1px solid ${tenancy.border}` }}
            >
              {tenancy.label}
            </span>
            {(auction.riskTags ?? []).map((tag) => (
              <RiskTag key={tag} tag={tag} />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-cream-200">
          {auction.detailUrl && (
            <ActionButton
              href={auction.detailUrl}
              icon={<ExternalLink size={expanded ? 14 : 11} />}
              label="司法详情页"
              primary
              large={expanded}
            />
          )}
          {auction.pdfUrl && (
            <ActionButton
              href={auction.pdfUrl}
              icon={<FileDown size={expanded ? 14 : 11} />}
              label="专家报告 PDF"
              large={expanded}
            />
          )}
          {auction.shortReportUrl && (
            <ActionButton
              href={auction.shortReportUrl}
              icon={<FileText size={expanded ? 14 : 11} />}
              label="简版报告"
              large={expanded}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RiskTag({ tag }: { tag: string }) {
  const style = getRiskTagStyle(tag)
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {tag}
    </span>
  )
}

function MetricCell({
  label,
  value,
  highlight,
  highlightColor = HIGHLIGHT_COLOR,
}: {
  label: string
  value: string
  highlight: boolean
  highlightColor?: string
}) {
  return (
    <div className="bg-cream-50 rounded-md px-2 py-1.5 min-w-0">
      <div className="text-xs text-warm-500 leading-tight">{label}</div>
      <div
        className="text-sm font-semibold leading-snug mt-0.5 truncate tabular-nums"
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
  large = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  primary?: boolean
  large?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`
        inline-flex items-center rounded font-medium transition-colors
        ${large ? 'gap-1.5 h-9 px-3.5 text-sm rounded-md' : 'gap-1 px-2.5 py-1 text-xs'}
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
