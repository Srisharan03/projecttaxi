import type { LatLng, ParkingSpot } from "@/lib/firestore";

export type PublicGoogleSpot = ParkingSpot & { id: string };

export interface GeocodedDestination {
  location: LatLng;
  formattedAddress: string;
}

const DEFAULT_SCHEDULE: ParkingSpot["availability_schedule"] = {
  monday: { open: "00:00", close: "23:59" },
  tuesday: { open: "00:00", close: "23:59" },
  wednesday: { open: "00:00", close: "23:59" },
  thursday: { open: "00:00", close: "23:59" },
  friday: { open: "00:00", close: "23:59" },
  saturday: { open: "00:00", close: "23:59" },
  sunday: { open: "00:00", close: "23:59" },
};

function ensureGooglePlaces(): void {
  if (typeof window === "undefined" || !window.google?.maps?.places) {
    throw new Error("Google Maps Places API is not loaded.");
  }
}

function toPublicSpot(place: google.maps.places.PlaceResult): PublicGoogleSpot | null {
  const placeId = place.place_id;
  const location = place.geometry?.location;

  if (!placeId || !location || !place.name) {
    return null;
  }

  const rating = place.rating ?? 0;
  const trustScore = Math.max(50, Math.min(98, Math.round(rating * 20)));

  return {
    id: `google-${placeId}`,
    name: place.name,
    address: place.vicinity ?? place.formatted_address ?? "Address unavailable",
    location: {
      lat: location.lat(),
      lng: location.lng(),
    },
    vendor_id: "google-public",
    type: "municipal",
    vehicle_types: ["bike", "car", "suv"],
    pricing: {
      flat_rate: 0,
      hourly_rate: 0,
    },
    total_spots: 100,
    current_occupancy: 0,
    status: "open",
    is_approved: true,
    trust_score: trustScore,
    rating,
    review_count: place.user_ratings_total ?? 0,
    amenities: ["Public", "Google Places"],
    images: [],
    availability_schedule: DEFAULT_SCHEDULE,
    conflict_flag: false,
  };
}

export async function geocodeDestination(query: string): Promise<GeocodedDestination> {
  ensureGooglePlaces();

  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter a destination to search.");
  }

  const geocoder = new window.google.maps.Geocoder();

  const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
    geocoder.geocode({ address: trimmed }, (geocodeResults, status) => {
      if (status !== google.maps.GeocoderStatus.OK || !geocodeResults?.length) {
        reject(new Error("Destination not found. Try a more specific place."));
        return;
      }

      resolve(geocodeResults);
    });
  });

  const top = results[0];
  return {
    location: {
      lat: top.geometry.location.lat(),
      lng: top.geometry.location.lng(),
    },
    formattedAddress: top.formatted_address,
  };
}

export async function fetchNearbyPublicParkingSpots(
  destination: LatLng,
  radiusMeters = 3000,
  maxPages = 3,
): Promise<PublicGoogleSpot[]> {
  ensureGooglePlaces();

  const service = new window.google.maps.places.PlacesService(document.createElement("div"));
  const center = new window.google.maps.LatLng(destination.lat, destination.lng);

  const allResults: google.maps.places.PlaceResult[] = [];

  await new Promise<void>((resolve, reject) => {
    let pagesFetched = 0;

    const runSearch = (paginationFn?: () => void) => {
      const handlePage = (
        results: google.maps.places.PlaceResult[] | null,
        status: google.maps.places.PlacesServiceStatus,
        pagination: google.maps.places.PlaceSearchPagination | null,
      ) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK &&
          status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS
        ) {
          reject(new Error("Unable to fetch nearby parking spots from Google Places."));
          return;
        }

        if (results?.length) {
          allResults.push(...results);
        }

        pagesFetched += 1;

        if (pagination?.hasNextPage && pagesFetched < maxPages) {
          setTimeout(() => {
            pagination.nextPage();
          }, 2000);
          return;
        }

        resolve();
      };

      if (paginationFn) {
        paginationFn();
        return;
      }

      service.nearbySearch(
        {
          location: center,
          radius: radiusMeters,
          keyword: "public parking",
          type: "parking",
        },
        handlePage,
      );
    };

    runSearch();
  });

  const normalized = allResults
    .map(toPublicSpot)
    .filter((spot): spot is PublicGoogleSpot => Boolean(spot));

  const deduped = Array.from(new Map(normalized.map((spot) => [spot.id, spot])).values());
  return deduped;
}
