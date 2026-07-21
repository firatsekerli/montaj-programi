/**
 * Ankara's 25 districts with approximate CENTER coordinates.
 *
 * A site is located by picking its district; the app derives lat/lon from the
 * district center and does travel-time math from there. Center precision of a
 * few km is plenty at city scale for capacity planning. (If the app later
 * serves other provinces, add their districts here or move this to a table.)
 */
export interface District {
  name: string;
  lat: number;
  lon: number;
}

export const ANKARA_DISTRICTS: District[] = [
  { name: "Akyurt", lat: 40.135, lon: 33.083 },
  { name: "Altındağ", lat: 39.967, lon: 32.878 },
  { name: "Ayaş", lat: 40.017, lon: 32.336 },
  { name: "Bala", lat: 39.554, lon: 33.122 },
  { name: "Beypazarı", lat: 40.167, lon: 31.921 },
  { name: "Çamlıdere", lat: 40.489, lon: 32.472 },
  { name: "Çankaya", lat: 39.877, lon: 32.855 },
  { name: "Çubuk", lat: 40.238, lon: 33.032 },
  { name: "Elmadağ", lat: 39.921, lon: 33.231 },
  { name: "Etimesgut", lat: 39.947, lon: 32.660 },
  { name: "Evren", lat: 39.026, lon: 33.807 },
  { name: "Gölbaşı", lat: 39.789, lon: 32.809 },
  { name: "Güdül", lat: 40.213, lon: 32.245 },
  { name: "Haymana", lat: 39.432, lon: 32.497 },
  { name: "Kahramankazan", lat: 40.230, lon: 32.687 },
  { name: "Kalecik", lat: 40.096, lon: 33.408 },
  { name: "Keçiören", lat: 40.015, lon: 32.869 },
  { name: "Kızılcahamam", lat: 40.469, lon: 32.650 },
  { name: "Mamak", lat: 39.933, lon: 32.918 },
  { name: "Nallıhan", lat: 40.186, lon: 31.349 },
  { name: "Polatlı", lat: 39.584, lon: 32.147 },
  { name: "Pursaklar", lat: 40.038, lon: 32.900 },
  { name: "Sincan", lat: 39.966, lon: 32.577 },
  { name: "Şereflikoçhisar", lat: 38.938, lon: 33.545 },
  { name: "Yenimahalle", lat: 39.973, lon: 32.795 },
];

const BY_NAME = new Map(ANKARA_DISTRICTS.map((d) => [d.name, d]));

/** Center coordinates of a district by name, or null if unknown. */
export function districtCenter(name: string): District | null {
  return BY_NAME.get(name) ?? null;
}
