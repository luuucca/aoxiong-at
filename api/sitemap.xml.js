// Dynamic sitemap.xml — pulls active listings from Notion at request time.

const NOTION_API = 'https://api.notion.com/v1'
const SITE = 'https://aoxiong.at'

const STATIC_ROUTES = [
  { path: '/',              changefreq: 'daily',   priority: '1.0' },
  { path: '/listings',      changefreq: 'daily',   priority: '0.9' },
  { path: '/auction',       changefreq: 'hourly',  priority: '0.8' },
  { path: '/quiz',          changefreq: 'monthly', priority: '0.85' },
  { path: '/mortgage',      changefreq: 'monthly', priority: '0.8' },
  { path: '/buying-guide',  changefreq: 'weekly',  priority: '0.95' },
  { path: '/buying-guide/process',     changefreq: 'monthly', priority: '0.9' },
  { path: '/buying-guide/taxes',       changefreq: 'monthly', priority: '0.9' },
  { path: '/buying-guide/loan',        changefreq: 'monthly', priority: '0.9' },
  { path: '/buying-guide/doebling-19', changefreq: 'monthly', priority: '0.85' },
  { path: '/buying-guide/students',    changefreq: 'monthly', priority: '0.85' },
  { path: '/market',        changefreq: 'weekly',  priority: '0.85' },
  { path: '/about',         changefreq: 'monthly', priority: '0.6' },
  { path: '/list-property', changefreq: 'monthly', priority: '0.5' },
  { path: '/datenschutz',   changefreq: 'yearly',  priority: '0.3' },
  { path: '/impressum',     changefreq: 'yearly',  priority: '0.3' },
]

async function fetchListings() {
  const token = process.env.NOTION_TOKEN
  const dbId = process.env.NOTION_DATABASE_ID
  if (!token || !dbId) return []

  const all = []
  let cursor
  do {
    const body = {
      filter: { property: 'Status', select: { equals: 'Active' } },
      page_size: 100,
    }
    if (cursor) body.start_cursor = cursor
    const r = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) break
    const d = await r.json()
    all.push(...(d.results || []))
    cursor = d.has_more ? d.next_cursor : undefined
  } while (cursor)
  return all
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const now = new Date().toISOString().split('T')[0]
  const listings = await fetchListings()

  const urls = []
  for (const r of STATIC_ROUTES) {
    urls.push(
      `  <url>\n    <loc>${SITE}${r.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
    )
  }
  for (const l of listings) {
    const lastEdit = (l.last_edited_time || '').split('T')[0] || now
    urls.push(
      `  <url>\n    <loc>${SITE}/listings/${escapeXml(l.id)}</loc>\n    <lastmod>${lastEdit}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  res.status(200).send(xml)
}
