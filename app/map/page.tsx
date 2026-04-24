"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { FilterPanel } from "@/components/map/FilterPanel";
import { SearchBar } from "@/components/map/SearchBar";
import { SpotList } from "@/components/map/SpotList";
import { getSpots } from "@/lib/firestore";
import { getCurrentPosition } from "@/lib/geofence";
import { fetchNearbyPublicParkingSpots, geocodeDestination } from "@/lib/googlePlaces";
import { haversine } from "@/lib/optimization";
import { getGoogleMapsDirectionsUrl } from "@/lib/routing";
import { useFilterStore } from "@/store/filterStore";
import { useParkingStore } from "@/store/parkingStore";
import "@/styles/map.css";

const DynamicParkingMap = dynamic(
  () => import("@/components/map/ParkingMap").then((mod) => mod.ParkingMap),
  {
    ssr: false,
    loading: () => <div className="map-shell glass-card" />,
  },
);

export default function MapPage() {
  const SEARCH_RADIUS_KM = 5;
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded: isGoogleLoaded, loadError } = useJsApiLoader({
    id: "parksaathi-google-maps",
    googleMapsApiKey,
    libraries: ["places"],
  });

  const selectedSpotId = useParkingStore((state) => state.selectedSpotId);
  const userLocation = useParkingStore((state) => state.userLocation);
  const destinationLocation = useParkingStore((state) => state.destinationLocation);
  const vehicleType = useParkingStore((state) => state.vehicleType);
  const replaceSpots = useParkingStore((state) => state.replaceSpots);
  const setSelectedSpotId = useParkingStore((state) => state.setSelectedSpotId);
  const setUserLocation = useParkingStore((state) => state.setUserLocation);
  const setDestinationLocation = useParkingStore((state) => state.setDestinationLocation);
  const setVehicleType = useParkingStore((state) => state.setVehicleType);
  const getRankedSpots = useParkingStore((state) => state.getRankedSpots);

  const searchTerm = useFilterStore((state) => state.searchTerm);
  const amenities = useFilterStore((state) => state.amenities);
  const maxHourlyRate = useFilterStore((state) => state.maxHourlyRate);
  const sortBy = useFilterStore((state) => state.sortBy);
  const includeClosed = useFilterStore((state) => state.includeClosed);
  const setSearchTerm = useFilterStore((state) => state.setSearchTerm);
  const setAmenities = useFilterStore((state) => state.setAmenities);
  const setMaxHourlyRate = useFilterStore((state) => state.setMaxHourlyRate);
  const setSortBy = useFilterStore((state) => state.setSortBy);
  const setIncludeClosed = useFilterStore((state) => state.setIncludeClosed);

  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [destinationStatus, setDestinationStatus] = useState<string>(
    "Enter a destination and load public parking nearby.",
  );
  const [fallbackMapsLink, setFallbackMapsLink] = useState<string>("");

  const rankedSpots = getRankedSpots({
    search: "",
    amenities,
    maxHourlyRate,
    includeClosed,
    sortBy,
  });

  const selectedSpot = useMemo(() => {
    return rankedSpots.find((spot) => spot.id === selectedSpotId) ?? null;
  }, [rankedSpots, selectedSpotId]);

  const totalCapacity = rankedSpots.reduce((acc, spot) => acc + spot.total_spots, 0);
  const totalOccupied = rankedSpots.reduce((acc, spot) => acc + spot.current_occupancy, 0);

  useEffect(() => {
    getCurrentPosition()
      .then((coords) => {
        setUserLocation(coords);
      })
      .catch(() => {
        // Keep fallback location when user does not grant GPS permission.
      });
  }, [setUserLocation]);

  const handleDestinationSearch = async () => {
    if (!isGoogleLoaded) {
      setDestinationStatus("Google Maps is still loading. Please try again in a moment.");
      return;
    }

    setIsSearchingDestination(true);
    setDestinationStatus("Searching destination and loading public parking...");
    setFallbackMapsLink("");

    try {
      const destination = await geocodeDestination(searchTerm);
      setDestinationLocation(destination.location);
      setSearchTerm(destination.formattedAddress);

      const [publicSpots, firestoreSpots] = await Promise.all([
        fetchNearbyPublicParkingSpots(destination.location),
        getSpots(),
      ]);

      const nearbyVendorSpots = firestoreSpots.filter((spot) => {
        if (!spot.is_approved) {
          return false;
        }

        if (spot.status !== "open") {
          return false;
        }

        return haversine(destination.location, spot.location) <= SEARCH_RADIUS_KM;
      });

      const mergedNearbySpots = Array.from(
        new Map(
          [...nearbyVendorSpots, ...publicSpots].map((spot) => [spot.id, spot]),
        ).values(),
      );

      replaceSpots(mergedNearbySpots);
      setSelectedSpotId(null);

      setDestinationStatus(
        mergedNearbySpots.length
          ? `Found ${mergedNearbySpots.length} nearby parking spots near ${destination.formattedAddress}.`
          : `No public parking spots found near ${destination.formattedAddress}. Try a wider destination query. Ranking prioritizes destination-near spots with shorter travel from your current location.`,
      );
    } catch (searchError) {
      setDestinationStatus(
        searchError instanceof Error
          ? searchError.message
          : "Destination search failed. Please try again.",
      );
    } finally {
      setIsSearchingDestination(false);
    }
  };

  const handleRouteSpot = (spot: (typeof rankedSpots)[number]) => {
    const link = getGoogleMapsDirectionsUrl(userLocation, spot.location);
    setFallbackMapsLink(link);

    if (typeof window !== "undefined") {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  if (!googleMapsApiKey) {
    return (
      <div className="map-page shell">
        <section className="section">
          <Card
            title="Google Maps API Key Missing"
            subtitle="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local to enable destination-based public parking search."
          />
        </section>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="map-page shell">
        <section className="section">
          <Card
            title="Google Maps Failed to Load"
            subtitle="Check your key restrictions and enabled APIs (Maps JavaScript API and Places API)."
          />
        </section>
      </div>
    );
  }

  return (
    <div className="map-page shell">
      <section className="section">
        <Card title="Destination Public Parking" subtitle="Google Maps + Places API, based on where you want to go.">
          <div className="hero-actions">
            <Badge tone="info">Vehicle profile</Badge>
            <Button
              variant={vehicleType === "bike" ? "primary" : "secondary"}
              onClick={() => setVehicleType("bike")}
            >
              Bike
            </Button>
            <Button
              variant={vehicleType === "car" ? "primary" : "secondary"}
              onClick={() => setVehicleType("car")}
            >
              Car
            </Button>
            <Button
              variant={vehicleType === "suv" ? "primary" : "secondary"}
              onClick={() => setVehicleType("suv")}
            >
              SUV
            </Button>
            <Badge tone="success">Visible Occupancy: {totalOccupied}/{totalCapacity || 0}</Badge>
          </div>

          <p className="card-subtitle" style={{ marginTop: "0.75rem" }}>
            {destinationStatus}
          </p>

          <p className="card-subtitle" style={{ marginTop: "0.5rem" }}>
            Ranking order: closest to destination, then shorter distance from your current location.
          </p>

          {fallbackMapsLink ? (
            <a href={fallbackMapsLink} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost">Open Google Maps fallback</Button>
            </a>
          ) : null}
        </Card>
      </section>

      <section className="map-grid">
        <aside className="form-grid">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onSearchDestination={handleDestinationSearch}
            isSearching={isSearchingDestination}
          />
          <FilterPanel
            amenities={amenities}
            maxHourlyRate={maxHourlyRate}
            sortBy={sortBy}
            includeClosed={includeClosed}
            onAmenitiesChange={setAmenities}
            onMaxHourlyRateChange={setMaxHourlyRate}
            onSortByChange={setSortBy}
            onIncludeClosedChange={setIncludeClosed}
          />
          <SpotList
            spots={rankedSpots}
            selectedSpotId={selectedSpotId}
            onSelectSpot={(spot) => setSelectedSpotId(spot.id)}
            onBookSpot={handleRouteSpot}
            onRouteSpot={handleRouteSpot}
            onReportSpot={() => {
              // Vendor audit is intentionally skipped for public Google Places spots.
            }}
          />
        </aside>

        <div>
          {isGoogleLoaded ? (
            <DynamicParkingMap
              spots={rankedSpots}
              destination={destinationLocation}
              selectedSpotId={selectedSpot?.id ?? null}
              onSelectSpot={setSelectedSpotId}
            />
          ) : (
            <div className="map-shell glass-card" />
          )}
        </div>
      </section>
    </div>
  );
}
