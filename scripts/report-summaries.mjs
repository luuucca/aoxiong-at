/**
 * Chinese summaries of the court Gutachten PDFs, written by Claude in a Claude
 * Code session rather than by an API call in the daily job.
 *
 *   node scripts/report-summaries.mjs prepare <workDir>
 *     Downloads the reports of live, displayed records that have no summary yet,
 *     and writes <workDir>/manifest.json plus one extract per report.
 *
 *   node scripts/report-summaries.mjs apply <workDir> <results.json>
 *     Validates [{ id, summary, riskTags, tenancy }] and writes it to auctions.json.
 *     Anything that fails validation is reported and left out.
 *
 * Requires pdftotext on PATH.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyTenancy, publicTenancyQuote } from './tenancy.mjs'

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'auctions.json')
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }

// Must match the dashboard's filter in src/hooks/useAuctions.ts.
const PARKING = /stellplatz|parkplatz|garage|tiefgarage|abstellplatz|motorrad|fahrrad/i
const FIRST_PAGES = 12
const BASE_CHARS = 15000
const CHARS_PER_EXTRA_UNIT = 4000
const MAX_CHARS = 40000
const TOPICS = /Bestand|Miet|vermietet|leerstehend|Zustand|Baujahr|Errichtung|Mängel|Schäden|Feuchtigkeit|Sanierung|Renovierung|Servitut|Dienstbarkeit|Wohnrecht|Fruchtgenuss|Belastung|Denkmal|Schutzzone|Rückstand|Rücklage|Baubewilligung|Konsens|Kontamination|Altlast|Zusammenfassung|Verkehrswert|Betriebskosten|Hausverwaltung/gi

// The tenancy badge already says these, so a tag repeating them is noise.
const TENANCY_TAGS = /^(定期出租|无限期出租|已出租|无租约|空置)$/
const UNTRANSLATED = /Sachwert|Hochparterre|Souterrain|Mezzanin|Fernwärme|Bausperre|Mansarde|Zinshaus|\d\.\s?OG/

const today = () => new Date().toISOString().slice(0, 10)
const keyOf = (url) => createHash('sha1').update(url).digest('hex').slice(0, 10)
const squeeze = (text) => text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()

function isPending(a) {
  if (a.auctionDate < today() || !a.pdfUrl || a.summarizedAt) return false
  if (!(a.estimatedValue > 0 || a.minimumBid > 0)) return false
  if (a.estimatedValue > 0 && a.estimatedValue < 15000) return false
  return !PARKING.test(a.ownershipType ?? '')
}

function buildExtract(pages, units) {
  const budget = Math.min(MAX_CHARS, BASE_CHARS + CHARS_PER_EXTRA_UNIT * (units.length - 1))
  const tops = units.flatMap((u) => u.address.match(/Top\s*[\w.-]+/gi) ?? [])
  const score = (page) => (page.match(TOPICS)?.length ?? 0) + (tops.some((t) => page.includes(t)) ? 5 : 0)

  const chosen = new Set()
  let used = 0
  const take = (i) => {
    const size = pages[i].length
    if (chosen.has(i) || !size || used + size > budget) return
    chosen.add(i)
    used += size
  }
  for (let i = 0; i < Math.min(FIRST_PAGES, pages.length); i++) take(i)
  pages
    .map((page, i) => ({ i, s: score(page) }))
    .filter((p) => p.s > 0)
    .sort((a, b) => b.s - a.s)
    .forEach((p) => take(p.i))

  return [...chosen].sort((a, b) => a - b).map((i) => `[Seite ${i + 1}]\n${pages[i]}`).join('\n\n')
}

async function prepare(workDir) {
  mkdirSync(workDir, { recursive: true })
  const groups = new Map()
  for (const a of JSON.parse(readFileSync(DATA_PATH, 'utf8')).filter(isPending)) {
    if (!groups.has(a.pdfUrl)) groups.set(a.pdfUrl, [])
    groups.get(a.pdfUrl).push(a)
  }

  const manifest = []
  for (const [url, records] of groups) {
    const key = keyOf(url)
    const pdf = join(workDir, `${key}.pdf`)
    const units = records.map(({ id, address, category, area, estimatedValue, minimumBid, ownershipType, tenancyStatus }) =>
      ({ id, address, category, area, estimatedValue, minimumBid, ownershipType, tenancyStatus }))
    try {
      if (!existsSync(pdf)) {
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(120000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        writeFileSync(pdf, Buffer.from(await res.arrayBuffer()))
      }
      const txt = join(workDir, `${key}.txt`)
      execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, txt], { stdio: 'ignore' })
      const pages = readFileSync(txt, 'utf8').split('\f').map(squeeze)
      if (!pages.at(-1)) pages.pop()
      const extract = buildExtract(pages, units)
      writeFileSync(join(workDir, `${key}.extract.txt`), extract)
      const blankPages = pages.flatMap((p, i) => (p.length < 30 ? [i + 1] : []))
      manifest.push({ key, url, pdf, pages: pages.length, blankPages, extractChars: extract.length, units })
    } catch (e) {
      console.log(`[failed] ${records[0].address}: ${e.message}`)
    }
  }
  writeFileSync(join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 1))
  const count = manifest.reduce((n, m) => n + m.units.length, 0)
  const chars = manifest.reduce((n, m) => n + m.extractChars, 0)
  console.log(`${count} records, ${manifest.length} reports, ${chars} extract chars`)
}

// PDF line breaks split and hyphenate words, so compare without whitespace.
const comparable = (text) => text.replace(/-\s*\n\s*/g, '').replace(/\s+/g, '').toLowerCase()

