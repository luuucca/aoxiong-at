import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'https://aoxiong.at'

/** Must match the <title> in index.html. */
export const DEFAULT_TITLE = '维也纳买房 · 维也纳中文中介 · 奥地利华人房产经纪 | 奥匈置业研究所'

/**
 * index.html declares the homepage as canonical, which would tell search
 * engines every page duplicates it. Point the canonical at the current route.
 * Listing pages get theirs from api/listing-page.js.
 */
export function useRouteCanonical() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (/^\/listings\/[^/]+/.test(pathname)) return
    const url = SITE + pathname
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.setAttribute('href', url))
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url)
  }, [pathname])
}

/** Keeps a page out of search results while it is mounted. */
export function useNoindex() {
  useEffect(() => {
    const el = document.createElement('meta')
    el.name = 'robots'
    el.content = 'noindex'
    document.head.appendChild(el)
    return () => el.remove()
  }, [])
}
