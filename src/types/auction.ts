export type AuctionCategory =
  | 'Eigentumswohnung'
  | 'Wohnungseigentumsobjekt'
  | 'Einfamilienhaus'
  | 'Mehrfamilienhaus'
  | 'Mietshaus'
  | 'gewerbliche Liegenschaft'
  | 'Sonstiges'

/** What is actually being sold. See scripts/property-type.mjs. */
export type PropertyType = '公寓' | '独栋住宅' | '出租楼' | '店铺' | '办公商业' | '地皮' | '阁楼毛坯' | '车位' | '其他'

export type GeocodeSource = 'official' | 'manual' | 'approximate'

/** From the court report's Bestandsverhältnisse. See scripts/tenancy.mjs. */
export type TenancyStatus = 'vacant' | 'limited' | 'rented' | 'unlimited' | 'unknown'

export type SortOption =
  | 'date-asc'
  | 'value-desc'
  | 'sqm-value-desc'
  | 'bid-asc'
  | 'bid-ratio-asc'
  | 'added-desc'

export interface Auction {
  id: string
  caseNumber: string
  auctionDate: string
  address: string
  district: string
  title: string
  category: AuctionCategory
  estimatedValue: number
  minimumBid: number
  area: number
  pricePerSqm: number
  deposit: number
  latitude: number
  longitude: number
  /**
   * geocodeSource 标识坐标来源精度：
   * - 'official'    : 通过 Stadt Wien OGD AddressService 接口精确落点（正式上线时应使用此方式）
   * - 'manual'      : 人工标注的精确坐标
   * - 'approximate' : 当前演示版本使用的近似坐标（以区级中心点估算）
   *
   * 正式版本接入建议：使用 https://data.wien.gv.at/ogdwien/rest/ogdaddress
   * 参数：ADDRESS=<地址>&SRSNAME=EPSG:4326
   * 返回 GeoJSON，提取 coordinates[1] (lat) 和 coordinates[0] (lng)
   */
  geocodeSource: GeocodeSource
  ownershipType: string
  summary: string
  riskTags: string[]
  detailUrl: string
  pdfUrl: string
  shortReportUrl: string
  tenancyStatus?: TenancyStatus
  /** The report's wording, when short and free of personal names. */
  tenancyText?: string
  /** "report" when tenancy was read from the full Gutachten rather than the short report. */
  tenancySource?: 'report'
  propertyType?: PropertyType
  /** Refines the type, e.g. 建筑权 for a building right rather than owned land. */
  propertyNote?: string
  /** ISO timestamp of when the scraper first encountered this UNID. */
  firstSeenAt?: string
  /** ISO timestamp of when the Chinese summary + riskTags were written (scripts/report-summaries.mjs). */
  summarizedAt?: string
}

export interface FilterState {
  search: string
  category: string
  /** A TenancyStatus, or 'all', or 'not-unlimited' (vacant + limited). */
  tenancy: string
  sortBy: SortOption
}
