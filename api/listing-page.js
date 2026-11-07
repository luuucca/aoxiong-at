// Serves /listings/:id: the SPA shell with that listing's title, description,
// canonical and share image already in the HTML. Share scrapers don't run JS,
// so setting these on the client is not enough.
//
// The page must still open when Notion fails, so those paths fall back to the
// plain shell and the client loads the listing itself.

import { NOTION_API, notionHeaders, normalize } from './listings.js'

const SITE = 'https://aoxiong.at'
const SITE_NAME = '奥匈置业研究所'
const NOTION_TIMEOUT_MS = 2000
const NOTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

// index.html has hashed asset names, so it is fetched from this same deployment.
// It can't change during a deployment's lifetime, so it is safe to keep in memory.
let shellCache = null

async function loadShell(req) {
  if (shellCache) return shellCache
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const r = await fetch(`https://${host}/index.html`, {
    // Lets the fetch through Vercel's protection on preview deployments.
    headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
  })
  if (!r.ok) throw new Error(`Shell fetch failed: ${r.status}`)
  shellCache = await r.text()
  return shellCache
}

/** Returns the Notion page, or null if it doesn't exist. Throws on outages, rate limits and timeouts. */
async function loadPage(id) {
  const r = await fetch(`${NOTION_API}/pages/${id}`, {
    headers: notionHeaders(),
    signal: AbortSignal.timeout(NOTION_TIMEOUT_MS),
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Notion error ${r.status}`)
  return r.json()
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Replacements are functions so a `$` in listing text is never read as a regex group.
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`)
  return html.replace(re, (_, open, close) => open + escapeHtml(value) + close)
}

function setUrls(html, url) {
  const safe = escapeHtml(url)
  const withLinks = html
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, (_, a, b) => a + safe + b)
    .replace(/(<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href=")[^"]*(")/g, (_, a, b) => a + safe + b)
  return setMeta(withLinks, 'property', 'og:url', url)
}

function noindex(html) {
  return html.replace('</head>', () => '  <meta name="robots" content="noindex" />\n  </head>')
}

function formatPrice(l) {
  if (l.priceOnRequest) return '价格面议'
  const price = `€ ${l.price.toLocaleString('de-DE')}`
  return l.forRent ? `月租 ${price}` : `售价 ${price}`
}

function renderListing(shell, l) {
  const title = `${l.title} | ${SITE_NAME}`
  const description = `${l.title}，${formatPrice(l)}。${SITE_NAME}，维也纳买房全程中文服务。`

  let html = setUrls(shell, `${SITE}/listings/${l.id}`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)

  for (const [attr, key, value] of [
    ['name', 'description', description],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ]) {
    html = setMeta(html, attr, key, value)
  }

  if (l.coverImage) {
    html = setMeta(html, 'property', 'og:image', l.coverImage)
    html = setMeta(html, 'name', 'twitter:image', l.coverImage)
    // These describe the 512px logo in the shell, not the listing photo.
    html = html.replace(/\s*<meta\s+property="og:image:(?:width|height)"[^>]*>/g, () => '')
  }
  return l.status === 'Active' ? html : noindex(html)
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  const id = String(req.query?.id || '')

  let shell
  try {
    shell = await loadShell(req)
  } catch (err) {
    console.error('listing-page shell:', err)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).send('<!doctype html><meta charset="utf-8"><p>页面暂时无法打开，请稍后刷新。</p>')
  }

  const notFound = () => {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60')
    return res.status(404).send(noindex(setUrls(shell, `${SITE}/listings/${encodeURIComponent(id)}`)))
  }
  if (!NOTION_ID.test(id)) return notFound()

  try {
    const page = await loadPage(id)
    if (!page) return notFound()
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600')
    return res.status(200).send(renderListing(shell, normalize(page)))
  } catch (err) {
    console.error('listing-page notion:', err)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(setUrls(shell, `${SITE}/listings/${id}`))
  }
}
