/**
 * Adds `nearestStation` to each auction: the U-Bahn station with the shortest
 * walk, its lines, and the walking distance and time.
 *
 *   node scripts/nearest-station.mjs        (backfill public/data/auctions.json)
 *
 * fetch-auctions.mjs calls addNearestStations() on every run. Only upcoming
 * records that have no station yet, or whose position moved, are looked up, so
 * the daily job makes a request only for new or re-geocoded records.
 *
 * Walking routes come from the FOSSGIS OSRM foot server (routing.openstreetmap.de),
 * several properties per request because each request can take 10 s or more.
 * If it fails, the straight-line distance is stored with `walk: false`, and the
 * next run tries the route again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSIT_PATH = join(ROOT, 'public', 'data', 'transit-vienna.json');
const AUCTIONS_PATH = join(ROOT, 'public', 'data', 'auctions.json');
const ROUTER = 'https://routing.openstreetmap.de/routed-foot/table/v1/driving';
const CANDIDATES = 4;      // nearest stations by straight line, then compared by walk
const BATCH = 10;          // properties per routing request
const LINE_RADIUS = 120;   // a station serves a line whose track passes within this many metres
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round5 = (n) => Math.round(n * 1e5) / 1e5;

function metres(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

let stations = null;
function loadStations() {
  if (stations) return stations;
  const { subway, stations: raw } = JSON.parse(readFileSync(TRANSIT_PATH, 'utf8'));
  stations = raw.map((s) => ({
    ...s,
    lines: subway
      .filter((l) => l.coords.some((seg) => seg.some(([lon, lat]) => metres(s.lat, s.lon, lat, lon) < LINE_RADIUS)))
      .map((l) => l.ref),
  }));
  return stations;
}

function candidates(lat, lon) {
  return loadStations()
    .map((s) => ({ s, straight: metres(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.straight - b.straight)
    .slice(0, CANDIDATES);
}

/** Walking distance and time from each origin to each destination. */
async function walkTable(origins, destinations) {
  const coords = [...origins, ...destinations].map(([lat, lon]) => `${lon},${lat}`).join(';');
  const sources = origins.map((_, i) => i).join(';');
  const dests = destinations.map((_, i) => origins.length + i).join(';');
  const res = await fetch(`${ROUTER}/${coords}?sources=${sources}&destinations=${dests}&annotations=distance,duration`, {
    headers: { 'User-Agent': 'aoxiong-website/1.0 (nearest-station)' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.code !== 'Ok') throw new Error(j.code);
  return { distances: j.distances, durations: j.durations };
}

/** Nearest station for several positions, in one routing request. */
async function nearestStations(points) {
  const cands = points.map(([lat, lon]) => candidates(lat, lon));
  const dests = [...new Set(cands.flat().map((c) => c.s))];
  let table = null;
  try {
    table = await walkTable(points, dests.map((s) => [s.lat, s.lon]));
  } catch (e) {
    console.log(`  [nearest-station] route failed (${e.message}), using straight lines`);
  }
  return points.map(([lat, lon], i) => {
    const at = [round5(lat), round5(lon)];
    if (table) {
      const best = cands[i]
        .map((c) => {
          const j = dests.indexOf(c.s);
          return { s: c.s, distance: table.distances[i][j], duration: table.durations[i][j] };
        })
        .filter((c) => c.distance != null)
        .sort((a, b) => a.distance - b.distance)[0];
      if (best) {
        return {
          name: best.s.name,
          lines: best.s.lines,
          meters: Math.round(best.distance / 10) * 10,
          minutes: Math.max(1, Math.round(best.duration / 60)),
          walk: true,
          at,
        };
      }
    }
    const { s, straight } = cands[i][0];
    return { name: s.name, lines: s.lines, meters: Math.round(straight / 10) * 10, walk: false, at };
  });
}

/** Nearest station for one position. */
export async function nearestStation(lat, lon) {
  return (await nearestStations([[lat, lon]]))[0];
}

/**
 * Fills `nearestStation` on records that lack it, moved, or only have a straight-line value.
 * Auctions already held are skipped: the dashboard no longer shows them.
 */
export async function addNearestStations(records, { onProgress } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const todo = records.filter((r) => {
    if (!r.latitude || !r.longitude) return false;
    if (r.auctionDate && r.auctionDate < today) return false;
    const ns = r.nearestStation;
    return !(ns?.walk && ns.at?.[0] === round5(r.latitude) && ns.at?.[1] === round5(r.longitude));
  });
  for (let i = 0; i < todo.length; i += BATCH) {
    if (i) await sleep(1500);
    const batch = todo.slice(i, i + BATCH);
    const found = await nearestStations(batch.map((r) => [r.latitude, r.longitude]));
    batch.forEach((r, k) => { r.nearestStation = found[k]; });
    onProgress?.(Math.min(i + BATCH, todo.length), todo.length);
  }
  console.log(`  [nearest-station] looked up ${todo.length} of ${records.length}`);
  return todo.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const records = JSON.parse(readFileSync(AUCTIONS_PATH, 'utf8'));
  const save = () => writeFileSync(AUCTIONS_PATH, JSON.stringify(records, null, 2), 'utf8');
  await addNearestStations(records, {
    onProgress: (n, total) => { console.log(`${n}/${total}`); save(); },
  });
  save();
  const s = loadStations();
  console.log('stations without a line:', s.filter((x) => !x.lines.length).map((x) => x.name).join(', ') || 'none');
}
