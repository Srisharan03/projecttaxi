import type { LatLng, VehicleType } from "@/lib/firestore";

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

export function getGoogleMapsDirectionsUrl(origin: LatLng, destination: LatLng): string {
  const originParam = `${origin.lat},${origin.lng}`;
  const destinationParam = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destinationParam}&travelmode=driving`;
}
