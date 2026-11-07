/**
 * Rebuilds the `tram` part of public/data/transit-vienna.json from OpenStreetMap
 * route relations, so every tram line has its number and its own colour.
 *
 *   node scripts/build-tram-lines.mjs
 *
 * Wiener Linien publishes no tram colours, so these are ours. Lines that share
 * track get different colours, otherwise they would read as one line on the map.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'transit-vienna.json');
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const QUERY = `[out:json][timeout:180];
rel["route"="tram"]["ref"](48.10,16.18,48.33,16.58);
out geom;`;

// Saturated enough to stand out on the grey basemap, and away from the U-Bahn colours.
const PALETTE = ['#E6007E', '#0091D5', '#00A887', '#7B3FE4', '#D81E5B', '#0047AB', '#6AA500', '#C2185B', '#008C95', '#F08A00', '#3F51B5', '#A0522D'];
const LINE_REF = /^(\d{1,2}|[A-Z])$/;
const round = (n) => Math.round(n * 100000) / 100000;

async function queryOverpass() {
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'aoxiong-website/1.0 (tram-lines)', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(200000),
      });
      if (res.ok) return res.json();
      console.log(`[retry] ${url}: HTTP ${res.status}`);
    } catch (e) {
      console.log(`[retry] ${url}: ${e.message}`);
    }
  }
  throw new Error('All Overpass servers failed');
}

const { elements } = await queryOverpass();

// Each line has one relation per direction: merge them, keeping every way once.
const lines = new Map();
for (const rel of elements) {
  const ref = rel.tags?.ref?.trim();
  if (!ref || !LINE_REF.test(ref)) { console.log(`[skipped] ref ${ref}: ${rel.tags?.name ?? ''}`); continue; }
  if (!lines.has(ref)) lines.set(ref, new Map());
  const ways = lines.get(ref);
  for (const m of rel.members ?? []) {
    if (m.type !== 'way' || !m.geometry || (m.role && m.role !== 'forward' && m.role !== 'backward')) continue;
    if (!ways.has(m.ref)) ways.set(m.ref, m.geometry.map((p) => [round(p.lon), round(p.lat)]));
  }
}

const refs = [...lines.keys()].filter((r) => lines.get(r).size > 0).sort((a, b) => (Number(a) || 1000) - (Number(b) || 1000) || a.localeCompare(b));
// Vienna runs over 20 lines. Fewer means a bad response, so keep the existing data.
if (refs.length < 20) throw new Error(`Only ${refs.length} tram lines returned from ${elements.length} relations`);

// Greedy colouring: busiest lines first, avoiding colours of lines sharing track.
const shared = (a, b) => [...lines.get(a).keys()].filter((id) => lines.get(b).has(id)).length;
const order = [...refs].sort((a, b) => lines.get(b).size - lines.get(a).size);
const colourOf = new Map();
for (const ref of order) {
  const taken = order.filter((o) => colourOf.has(o) && shared(ref, o) > 0).map((o) => colourOf.get(o));
  const uses = (c) => [...colourOf.values()].filter((v) => v === c).length;
  const free = PALETTE.filter((c) => !taken.includes(c)).sort((x, y) => uses(x) - uses(y));
  colourOf.set(ref, free[0] ?? PALETTE[colourOf.size % PALETTE.length]);
}

// One label per line, on the point of the line furthest from labels already placed.
const dist2 = ([a, b], [c, d]) => (a - c) ** 2 + ((b - d) * 1.5) ** 2;
const placed = [];
const tram = refs.map((ref) => {
  const coords = [...lines.get(ref).values()];
  const points = coords.flat();
  let label = points[Math.floor(points.length / 2)];
  let best = -1;
  for (const p of points) {
    const near = placed.length ? Math.min(...placed.map((q) => dist2(p, q))) : 1;
    if (near > best) { best = near; label = p; }
  }
  placed.push(label);
  return { ref, colour: colourOf.get(ref), label, coords };
});

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
data.tram = tram;
writeFileSync(DATA_PATH, JSON.stringify(data));

const clashes = refs.flatMap((a, i) => refs.slice(i + 1).filter((b) => shared(a, b) > 0 && colourOf.get(a) === colourOf.get(b)).map((b) => `${a}/${b}`));
console.log(`${tram.length} lines:`, tram.map((l) => `${l.ref}(${l.coords.length})`).join(' '));
console.log('same colour on shared track:', clashes.join(' ') || 'none');
console.log('file MB', (JSON.stringify(data).length / 1e6).toFixed(2));
