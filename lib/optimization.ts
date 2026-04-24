import type { ParkingSpot, VehicleType, LatLng } from "@/lib/firestore";

const DISTANCE_WEIGHT = 0.4;
const PRICE_WEIGHT = 0.3;
const TRUST_WEIGHT = 0.3;

export interface RankedSpot extends ParkingSpot {
  id: string;
  score: number;
  distanceKm: number;
  availabilityRatio: number;
}

export function haversine(pointA: LatLng, pointB: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);

  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalize(value: number, min: number, max: number): number {
  if (max - min === 0) {
    return 1;
  }

  return (value - min) / (max - min);
}

export function rankSpots(
  spots: Array<ParkingSpot & { id: string }>,
  userLocation: LatLng,
  vehicleType: VehicleType,
): RankedSpot[] {
  const filtered = spots.filter((spot) => {
    return (
      spot.is_approved &&
      spot.vehicle_types.includes(vehicleType)
    );
  });

  if (filtered.length === 0) {
    return [];
  }

  const distances = filtered.map((spot) => haversine(userLocation, spot.location));
  const prices = filtered.map((spot) => spot.pricing.hourly_rate);

  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return filtered
    .map((spot, index) => {
      const rawDistance = distances[index];
      const rawPrice = prices[index];

      const distanceScore = 1 - normalize(rawDistance, minDist, maxDist);
      const priceScore = 1 - normalize(rawPrice, minPrice, maxPrice);
      const trustScore = Math.max(0, Math.min(spot.trust_score, 100)) / 100;

      const score =
        DISTANCE_WEIGHT * distanceScore +
        PRICE_WEIGHT * priceScore +
        TRUST_WEIGHT * trustScore;

      return {
        ...spot,
        score: Number(score.toFixed(4)),
        distanceKm: rawDistance,
        availabilityRatio: Math.max(spot.total_spots - spot.current_occupancy, 0) / spot.total_spots,
      };
    })
    .sort((a, b) => b.score - a.score);
}
