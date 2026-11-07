import React, { useMemo, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useAuctions } from '../hooks/useAuctions'
import { Header } from '../components/Header'
import { StatsCards } from '../components/StatsCards'
import { FilterBar } from '../components/FilterBar'
import { MapView } from '../components/MapView'
import { AuctionList } from '../components/AuctionList'
import { DetailPanel } from '../components/DetailPanel'
import type { FilterState, SortOption } from '../types/auction'
import { bidRatio } from '../utils/formatters'

export default function AuctionPage() {
  const { auctions, loading, error, lastModified, refresh, reloadData, triggerScrape } = useAuctions()
  const [selectedId, setSelectedId] = useState<string>('')
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map')
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    tenancy: 'all',
    sortBy: 'date-asc' as SortOption,
  })

  const liveCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return auctions.filter((a) => !a.auctionDate || a.auctionDate >= today).length
  }, [auctions])

  const filteredAuctions = useMemo(() => {
    const q = filters.search.toLowerCase()
    // Today as YYYY-MM-DD for direct comparison against auctionDate.
    const today = new Date().toISOString().slice(0, 10)
    return auctions
      .filter((a) => {
        // Hide auctions whose date has passed — they're no longer
        // actionable for buyers.
        if (a.auctionDate && a.auctionDate < today) return false

        const matchSearch =
          !q ||
          a.address.toLowerCase().includes(q) ||
          a.caseNumber.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          (a.propertyType ?? '').includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.district.includes(q)
        const matchCategory =
          filters.category === 'all' || (a.propertyType ?? '其他') === filters.category
        const tenancy = a.tenancyStatus ?? 'unknown'
        const matchTenancy =
          filters.tenancy === 'all' ||
          (filters.tenancy === 'not-unlimited'
            ? tenancy === 'vacant' || tenancy === 'limited'
            : tenancy === filters.tenancy)
        return matchSearch && matchCategory && matchTenancy
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case 'added-desc': {
            // Newest first by firstSeenAt. Records scraped before this
            // field was added have firstSeenAt = '' and fall to the
            // bottom, which matches user intent ("最新添加" = most
            // recently added to the dashboard).
            const aSeen = a.firstSeenAt || ''
            const bSeen = b.firstSeenAt || ''
            if (aSeen === bSeen) return a.auctionDate.localeCompare(b.auctionDate)
            return bSeen.localeCompare(aSeen)
          }
          case 'date-asc':       return a.auctionDate.localeCompare(b.auctionDate)
          case 'value-desc':     return b.estimatedValue - a.estimatedValue
          case 'sqm-value-desc': return b.pricePerSqm - a.pricePerSqm
          case 'bid-asc':        return a.minimumBid - b.minimumBid
          case 'bid-ratio-asc':  return bidRatio(a) - bidRatio(b)
          default:               return 0
        }
      })
  }, [auctions, filters])

  const selectedAuction = auctions.find((a) => a.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? '' : id))
  }
  function handleMapPinSelect(id: string) {
    setSelectedId((prev) => (prev === id ? '' : id))
    setMobileTab('list')
  }

  // The global NavBar stays at top (dark). Page content below uses the
  // original cream palette since it's a data-dense dashboard that's
  // easier to scan in light mode.
  // paddingTop: 64px to clear the NavBar.

  if (loading) {
    return (
      <div className="flex flex-col bg-cream-100" style={{ height: '100vh', paddingTop: 64 }}>
        <Header lastModified={lastModified} auctionCount={0} refresh={refresh} onRefresh={triggerScrape} onReloadData={reloadData} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-forest-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-warm-500">正在加载法拍数据…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col bg-cream-100" style={{ height: '100vh', paddingTop: 64 }}>
        <Header lastModified={lastModified} auctionCount={0} refresh={refresh} onRefresh={triggerScrape} onReloadData={reloadData} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-warm-700 mb-1">数据加载失败</p>
            <p className="text-xs text-warm-500 mb-4">{error}</p>
            <button onClick={reloadData} className="inline-flex items-center gap-2 px-4 py-2 bg-forest-700 text-cream-100 text-sm rounded-md hover:bg-forest-600 transition-colors">
              <RefreshCw size={14} />重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-cream-100" style={{ height: '100vh', paddingTop: 64 }}>
      <Header lastModified={lastModified} auctionCount={liveCount} refresh={refresh} onRefresh={triggerScrape} onReloadData={reloadData} />
      <StatsCards liveCount={liveCount} filteredCount={filteredAuctions.length} />
      <FilterBar filters={filters} onChange={setFilters} resultCount={filteredAuctions.length} />

      {/* Mobile: tab switcher */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-shrink-0 border-b border-cream-200 bg-white">
          {(['map', 'list'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: mobileTab === tab ? '#1D3A2A' : '#9A8F85',
                borderBottom: mobileTab === tab ? '2px solid #1D3A2A' : '2px solid transparent',
              }}
            >
              {tab === 'map' ? '🗺 地图' : `📋 列表（${filteredAuctions.length}）`}
            </button>
          ))}
        </div>

        {mobileTab === 'map' && (
          <div className="flex-1 overflow-hidden">
            <MapView auctions={filteredAuctions} selectedId={selectedId} onSelect={handleMapPinSelect} />
          </div>
        )}

        {mobileTab === 'list' && (
          <div className="flex-1 overflow-y-auto">
            {selectedAuction && <DetailPanel auction={selectedAuction} onClose={() => setSelectedId('')} />}
            <AuctionList auctions={filteredAuctions} selectedId={selectedId} onSelect={handleSelect} />
          </div>
        )}
      </div>

      {/* Desktop: fixed height split view */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-clip">
        <div className="w-3/5 overflow-hidden border-r border-cream-200">
          <MapView auctions={filteredAuctions} selectedId={selectedId} onSelect={handleSelect} />
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-clip bg-cream-100">
          {selectedAuction && <DetailPanel auction={selectedAuction} onClose={() => setSelectedId('')} />}
          <AuctionList auctions={filteredAuctions} selectedId={selectedId} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  )
}
