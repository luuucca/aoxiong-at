/**
 * fetch-auctions.mjs
 * ==================
 * 直接 HTTP 抓取 Ediktsdatei 维也纳法拍房数据（无需浏览器）。
 *
 * 运行：node scripts/fetch-auctions.mjs
 *
 * ⚠️  合规提醒：
 *   - 每日最多运行一次，禁止高频批量抓取
 *   - 脚本内置 2 秒延迟，请勿删除
 *   - 数据仅供内部投资尽调研究使用
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { geocodeAddress } from './geocode-auction.mjs';
import { extractTenancyText, classifyTenancy, publicTenancyQuote } from './tenancy.mjs';
import { classifyPropertyType } from './property-type.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'public', 'data', 'auctions.json');
const BASE = 'https://edikte.justiz.gv.at/edikte/ex/exedi3.nsf';
const SEARCH_URL =
  `${BASE}/suchedi?SearchView&subf=eex&SearchOrder=4&SearchMax=4999` +
  `&retfields=~BL%3D0&ftquery=&query=%28%5BBL%5D%3D%280%29%29`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'de-AT,de;q=0.9',
  'Accept': 'text/html,application/xhtml+xml',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Parsers ────────────────────────────────────────────────────────────────────

function parseEuro(text) {
  if (!text) return 0;
  const m = text.match(/([\d.]+,\d{2})/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

function parseArea(text) {
  if (!text) return 0;
  const m = text.match(/([\d.,]+)\s*m/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

function parseDate(text) {
  if (!text) return '';
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function extractField(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match label → </span> → <p ...> ... </p>, content may include <br> tags
  const m = html.match(
    new RegExp(`${esc}[^<]*<\\/span>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`, 's')
  );
  if (!m) return '';
  return m[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#178;/g, '²')
    .trim();
}

const CATEGORY_NORM = {
  'Eigentumswohnung': 'Eigentumswohnung',
  'Wohnungseigentumsobjekt': 'Wohnungseigentumsobjekt',
  'Einfamilienhaus': 'Einfamilienhaus',
  'Zweifamilienhaus': 'Einfamilienhaus',
  'Reihenhaus': 'Einfamilienhaus',
  'Mehrfamilienhaus': 'Mehrfamilienhaus',
  'Mietshaus': 'Mietshaus',
  'Mietwohnhaus': 'Mietshaus',
  'gemischt genutztes': 'Mehrfamilienhaus',
  'gewerbliche Liegenschaft': 'gewerbliche Liegenschaft',
  'Geschäftslokal': 'gewerbliche Liegenschaft',
  'Büro': 'gewerbliche Liegenschaft',
  'Gewerbe': 'gewerbliche Liegenschaft',
};

function normalizeCategory(raw) {
  if (!raw) return 'Sonstiges';
  for (const [key, val] of Object.entries(CATEGORY_NORM)) {
    if (raw.includes(key)) return val;
  }
  return 'Sonstiges';
}

function makeId(unid) {
  return 'wien-' + unid.slice(0, 12);
}

// ── Parse search results page ─────────────────────────────────────────────────

function parseSearchResults(html) {
  const entries = [];
  // Match all <tr> rows that contain auction entries
  const rowRe = /<tr>\s*<td[^>]*>[\s\S]*?count\(\)[\s\S]*?<\/td>\s*<td[^>]*>[\s\S]*?<a\s+href="(alldoc\/[a-f0-9]+)!OpenDocument"[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const unidPath = m[1]; // e.g. "alldoc/abc123..."
    const dateText = m[2].trim(); // e.g. "Versteigerung (18.05.2026)" or "Verschiebung (von ... auf ...)"
    const addressCell = m[3].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    const titleCell = m[4].replace(/<[^>]+>/g, '').trim();

    const lines = addressCell.split('\n').map(l => l.trim()).filter(Boolean);
    const address = lines[0] || '';
    const categoriesRaw = lines.slice(1).join(', ');

    // Extract PLZ from address like "1180 Wien Gersthofer Straße 10"
    const plzMatch = address.match(/\b(1[0-2]\d0)\b/);
    const plz = plzMatch ? plzMatch[1] : '';

    // Parse the date — handle both "Versteigerung (DD.MM.YYYY)" and "Verschiebung (von ... auf DD.MM.YYYY)"
    let auctionDate = '';
    const dateMatches = [...dateText.matchAll(/(\d{1,2}\.\d{1,2}\.\d{4})/g)];
    if (dateMatches.length > 0) {
      // Take the LAST date (for postponements, that's the new date)
      auctionDate = parseDate(dateMatches[dateMatches.length - 1][1]);
    }

    const isPostponed = dateText.toLowerCase().includes('verschiebung');

    // Skip completed/cancelled entries — only keep active auctions.
    // (Earlier experiment with "Zuschlag mit Überbot" was rolled back
    //  per product decision.)
    const isActive = /^(Versteigerung|Verschiebung)/i.test(dateText);
    if (!isActive) continue;

    entries.push({
      unidPath,
      unid: unidPath.replace('alldoc/', ''),
      detailUrl: `${BASE}/${unidPath}!OpenDocument`,
      auctionDate,
      isPostponed,
      address,
      plz,
      categoriesRaw,
      titleFromList: titleCell,
    });
  }

  return entries;
}

// ── Parse detail page ─────────────────────────────────────────────────────────

function parseDetailPage(html, entry) {
  const caseNumber = extractField(html, 'Aktenzeichen');

  // Title: from <h1><small>...</small></h1>, strip "Verschiebung - " prefix
  const h1Match = html.match(/<h1[^>]*>\s*<small>([^<]+)<\/small>\s*<\/h1>/);
  let title = h1Match ? h1Match[1].trim() : entry.titleFromList;
  title = title.replace(/^Verschiebung\s*[-–]\s*/i, '').trim();

  // Auction date — prefer "Neuer Versteigerungstermin" for postponements
  let auctionDate = entry.auctionDate;
  const neuerTerminMatch = html.match(/Neuer Versteigerungstermin[^:]*:\s*<[^>]+>\s*<strong>\s*am\s+(\d{1,2}\.\d{1,2}\.\d{4})/);
  const terminMatch = html.match(/Versteigerungstermin[^:]*:\s*<[^>]+>\s*<strong>\s*am\s+(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (neuerTerminMatch) auctionDate = parseDate(neuerTerminMatch[1]);
  else if (terminMatch) auctionDate = parseDate(terminMatch[1]);

  // Financial fields
  const schatzwertText = extractField(html, 'Schätzwert');
  const mindestgebotText = extractField(html, 'Geringstes Gebot');
  const vadiumText = extractField(html, 'Vadium');

  // Area — try dedicated field first, then parse from Beschreibung
  let areaText = extractField(html, 'Objektgröße');
  if (!areaText) {
    // Try to find in description text: "ca. 327,46 m²" or "327,46 m²"
    const areaInDesc = html.match(/(?:ca\.\s*)?([\d]+[,.][\d]+)\s*m(?:&#178;|²)/);
    if (areaInDesc) areaText = areaInDesc[1] + ' m²';
  }

  // Category from detail page
  const categoryRaw = extractField(html, 'Kategorie(n)') || entry.categoriesRaw;

  // Address from detail page (Liegenschaftsadresse + PLZ/Ort)
  const strasse = extractField(html, 'Liegenschaftsadresse');
  const plzOrt = extractField(html, 'PLZ/Ort');
  const detailAddress = strasse && plzOrt ? `${plzOrt} ${strasse}` : entry.address;

  // PDF links
  const pdfMatches = [...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)];
  const pdfUrl = pdfMatches.length > 0
    ? (pdfMatches[0][1].startsWith('http') ? pdfMatches[0][1] : `https://edikte.justiz.gv.at${pdfMatches[0][1]}`)
    : '';

  // Kurzgutachten (short report) — internal link (not PDF)
  const kurzMatch = html.match(/Kurzgutachten:\s*<\/strong>\s*<\/span>\s*<p[^>]*>\s*<a\s+href="(\/edikte\/ex\/[^"]+)"/i);
  const shortReportUrl = kurzMatch ? `https://edikte.justiz.gv.at${kurzMatch[1]}` : '';

  // Ownership / Beschreibung
  const beschreibung = extractField(html, 'Beschreibung (WE)') || extractField(html, 'Beschreibung');

  return {
    caseNumber: caseNumber.replace(/\s+/g, ' ').trim(),
    title,
    auctionDate,
    address: detailAddress || entry.address,
    categoryRaw,
    estimatedValue: parseEuro(schatzwertText),
    minimumBid: parseEuro(mindestgebotText),
    deposit: parseEuro(vadiumText),
    area: parseArea(areaText),
    pdfUrl,
    shortReportUrl,
    ownershipType: beschreibung.substring(0, 200),
  };
}

// ── Upsert ────────────────────────────────────────────────────────────────────

function loadExisting() {
  if (existsSync(OUTPUT_PATH)) {
    try { return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')); } catch { return []; }
  }
  return [];
}

function upsert(existing, incoming) {
  // Use UNID-based id as the unique key (each unit/document has its own UNID)
  const idx = new Map(existing.map((r, i) => [r.id, i]));
  let added = 0, updated = 0;
  const now = new Date().toISOString();
  const merged = [...existing];

  for (const rec of incoming) {
    const key = rec.id;
    if (idx.has(key)) {
      const i = idx.get(key);
      // A failed lookup falls back to the district centre; don't let that move a known position.
      const keepPosition = rec.geocodeSource === 'approximate' && merged[i].geocodeSource === 'official';
      // A status read from the full report outranks the keyword scan of the short report.
      const keepReportTenancy = merged[i].tenancySource === 'report';
      merged[i] = {
        ...rec,
        ...(keepPosition && {
          latitude: merged[i].latitude,
          longitude: merged[i].longitude,
          geocodeSource: merged[i].geocodeSource,
        }),
        ...(keepReportTenancy ? {
          tenancyStatus: merged[i].tenancyStatus,
          tenancyText: merged[i].tenancyText,
          tenancySource: 'report',
        } : {
          tenancyStatus: rec.tenancyStatus ?? merged[i].tenancyStatus,
          tenancyText: rec.tenancyText ?? merged[i].tenancyText,
        }),
        // A type or note set by hand after reading the report is kept.
        propertyType: merged[i].propertyType || rec.propertyType,
        propertyNote: merged[i].propertyNote,
        summary: merged[i].summary || rec.summary,
        riskTags: merged[i].riskTags?.length ? merged[i].riskTags : rec.riskTags,
        shortReportUrl: merged[i].shortReportUrl || rec.shortReportUrl,
        // Marks a record whose Chinese summary is done (scripts/report-summaries.mjs).
        // Paired with summary/riskTags above.
        summarizedAt: merged[i].summarizedAt || rec.summarizedAt,
        // Preserve the original "first seen" stamp across re-runs.
        // Old records without it stay without it — the frontend treats
        // missing firstSeenAt as oldest in the "newest added" sort.
        firstSeenAt: merged[i].firstSeenAt || rec.firstSeenAt || '',
      };
      updated++;
    } else {
      merged.push({ ...rec, firstSeenAt: now });
      idx.set(key, merged.length - 1);
      added++;
    }
  }
  return { merged, added, updated };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('维也纳法拍房数据抓取脚本 v3.0 (直接 HTTP, 无需浏览器)');
  console.log('来源：Ediktsdatei - Bundesministerium für Justiz');
  console.log('='.repeat(60));

  // 1. Fetch search results
  console.log('\n[1/3] 抓取搜索结果页...');
  const searchRes = await fetch(SEARCH_URL, { headers: HEADERS });
  if (!searchRes.ok) throw new Error(`Search page HTTP ${searchRes.status}`);
  const searchHtml = await searchRes.text();
  console.log(`  页面大小: ${searchHtml.length} bytes`);

  const entries = parseSearchResults(searchHtml);
  console.log(`  解析到 ${entries.length} 条记录`);

  if (entries.length === 0) {
    console.error('  ❌ 未解析到任何记录！请检查 scripts/debug_search.html');
    writeFileSync(join(__dirname, 'debug_search.html'), searchHtml, 'utf8');
    process.exit(1);
  }

  // Save debug
  writeFileSync(join(__dirname, 'debug_search.html'), searchHtml, 'utf8');

  // 2. Fetch each detail page
  console.log(`\n[2/3] 抓取 ${entries.length} 个详情页（每页间隔 2 秒）...`);
  const existing = loadExisting();
  const records = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.address.substring(0, 50)}...`);

    try {
      await sleep(2000); // polite delay — do not remove
      const detailRes = await fetch(entry.detailUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
      if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status}`);
      const detailHtml = await detailRes.text();

      const parsed = parseDetailPage(detailHtml, entry);

      // Tenancy: the short report has the structured field; older cases only have the detail page.
      // A failed fetch leaves these undefined so upsert keeps what we already know.
      let tenancy = {};
      try {
        let reportHtml = detailHtml;
        if (parsed.shortReportUrl) {
          await sleep(1000);
          const reportRes = await fetch(parsed.shortReportUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
          if (!reportRes.ok) throw new Error(`HTTP ${reportRes.status}`);
          reportHtml = await reportRes.text();
        }
        const text = extractTenancyText(reportHtml) || extractTenancyText(detailHtml);
        tenancy = { tenancyStatus: classifyTenancy(text), tenancyText: publicTenancyQuote(text) };
      } catch (err) {
        console.warn(`\n  tenancy lookup failed: ${err.message}`);
      }

      // Geocode
      const plz = entry.plz || parsed.address.match(/\b(1[0-2]\d0)\b/)?.[1] || '';
      // Extract street part for geocoding
      const streetForGeo = parsed.address.replace(/^\d{4}\s+Wien\s+/, '');
      const geo = await geocodeAddress(streetForGeo, plz);

      const estimatedValue = parsed.estimatedValue;
      const area = parsed.area;

      const record = {
        id: makeId(entry.unid),
        caseNumber: parsed.caseNumber,
        auctionDate: parsed.auctionDate,
        address: parsed.address,
        district: plz,
        title: parsed.title || entry.titleFromList,
        category: normalizeCategory(parsed.categoryRaw),
        propertyType: classifyPropertyType({ categoryRaw: parsed.categoryRaw, text: parsed.ownershipType }),
        estimatedValue,
        minimumBid: parsed.minimumBid,
        area,
        pricePerSqm: area > 0 && estimatedValue > 0
          ? Math.round((estimatedValue / area) * 100) / 100
          : 0,
        deposit: parsed.deposit,
        latitude: geo.lat,
        longitude: geo.lng,
        geocodeSource: geo.geocodeSource,
        ownershipType: parsed.ownershipType,
        summary: parsed.ownershipType || '',
        riskTags: [],
        detailUrl: entry.detailUrl,
        pdfUrl: parsed.pdfUrl,
        shortReportUrl: parsed.shortReportUrl,
        ...tenancy,
      };

      records.push(record);
      console.log(` ✓ ${parsed.caseNumber} | ${parsed.estimatedValue > 0 ? `€${(parsed.estimatedValue/1e6).toFixed(2)}M` : '?'}`);
    } catch (e) {
      console.log(` ✗ ${e.message}`);
    }
  }

  // 3. Upsert and save
  console.log(`\n[3/3] 合并写入 auctions.json...`);
  const { merged, added, updated } = upsert(existing, records);
  console.log(`  新增: ${added}, 更新: ${updated}, 总计: ${merged.length}`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`  ✅ 写入完成: ${OUTPUT_PATH}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
