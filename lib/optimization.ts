import type { ParkingSpot, VehicleType, LatLng } from "@/lib/firestore";
import type { SpotRouteMetric } from "@/lib/routing";

const ROUTE_EFFICIENCY_WEIGHT = 0.5;
const DESTINATION_DISTANCE_WEIGHT = 0.2;
const PRICE_WEIGHT = 0.15;
const TRUST_WEIGHT = 0.15;

export interface RankedSpot extends ParkingSpot {
  id: string;
  score: number;
  distanceKm: number;
  currentDistanceKm: number;
  destinationDistanceKm: number;
  routeEtaMinutes: number;
  routeDistanceKm: number;
  routeTrafficFactor: number;
  roadSuitability: number;
  routeEfficiencyScore: number;
  routeLabel: string;
  routePath: LatLng[];
  routeSource: "directions_api" | "fallback_estimate";
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
  currentLocation: LatLng,
  destinationLocation: LatLng,
  vehicleType: VehicleType,
  routeMetrics?: Record<string, SpotRouteMetric>,
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

  const destinationDistances = filtered.map((spot) => haversine(destinationLocation, spot.location));
  const currentDistances = filtered.map((spot) => haversine(currentLocation, spot.location));
  const prices = filtered.map((spot) => spot.pricing.hourly_rate);
  const routeCosts = filtered.map((spot, index) => {
    const metric = routeMetrics?.[spot.id];
    const fallbackDistance = currentDistances[index];
    const fallbackEta =
      (fallbackDistance / (vehicleType === "bike" ? 22 : vehicleType === "suv" ? 26 : 30)) * 60;
    const etaMinutes = metric?.etaMinutes ?? fallbackEta;
    const routeDistanceKm = metric?.routeDistanceKm ?? fallbackDistance;
    const trafficFactor = metric?.trafficFactor ?? 1;
    const roadSuitability = metric?.roadSuitability ?? (vehicleType === "bike" ? 0.95 : 0.9);
    const effectiveSuitability = Math.max(0.4, roadSuitability);
    return ((etaMinutes * 0.7) + (routeDistanceKm * 6) + (trafficFactor * 5)) / effectiveSuitability;
  });

  const minDestinationDist = Math.min(...destinationDistances);
  const maxDestinationDist = Math.max(...destinationDistances);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minRouteCost = Math.min(...routeCosts);
  const maxRouteCost = Math.max(...routeCosts);

  return filtered
    .map((spot, index) => {
      const rawDestinationDistance = destinationDistances[index];
      const rawCurrentDistance = currentDistances[index];
      const rawPrice = prices[index];
      const rawRouteCost = routeCosts[index];
      const metric = routeMetrics?.[spot.id];

      const destinationDistanceScore =
        1 - normalize(rawDestinationDistance, minDestinationDist, maxDestinationDist);
      const priceScore = 1 - normalize(rawPrice, minPrice, maxPrice);
      const trustScore = Math.max(0, Math.min(spot.trust_score, 100)) / 100;
      const routeEfficiencyScore = 1 - normalize(rawRouteCost, minRouteCost, maxRouteCost);
      const fallbackEta =
        (rawCurrentDistance / (vehicleType === "bike" ? 22 : vehicleType === "suv" ? 26 : 30)) * 60;
      const routeEtaMinutes = metric?.etaMinutes ?? Math.max(2, fallbackEta);
      const routeDistanceKm = metric?.routeDistanceKm ?? rawCurrentDistance;
      const routeTrafficFactor = metric?.trafficFactor ?? 1;
      const roadSuitability = metric?.roadSuitability ?? (vehicleType === "bike" ? 0.95 : 0.9);
      const routeLabel =
        metric?.routeLabel ??
        (vehicleType === "bike" ? "Bike-optimized shortcut route" : "Vehicle standard route");
      const routePath = metric?.routePath ?? [currentLocation, spot.location];
      const routeSource = metric?.source ?? "fallback_estimate";

      const score =
        ROUTE_EFFICIENCY_WEIGHT * routeEfficiencyScore +
        DESTINATION_DISTANCE_WEIGHT * destinationDistanceScore +
        PRICE_WEIGHT * priceScore +
        TRUST_WEIGHT * trustScore;

      return {
        ...spot,
        score: Number(score.toFixed(4)),
        distanceKm: rawCurrentDistance,
        currentDistanceKm: rawCurrentDistance,
        destinationDistanceKm: rawDestinationDistance,
        routeEtaMinutes: Number(routeEtaMinutes.toFixed(1)),
        routeDistanceKm: Number(routeDistanceKm.toFixed(2)),
        routeTrafficFactor: Number(routeTrafficFactor.toFixed(2)),
        roadSuitability: Number(roadSuitability.toFixed(2)),
        routeEfficiencyScore: Number(routeEfficiencyScore.toFixed(4)),
        routeLabel,
        routePath,
        routeSource,
        availabilityRatio: Math.max(spot.total_spots - spot.current_occupancy, 0) / spot.total_spots,
      };
    })
    .sort((a, b) => b.score - a.score);
}
