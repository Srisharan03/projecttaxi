import type { LatLng } from "@/lib/firestore";
import { haversine } from "@/lib/optimization";

export function validateLocation(
  userCoords: LatLng,
  spotCoords: LatLng,
  radiusMeters = 20,
): boolean {
  const distanceMeters = haversine(userCoords, spotCoords) * 1000;
  return distanceMeters <= radiusMeters;
}

export function getDistanceMeters(pointA: LatLng, pointB: LatLng): number {
  return haversine(pointA, pointB) * 1000;
}

export function getCurrentPosition(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  },
): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission denied. Enable GPS/location to continue."));
          return;
        }

        reject(new Error("Unable to fetch your live location."));
      },
      options,
    );
  });
}
