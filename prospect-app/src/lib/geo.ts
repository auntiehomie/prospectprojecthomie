export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_MILES = 3958.7613;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(a: Coordinates, b: Coordinates): number {
  const lat = radians(b.latitude - a.latitude);
  const lng = radians(b.longitude - a.longitude);
  const sinLat = Math.sin(lat / 2);
  const sinLng = Math.sin(lng / 2);
  const h = sinLat * sinLat
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isMichiganZip(zip: string): boolean {
  return /^48\d{3}$/.test(zip.trim());
}
