import type { TravelItinerary } from '../types';

/**
 * Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface DistanceCluster {
  centerLat: number;
  centerLng: number;
  itemIds: Set<number>;
}

/**
 * Extract all coordinate points from an itinerary item.
 * For transport items, includes both origin and destination.
 */
function getItemCoords(item: TravelItinerary): Array<{ lat: number; lng: number }> {
  const coords: Array<{ lat: number; lng: number }> = [];

  if (item.latitude && item.longitude) {
    coords.push({ lat: item.latitude, lng: item.longitude });
  }

  if (item.category === 'transport' && item.from_latitude && item.from_longitude) {
    coords.push({ lat: item.from_latitude, lng: item.from_longitude });
  }

  return coords;
}

/**
 * Greedy distance-based clustering of itinerary items.
 * Each coordinate point is assigned to the nearest existing cluster
 * (if within thresholdKm), or a new cluster is created.
 *
 * Transport items that span cities get assigned to BOTH clusters.
 */
export function clusterItemsByDistance(
  items: TravelItinerary[],
  thresholdKm = 50,
): DistanceCluster[] {
  const clusters: DistanceCluster[] = [];

  for (const item of items) {
    const coords = getItemCoords(item);
    if (coords.length === 0) continue;

    for (const coord of coords) {
      // Find nearest cluster
      let nearest: DistanceCluster | null = null;
      let nearestDist = Infinity;

      for (const cluster of clusters) {
        const dist = haversineDistance(coord.lat, coord.lng, cluster.centerLat, cluster.centerLng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = cluster;
        }
      }

      if (nearest && nearestDist <= thresholdKm) {
        nearest.itemIds.add(item.id);
      } else {
        // Create new cluster centered on this coordinate
        clusters.push({
          centerLat: coord.lat,
          centerLng: coord.lng,
          itemIds: new Set([item.id]),
        });
      }
    }
  }

  return clusters;
}
