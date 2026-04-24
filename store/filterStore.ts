import { create } from "zustand";

interface FilterStoreState {
  searchTerm: string;
  amenities: string[];
  maxHourlyRate: number;
  sortBy: "score" | "distance" | "price";
  includeClosed: boolean;
  setSearchTerm: (searchTerm: string) => void;
  setAmenities: (amenities: string[]) => void;
  setMaxHourlyRate: (maxHourlyRate: number) => void;
  setSortBy: (sortBy: "score" | "distance" | "price") => void;
  setIncludeClosed: (includeClosed: boolean) => void;
  resetFilters: () => void;
}

const defaultState = {
  searchTerm: "",
  amenities: [],
  maxHourlyRate: 200,
  sortBy: "score" as const,
  includeClosed: true,
};

export const useFilterStore = create<FilterStoreState>((set) => ({
  ...defaultState,
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setAmenities: (amenities) => set({ amenities }),
  setMaxHourlyRate: (maxHourlyRate) => set({ maxHourlyRate }),
  setSortBy: (sortBy) => set({ sortBy }),
  setIncludeClosed: (includeClosed) => set({ includeClosed }),
  resetFilters: () => set(defaultState),
}));
