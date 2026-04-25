"use client";

import { createContext, useContext } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from "@/lib/googleMaps";

interface GoogleMapsLoaderContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsLoaderContext = createContext<GoogleMapsLoaderContextValue>({
  isLoaded: false,
  loadError: undefined,
});

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey,
    libraries: [...GOOGLE_MAPS_LIBRARIES],
  });

  return (
    <GoogleMapsLoaderContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsLoaderContext.Provider>
  );
}

export function useGoogleMapsLoader() {
  return useContext(GoogleMapsLoaderContext);
}
