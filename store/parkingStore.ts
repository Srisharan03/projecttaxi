import { create } from "zustand";
import { rankSpots, type RankedSpot } from "@/lib/optimization";
import {
  subscribeToSpots,
  type LatLng,
  type ParkingSpot,
  type VehicleType,
} from "@/lib/firestore";
import { PUBLIC_PARKING_SPOTS } from "@/lib/publicSpots";

const HYDERABAD_CENTER: LatLng = {
  lat: 17.385,
  lng: 78.4867,
};

export type ParkingSpotWithId = ParkingSpot & { id: string };

interface RankedSpotFilters {
  search?: string;
  amenities?: string[];
  maxHourlyRate?: number;
  includeClosed?: boolean;
  sortBy?: "score" | "distance" | "price";
}

interface ParkingStoreState {
  spots: ParkingSpotWithId[];
  selectedSpotId: string | null;
  userLocation: LatLng;
  vehicleType: VehicleType;
  isLoading: boolean;
  error: string | null;
  unsubscribeSpots: (() => void) | null;
  startSpotsSubscription: () => void;
  stopSpotsSubscription: () => void;
  setSelectedSpotId: (spotId: string | null) => void;
  setUserLocation: (location: LatLng) => void;
  setVehicleType: (vehicleType: VehicleType) => void;
  getRankedSpots: (filters?: RankedSpotFilters) => RankedSpot[];
}

export const useParkingStore = create<ParkingStoreState>((set, get) => ({
  spots: [],
  selectedSpotId: null,
  userLocation: HYDERABAD_CENTER,
  vehicleType: "car",
  isLoading: false,
  error: null,
  unsubscribeSpots: null,

  startSpotsSubscription: () => {
    const existingUnsubscribe = get().unsubscribeSpots;
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    set({ isLoading: true, error: null });

    const unsubscribe = subscribeToSpots(
      (spots) => {
        const merged = [...PUBLIC_PARKING_SPOTS, ...spots];
        const uniqueById = Array.from(
          new Map(merged.map((spot) => [spot.id, spot])).values(),
        );

        set({
          spots: uniqueById as ParkingSpotWithId[],
          isLoading: false,
          error: null,
        });
      },
      (error) => {
        set({
          error: error.message || "Failed to subscribe to parking spots.",
          isLoading: false,
        });
      },
    );

    set({ unsubscribeSpots: unsubscribe });
  },

  stopSpotsSubscription: () => {
    const unsubscribe = get().unsubscribeSpots;
    if (unsubscribe) {
      unsubscribe();
    }

    set({ unsubscribeSpots: null });
  },

  setSelectedSpotId: (selectedSpotId) => set({ selectedSpotId }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setVehicleType: (vehicleType) => set({ vehicleType }),

  getRankedSpots: (filters) => {
    const state = get();
    const ranked = rankSpots(state.spots, state.userLocation, state.vehicleType);

    const searched = ranked.filter((spot) => {
      const search = (filters?.search || "").trim().toLowerCase();
      if (!search) {
        return true;
      }

      return (
        spot.name.toLowerCase().includes(search) ||
        spot.address.toLowerCase().includes(search)
      );
    });

    const amenityFiltered = searched.filter((spot) => {
      if (!filters?.amenities?.length) {
        return true;
      }

      return filters.amenities.every((amenity) => spot.amenities.includes(amenity));
    });

    const priced = amenityFiltered.filter((spot) => {
      if (!filters?.maxHourlyRate) {
        return true;
      }

      return spot.pricing.hourly_rate <= filters.maxHourlyRate;
    });

    const openStateFiltered = priced.filter((spot) => {
      if (filters?.includeClosed) {
        return true;
      }

      return spot.status === "open";
    });

    if (filters?.sortBy === "distance") {
      return [...openStateFiltered].sort((a, b) => a.distanceKm - b.distanceKm);
    }

    if (filters?.sortBy === "price") {
      return [...openStateFiltered].sort((a, b) => a.pricing.hourly_rate - b.pricing.hourly_rate);
    }

    return openStateFiltered;
  },
}));
