/**
 * Geo helpers for travel time. Straight-line (great-circle) distances; a
 * road-network provider can replace `haversineKm` later behind the same shape.
 */
export interface Coord {
  lat: number;
  lon: number;
}

const EARTH_KM = 6371;

export function haversineKm(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Length (km) of a nearest-neighbor tour base → all sites → base. Used to model
 * a team's whole-day driving when it visits several sites, instead of charging
 * a separate round-trip per site.
 */
export function nearestNeighborTourKm(base: Coord | undefined, sites: Coord[]): number {
  if (!base || sites.length === 0) return 0;
  const remaining = sites.slice();
  let current = base;
  let total = 0;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    total += bestDist;
    current = remaining[bestIdx]!;
    remaining.splice(bestIdx, 1);
  }
  total += haversineKm(current, base); // return leg
  return total;
}

export function kmToMinutes(km: number, avgKmh: number): number {
  return avgKmh > 0 ? (km / avgKmh) * 60 : 0;
}
