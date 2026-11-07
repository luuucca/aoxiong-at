import React from 'react'
import { X, MapPin, AlertTriangle, ExternalLink, FileDown, FileText } from 'lucide-react'
import type { Auction } from '../types/auction'
import {
  formatFullCurrency,
  formatDate,
  formatArea,
  formatPercent,
  formatPerSqm,
  bidRatio,
  getRiskTagStyle,
  getPropertyColor,
  propertyLabel,
  generateTitle,
  HIGHLIGHT_COLOR,
  TENANCY_META,
} from '../utils/formatters'

interface Props {
  auction: Auction
  onClose: () => void
}

export function DetailPanel({ auction, onClose }: Props) {
  const ratio = bidRatio(auction)
  const isGoodDeal = ratio > 0 && ratio <= 0.5
  const tenancy = TENANCY_META[auction.tenancyStatus ?? 'unknown']

  return (
    <div className="flex-shrink-0 bg-white border-b border-cream-200 shadow-md relative overflow-hidden md:max-h-[72%] md:overflow-y-auto">
      <div className="h-0.5 bg-gradient-to-r from-gold-500 via-gold-400 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: getPropertyColor(auction) }}
            >
              {propertyLabel(auction)}
            </span>
            <span className="text-xs text-warm-500 tabular-nums">{auction.caseNumber}</span>
          </div>
          <h2 className="font-sans font-semibold text-forest-700 text-lg leading-snug tabular-nums">
            {generateTitle(auction)}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={13} className="text-warm-400 flex-shrink-0" />
            <span className="text-sm text-warm-600">{auction.address}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-cream-100 hover:bg-cream-200 flex items-center justify-center transition-colors"
          title="关闭详情"
          aria-label="关闭详情"
        >
          <X size={15} className="text-warm-500" />
        </button>
      </div>

      <div className="px-5 pb-4 space-y-4">
        {/* Prices */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric label="估值" value={formatFullCurrency(auction.estimatedValue)} />
          <Metric
            label="起拍价"
            value={formatFullCurrency(auction.minimumBid)}
            color={isGoodDeal ? HIGHLIGHT_COLOR : undefined}
          />
          <Metric
            label="起拍 / 估值"
            value={formatPercent(ratio)}
            color={isGoodDeal ? HIGHLIGHT_COLOR : undefined}
          />
          <Metric label="面积" value={formatArea(auction.area)} sub={auction.pricePerSqm > 0 ? formatPerSqm(auction.pricePerSqm) : undefined} />
        </div>

        {/* Facts */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
          <Fact label="拍卖日期" value={formatDate(auction.auctionDate)} />
          <Fact label="保证金" value={formatFullCurrency(auction.deposit)} />
          <div>
            <dt className="text-xs text-warm-500 mb-1">租赁状况</dt>
            <dd>
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: tenancy.bg, color: tenancy.text, border: `1px solid ${tenancy.border}` }}
              >
                {tenancy.label}
              </span>
            </dd>
          </div>
        </dl>

        {auction.tenancyText && (
          <p className="text-xs text-warm-500 leading-relaxed">报告原文：{auction.tenancyText}</p>
        )}

        {auction.geocodeSource === 'approximate' && (
          <p className="text-xs text-amber-700">地图位置为区级近似坐标，不是准确门牌。</p>
        )}

        {/* Report summary */}
        {auction.summarizedAt ? (
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-forest-700">报告摘要</h3>
              <span className="text-xs text-warm-500 flex-shrink-0">AI 整理，仅供参考</span>
            </div>
            <p className="text-sm text-warm-700 leading-7 tabular-nums">{auction.summary}</p>
          </section>
        ) : (
          auction.ownershipType && (
            <section>
              <h3 className="text-sm font-semibold text-forest-700 mb-1.5">法院描述（德语原文）</h3>
              <p className="text-xs text-warm-600 leading-relaxed">{auction.ownershipType}</p>
            </section>
          )
        )}

        {/* Risk tags */}
        {(auction.riskTags ?? []).length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={13} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-forest-700">风险提示</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(auction.riskTags ?? []).map((tag) => {
                const style = getRiskTagStyle(tag)
                return (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                  >
                    {tag}
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="sticky bottom-0 -mb-4 pb-3 flex flex-wrap items-center gap-2 pt-3 bg-white border-t border-cream-200">
          {auction.detailUrl && (
            <a
              href={auction.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-forest-700 text-cream-100 text-sm font-medium rounded-md hover:bg-forest-600 transition-colors"
            >
              <ExternalLink size={14} />
              司法详情页
            </a>
          )}
          {auction.pdfUrl && (
            <a
              href={auction.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 border border-cream-300 text-warm-700 text-sm font-medium rounded-md hover:border-forest-600 hover:text-forest-700 transition-colors"
            >
              <FileDown size={14} />
              专家报告 PDF
            </a>
          )}
          {auction.shortReportUrl && (
            <a
              href={auction.shortReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 border border-cream-300 text-warm-700 text-sm font-medium rounded-md hover:border-forest-600 hover:text-forest-700 transition-colors"
            >
              <FileText size={14} />
              简版报告
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, sub, color = '#1D3A2A' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-cream-50 rounded-lg px-3 py-2.5 border border-cream-200 min-w-0">
      <div className="text-xs text-warm-500 mb-1">{label}</div>
      <div className="text-base font-semibold leading-snug tabular-nums whitespace-nowrap" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-warm-500 mt-0.5 tabular-nums">{sub}</div>}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-warm-500 mb-1">{label}</dt>
      <dd className="font-medium text-warm-700 tabular-nums">{value}</dd>
    </div>
  )
}