function problemsWith(result, reportText) {
  const problems = []
  const { summary, riskTags, tenancy } = result
  if (typeof summary !== 'string' || summary.length < 60 || summary.length > 400) problems.push(`summary length ${summary?.length}`)
  if (!/\p{Script=Han}/u.test(summary ?? '')) problems.push('summary is not Chinese')
  // Reports name owners and tenants; the dashboard is public.
  if (/先生|女士|\b(Frau|Herrn?|Dr\.|Mag\.|Ing\.|DI)\s/.test(summary ?? '')) problems.push('summary names a person')
  if (UNTRANSLATED.test(summary ?? '')) problems.push('summary has untranslated German terms')
  if (riskTags?.some?.((t) => TENANCY_TAGS.test(t))) problems.push('a tag repeats the tenancy status')
  if (new Set(riskTags).size !== riskTags?.length) problems.push('duplicate tags')
  if (!Array.isArray(riskTags) || riskTags.length > 6 || riskTags.some((t) => typeof t !== 'string' || !t || t.length > 10)) problems.push('bad riskTags')
  if (tenancy) {
    if (!comparable(reportText).includes(comparable(tenancy.quote ?? '_'))) problems.push('tenancy quote not found in report')
    else if (classifyTenancy(tenancy.quote) !== tenancy.status) problems.push(`tenancy quote reads as ${classifyTenancy(tenancy.quote)}, not ${tenancy.status}`)
  }
  return problems
}

function apply(workDir, resultsPath) {
  const all = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const manifest = JSON.parse(readFileSync(join(workDir, 'manifest.json'), 'utf8'))
  const reportOf = new Map(manifest.flatMap((m) => m.units.map((u) => [u.id, m.key])))
  const results = JSON.parse(readFileSync(resultsPath, 'utf8'))
  const now = new Date().toISOString()
  let applied = 0
  let tenancyChanged = 0

  for (const result of results) {
    const record = all.find((a) => a.id === result.id)
    const key = reportOf.get(result.id)
    if (!record || !key) {
      console.log(`[skipped] unknown id ${result.id}`)
      continue
    }
    const problems = problemsWith(result, readFileSync(join(workDir, `${key}.txt`), 'utf8'))
    if (problems.length) {
      console.log(`[rejected] ${record.address.slice(0, 50)}: ${problems.join('; ')}`)
      continue
    }
    record.summary = result.summary.trim()
    record.riskTags = result.riskTags
    record.summarizedAt = now
    if (result.propertyType) record.propertyType = result.propertyType
    if (result.propertyNote) record.propertyNote = result.propertyNote
    applied++
    // The report only fills gaps: it never overrules the court's short report.
    if (result.tenancy && ['unknown', 'rented'].includes(record.tenancyStatus) && result.tenancy.status !== record.tenancyStatus) {
      console.log(`[tenancy] ${record.tenancyStatus} -> ${result.tenancy.status}: ${record.address.slice(0, 50)}`)
      record.tenancyStatus = result.tenancy.status
      record.tenancyText = publicTenancyQuote(result.tenancy.quote)
      record.tenancySource = 'report'
      tenancyChanged++
    }
  }
  writeFileSync(DATA_PATH, JSON.stringify(all, null, 2))
  console.log(`applied ${applied} of ${results.length}, tenancy changed on ${tenancyChanged}`)
}

const [command, workDir, resultsPath] = process.argv.slice(2)
if (command === 'prepare' && workDir) await prepare(workDir)
else if (command === 'apply' && workDir && resultsPath) apply(workDir, resultsPath)
else {
  console.error('Usage: report-summaries.mjs prepare <workDir> | apply <workDir> <results.json>')
  process.exit(1)
}
