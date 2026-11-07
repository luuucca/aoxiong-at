/**
 * fix-auction-coords.mjs
 * Re-geocodes every auction in public/data/auctions.json with the
 * postcode-checked geocoder and reports what moved.
 *
 * Run: node scripts/fix-auction-coords.mjs
 */
import fs from 'node:fs';
import { geocodeAddress } from './geocode-auction.mjs';

const FILE = 'public/data/auctions.json';

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const x = toRad(bLng - aLng) * Math.cos(toRad((aLat + bLat) / 2));
  const y = toRad(bLat - aLat);
  return Math.hypot(x, y) * 6371;
}

const list = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const addresses = [...new Set(list.map((a) => a.address))];
console.log(`${list.length} auctions, ${addresses.length} unique addresses`);

const results = new Map();
for (const [i, address] of addresses.entries()) {
  const plz = address.match(/\b1[0-2]\d0\b/)?.[0] || '';
  const street = address.replace(/^\d{4}\s+Wien\s+/i, '');
  results.set(address, await geocodeAddress(street, plz));
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${addresses.length}`);
}

const moved = new Map();
for (const a of list) {
  const geo = results.get(a.address);
  // Keep a known position over a district centre if this lookup found nothing.
  if (geo.geocodeSource === 'approximate' && a.geocodeSource === 'official') {
    moved.set(a.address, { km: 0, from: a.geocodeSource, to: 'NOT FOUND, kept old', lat: a.latitude, lng: a.longitude });
    continue;
  }
  const km = distanceKm(a.latitude, a.longitude, geo.lat, geo.lng);
  if (km > 0.05 || a.geocodeSource !== geo.geocodeSource) {
    moved.set(a.address, { km, from: a.geocodeSource, to: geo.geocodeSource, lat: geo.lat, lng: geo.lng });
  }
  a.latitude = geo.lat;
  a.longitude = geo.lng;
  a.geocodeSource = geo.geocodeSource;
}

fs.writeFileSync(FILE, JSON.stringify(list, null, 2));

const sorted = [...moved].sort((a, b) => b[1].km - a[1].km);
console.log(`\n${sorted.length} addresses changed:`);
for (const [address, m] of sorted) {
  console.log(`${m.km.toFixed(2).padStart(6)} km  ${m.from} -> ${m.to}  ${m.lat.toFixed(5)},${m.lng.toFixed(5)}  ${address}`);
}
const stillApprox = list.filter((a) => a.geocodeSource === 'approximate').length;
console.log(`\nStill approximate: ${stillApprox} of ${list.length} auctions`);
