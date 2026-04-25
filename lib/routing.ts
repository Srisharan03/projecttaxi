import type { LatLng, VehicleType } from "@/lib/firestore";
import { haversine } from "@/lib/optimization";

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface RouteResponse {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

export interface SpotRouteMetric {
  spotId: string;
  etaMinutes: number;
  routeDistanceKm: number;
  trafficFactor: number;
  roadSuitability: number;
  routeLabel: string;
  routePath: LatLng[];
  source: "directions_api" | "fallback_estimate";
}

interface RouteMetricInput {
  id: string;
  location: LatLng;
}

function getProfile(vehicleType: VehicleType): "cycling-regular" | "driving-car" {
  if (vehicleType === "bike") {
    return "cycling-regular";
  }

  return "driving-car";
}

export async function getRoute(
  origin: LatLng,
  destination: LatLng,
  vehicleType: VehicleType,
): Promise<RouteResponse> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouteService key missing. Set NEXT_PUBLIC_OPENROUTESERVICE_API_KEY.");
  }

  const profile = getProfile(vehicleType);

  const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to fetch route from OpenRouteService.");
  }

  const data = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[][] };
      properties?: {
        summary?: { distance?: number; duration?: number };
        segments?: Array<{ steps?: Array<{ instruction: string; distance: number; duration: number }> }>;
      };
    }>;
  };

  const feature = data.features?.[0];
  if (!feature?.geometry?.coordinates || !feature.properties?.summary) {
    throw new Error("Invalid route response payload.");
  }

  return {
    coordinates: feature.geometry.coordinates.map((pair) => ({ lat: pair[1], lng: pair[0] })),
    distanceMeters: feature.properties.summary.distance ?? 0,
    durationSeconds: feature.properties.summary.duration ?? 0,
    steps: feature.properties.segments?.[0]?.steps ?? [],
  };
}

export function getGoogleMapsDirectionsUrl(
  origin: LatLng,
  destination: LatLng,
  vehicleType: VehicleType = "car",
): string {
  const originParam = `${origin.lat},${origin.lng}`;
  const destinationParam = `${destination.lat},${destination.lng}`;
  const travelMode = vehicleType === "bike" ? "bicycling" : "driving";
  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destinationParam}&travelmode=${travelMode}`;
}

function getTravelMode(vehicleType: VehicleType): google.maps.TravelMode {
  return vehicleType === "bike" ? google.maps.TravelMode.BICYCLING : google.maps.TravelMode.DRIVING;
}

function getRouteLabel(vehicleType: VehicleType): string {
  if (vehicleType === "bike") {
    return "Bike-optimized shortcut route";
  }

  if (vehicleType === "suv") {
    return "SUV-friendly main road route";
  }

  return "Car-friendly standard route";
}

function getFallbackMetric(
  origin: LatLng,
  input: RouteMetricInput,
  vehicleType: VehicleType,
): SpotRouteMetric {
  const routeDistanceKm = haversine(origin, input.location);
  const speedKmh = vehicleType === "bike" ? 22 : vehicleType === "suv" ? 26 : 30;
  const etaMinutes = Math.max(2, (routeDistanceKm / speedKmh) * 60);

  return {
    spotId: input.id,
    etaMinutes,
    routeDistanceKm,
    trafficFactor: 1,
    roadSuitability: vehicleType === "bike" ? 0.95 : 0.9,
    routeLabel: getRouteLabel(vehicleType),
    routePath: [origin, input.location],
    source: "fallback_estimate",
  };
}

async function fetchSingleRouteMetric(
  service: google.maps.DirectionsService,
  origin: LatLng,
  input: RouteMetricInput,
  vehicleType: VehicleType,
): Promise<SpotRouteMetric> {
  const request: google.maps.DirectionsRequest = {
    origin,
    destination: input.location,
    travelMode: getTravelMode(vehicleType),
    provideRouteAlternatives: false,
    avoidFerries: true,
  };

  if (vehicleType !== "bike") {
    request.drivingOptions = {
      departureTime: new Date(),
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    };
  }

  const response = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
    service.route(request, (result, status) => {
      if (status !== google.maps.DirectionsStatus.OK || !result) {
        reject(new Error("Directions request failed."));
        return;
      }

      resolve(result);
    });
  });
  const route = response.routes?.[0];
  const leg = route?.legs?.[0];
  if (!route || !leg) {
    throw new Error("Route data unavailable.");
  }

  const durationBase = leg.duration?.value ?? 0;
  const durationWithTraffic = leg.duration_in_traffic?.value ?? durationBase;
  const durationSeconds = durationWithTraffic > 0 ? durationWithTraffic : durationBase;
  const distanceMeters = leg.distance?.value ?? 0;

  const trafficFactor = durationBase > 0 ? durationSeconds / durationBase : 1;
  const roadSuitability =
    vehicleType === "bike"
      ? 1
      : vehicleType === "suv"
        ? trafficFactor > 1.45
          ? 0.82
          : 0.92
        : trafficFactor > 1.45
          ? 0.85
          : 0.95;

  return {
    spotId: input.id,
    etaMinutes: Math.max(1, durationSeconds / 60),
    routeDistanceKm: Math.max(0.1, distanceMeters / 1000),
    trafficFactor: Math.max(1, trafficFactor),
    roadSuitability,
    routeLabel: getRouteLabel(vehicleType),
    routePath: route.overview_path.map((point) => ({ lat: point.lat(), lng: point.lng() })),
    source: "directions_api",
  };
}

export async function getRouteMetricsForSpots(
  origin: LatLng,
  inputs: RouteMetricInput[],
  vehicleType: VehicleType,
  concurrency = 5,
): Promise<Record<string, SpotRouteMetric>> {
  if (!inputs.length) {
    return {};
  }

  if (typeof window === "undefined" || !window.google?.maps?.DirectionsService) {
    return Object.fromEntries(
      inputs.map((input) => [input.id, getFallbackMetric(origin, input, vehicleType)]),
    );
  }

  const service = new window.google.maps.DirectionsService();
  const results: Record<string, SpotRouteMetric> = {};
  const safeConcurrency = Math.max(1, Math.min(concurrency, 8));
  let index = 0;

  const workers = Array.from({ length: Math.min(safeConcurrency, inputs.length) }, async () => {
    while (index < inputs.length) {
      const currentIndex = index;
      index += 1;
      const input = inputs[currentIndex];

      try {
        const metric = await fetchSingleRouteMetric(service, origin, input, vehicleType);
        results[input.id] = metric;
      } catch {
        results[input.id] = getFallbackMetric(origin, input, vehicleType);
      }
    }
  });

  await Promise.all(workers);
  return results;
}
