// Geocodes an auction address via Nominatim. Shared by fetch-auctions.mjs and
// fix-auction-coords.mjs.
//
// Vienna repeats street names across districts (Nestroygasse exists in both
// 1020 and 1140), so a hit only counts if its postcode matches the address.

const DISTRICT_COORDS = {
  '1010': [48.2082, 16.3738], '1020': [48.2192, 16.3917],
  '1030': [48.1985, 16.3924], '1040': [48.1940, 16.3714],
  '1050': [48.1930, 16.3580], '1060': [48.1980, 16.3512],
  '1070': [48.2022, 16.3528], '1080': [48.2110, 16.3490],
  '1090': [48.2221, 16.3603], '1100': [48.1740, 16.3858],
  '1110': [48.1756, 16.4208], '1120': [48.1835, 16.3285],
  '1130': [48.1875, 16.3052], '1140': [48.1983, 16.2940],
  '1150': [48.1984, 16.3295], '1160': [48.2120, 16.3201],
  '1170': [48.2245, 16.3120], '1180': [48.2298, 16.3412],
  '1190': [48.2524, 16.3548], '1200': [48.2330, 16.3790],
  '1210': [48.2630, 16.3951], '1220': [48.2251, 16.4408],
  '1230': [48.1505, 16.3189],
};

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const MIN_REQUEST_GAP_MS = 1100; // Nominatim's usage policy allows 1 request/second

let lastRequestAt = 0;

async function nominatim(params) {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const query = new URLSearchParams({ ...params, format: 'json', limit: '5', addressdetails: '1' });
  const res = await fetch(`${NOMINATIM}?${query}`, {
    headers: { 'User-Agent': 'aoxiong-website/1.0 (auction-geocoder)', 'Accept-Language': 'de' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return res.json();
}

function pickInDistrict(hits, plz) {
  return hits.find((h) => h.address?.postcode === plz && h.class !== 'boundary' && h.type !== 'postcode');
}

async function lookup(street, plz) {
  const structured = await nominatim({ street, postalcode: plz, city: 'Wien', country: 'Austria' });
  return (
    pickInDistrict(structured, plz) ||
    pickInDistrict(await nominatim({ q: `${street}, ${plz} Wien`, countrycodes: 'at' }), plz)
  );
}

// Queries from most to least precise. "A 5-7 / B 25" or "A 5 ident B 25" yields each street as
// written, then with the first house number of a range, then without a number.
function candidates(streetAddress) {
  const parts = streetAddress
    .split(/\s*[\/,]\s*|\s+ident\s+/i)
    .map((p) => p.trim())
    .filter((p) => /\p{L}{2}/u.test(p)); // "Hauptstraße 10/2/5" splits off bare door numbers

  const exact = parts.flatMap((p) => [p, p.replace(/(\d+)\s*[-–]\s*\d+.*$/, '$1')]);
  const streetOnly = parts.map((p) => p.replace(/\s+\d.*$/, ''));
  return [...new Set([...exact, ...streetOnly])];
}

export async function geocodeAddress(streetAddress, plz) {
  try {
    for (const street of candidates(streetAddress)) {
      const hit = await lookup(street, plz);
      if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), geocodeSource: 'official' };
    }
  } catch (err) {
    console.warn(`  geocode failed for "${streetAddress}": ${err.message}`);
  }
  const coords = DISTRICT_COORDS[plz] || [48.2082, 16.3738];
  return { lat: coords[0], lng: coords[1], geocodeSource: 'approximate' };
}
