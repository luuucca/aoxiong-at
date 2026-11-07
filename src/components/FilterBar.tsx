import React from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { FilterState, SortOption, AuctionCategory, TenancyStatus } from '../types/auction'
import { getCategoryLabel, TENANCY_META } from '../utils/formatters'

const CATEGORIES: AuctionCategory[] = [
  'Eigentumswohnung',
  'Wohnungseigentumsobjekt',
  'Einfamilienhaus',
  'Mehrfamilienhaus',
  'Mietshaus',
  'gewerbliche Liegenschaft',
  'Sonstiges',
]

const TENANCY_OPTIONS: TenancyStatus[] = ['vacant', 'limited', 'rented', 'unlimited', 'unknown']

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'added-desc', label: '最新添加' },
  { value: 'date-asc', label: '拍卖日期最近' },
  { value: 'value-desc', label: '估价最高' },
  { value: 'sqm-value-desc', label: '每平米估价最高' },
  { value: 'bid-asc', label: '起拍价最低' },
  { value: 'bid-ratio-asc', label: '起拍/估值比例最低' },
]

interface Props {
  filters: FilterState
  onChange: (filters: FilterState) => void
  resultCount: number
}

export function FilterBar({ filters, onChange, resultCount }: Props) {
  const hasActiveFilter = filters.search !== '' || filters.category !== 'all' || filters.tenancy !== 'all'

  return (
    <div className="flex-shrink-0 bg-white border-b border-cream-200 px-4 py-2.5 lg:px-8">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="搜索地址、案号、类别…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-cream-50 border border-cream-300 rounded-md
                       placeholder:text-warm-400 text-warm-700 focus:outline-none focus:border-forest-600
                       focus:ring-1 focus:ring-forest-600 focus:ring-opacity-30 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-cream-50 border border-cream-300 rounded-md
                       text-warm-700 focus:outline-none focus:border-forest-600 focus:ring-1
                       focus:ring-forest-600 focus:ring-opacity-30 transition-colors cursor-pointer"
          >
            <option value="all">全部类别</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat)} · {cat}
              </option>
            ))}
          </select>
          <SlidersHorizontal
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
          />
        </div>

        {/* Tenancy filter */}
        <div className="relative">
          <select
            value={filters.tenancy}
            onChange={(e) => onChange({ ...filters, tenancy: e.target.value })}
            aria-label="租赁状况"
            className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-cream-50 border border-cream-300 rounded-md
                       text-warm-700 focus:outline-none focus:border-forest-600 focus:ring-1
                       focus:ring-forest-600 focus:ring-opacity-30 transition-colors cursor-pointer"
          >
            <option value="all">全部租赁状况</option>
            <option value="not-unlimited">非无限期出租（已确认）</option>
            {TENANCY_OPTIONS.map((status) => (
              <option key={status} value={status}>{TENANCY_META[status].label}</option>
            ))}
          </select>
          <SlidersHorizontal
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            onClick={() => onChange({ ...filters, search: '', category: 'all', tenancy: 'all' })}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-warm-500 hover:text-forest-700
                       border border-cream-300 rounded-md hover:border-forest-600 transition-colors"
          >
            <X size={12} />
            清除筛选
          </button>
        )}

        {/* Sort + Result count — right side */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as SortOption })}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-cream-50 border border-cream-300 rounded-md
                         text-warm-700 focus:outline-none focus:border-forest-600 focus:ring-1
                         focus:ring-forest-600 focus:ring-opacity-30 transition-colors cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <SlidersHorizontal
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none"
            />
          </div>
          <span className="text-xs text-warm-400">
            显示 <span className="font-semibold text-forest-700">{resultCount}</span> 条
          </span>
        </div>
      </div>
    </div>
  )
}
