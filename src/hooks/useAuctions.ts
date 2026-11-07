import { useState, useEffect, useCallback, useRef } from 'react'
import type { Auction } from '../types/auction'

const AUTO_RELOAD_MS = 30 * 60 * 1000 // 每 30 分钟静默刷新 JSON

export interface RefreshState {
  running: boolean
  progress: string[]        // 最新日志行
  lastLine: string          // 最后一行（进度提示）
  error: string | null
}

export interface UseAuctionsResult {
  auctions: Auction[]
  loading: boolean
  error: string | null
  lastModified: Date | null
  refresh: RefreshState
  reloadData: () => void    // 重新读取 JSON（不跑抓取器）
  triggerScrape: () => void // 触发后台抓取
}

export function useAuctions(): UseAuctionsResult {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastModified, setLastModified] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)
  const [refresh, setRefresh] = useState<RefreshState>({
    running: false,
    progress: [],
    lastLine: '',
    error: null,
  })
  const esRef = useRef<EventSource | null>(null)

  // ── 加载 auctions.json ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    // cache-bust so we always get the freshest file after a scrape
    fetch(`/data/auctions.json?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const lm = res.headers.get('Last-Modified')
        if (lm) setLastModified(new Date(lm))
        return res.json() as Promise<Auction[]>
      })
      .then((data) => {
        const PARKING_KEYWORDS = /stellplatz|parkplatz|garage|tiefgarage|abstellplatz|motorrad|fahrrad/i
        setAuctions(data.filter((a) => {
          if (!(a.estimatedValue > 0 || a.minimumBid > 0)) return false
          // 剔除停车位、车库等非住宅标的
          if (a.propertyType === '车位' || PARKING_KEYWORDS.test(a.ownershipType ?? '')) return false
          // 估值极低（< €15,000）基本是停车位或储藏室
          if (a.estimatedValue > 0 && a.estimatedValue < 15000) return false
          return true
        }))
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(`数据加载失败：${err.message}`)
        setLoading(false)
      })
  }, [tick])

  // ── 每 30 分钟自动静默刷新 JSON ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), AUTO_RELOAD_MS)
    return () => clearInterval(id)
  }, [])

  // ── 手动重新加载 JSON ────────────────────────────────────────────────────
  const reloadData = useCallback(() => setTick((t) => t + 1), [])

  // ── 触发抓取 + SSE 进度流 ─────────────────────────────────────────────────
  const triggerScrape = useCallback(() => {
    if (refresh.running) return

    // 关闭旧的 SSE 连接
    esRef.current?.close()

    setRefresh({ running: true, progress: [], lastLine: '正在连接抓取服务…', error: null })

    // 先触发抓取
    fetch('/api/refresh', { method: 'POST' })
      .then((r) => r.json())
      .then((result) => {
        if (!result.started && result.reason) {
          setRefresh((s) => ({ ...s, running: false, error: result.reason }))
          return
        }
        // 建立 SSE 连接监听进度
        const es = new EventSource('/api/events')
        esRef.current = es

        es.onmessage = (e) => {
          const msg = JSON.parse(e.data) as {
            type: string; line?: string; code?: number; elapsed?: string; count?: number
          }

          if (msg.type === 'log' && msg.line) {
            setRefresh((s) => {
              const progress = [...s.progress, msg.line!].slice(-100)
              return { ...s, progress, lastLine: msg.line! }
            })
          }

          if (msg.type === 'done') {
            es.close()
            esRef.current = null
            const summary = msg.code === 0
              ? `✅ 抓取完成，共 ${msg.count ?? '?'} 条，耗时 ${msg.elapsed}s`
              : `❌ 抓取失败 (exit ${msg.code})`
            setRefresh((s) => ({
              ...s,
              running: false,
              lastLine: summary,
              error: msg.code !== 0 ? summary : null,
            }))
            if (msg.code === 0) {
              // 抓取成功后刷新数据
              setTimeout(() => setTick((t) => t + 1), 500)
            }
          }
        }

        es.onerror = () => {
          es.close()
          esRef.current = null
          setRefresh((s) => ({
            ...s,
            running: false,
            error: '与抓取服务的连接中断，请检查 server.mjs 是否运行',
          }))
        }
      })
      .catch(() => {
        setRefresh({
          running: false,
          progress: [],
          lastLine: '',
          error: 'API 服务器未响应，请先运行 node server.mjs',
        })
      })
  }, [refresh.running])

  return { auctions, loading, error, lastModified, refresh, reloadData, triggerScrape }
}
