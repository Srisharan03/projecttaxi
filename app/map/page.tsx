"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { FilterPanel } from "@/components/map/FilterPanel";
import { useGoogleMapsLoader } from "@/components/providers/GoogleMapsProvider";
import { SearchBar } from "@/components/map/SearchBar";
import { SpotList } from "@/components/map/SpotList";
import { PublicSpotAuditModal } from "@/components/map/PublicSpotAuditModal";
import {
  addCommunitySpotAudit,
  getCommunitySpotAuditHistory,
  getPublicSpotAuditHistory,
  getSpots,
  subscribeToCommunitySpots,
  type CommunitySpotAudit,
  type CommunitySpotCluster,
  type PublicSpotAudit,
} from "@/lib/firestore";
import { getCurrentPosition } from "@/lib/geofence";
import { fetchNearbyPublicParkingSpots, geocodeDestination } from "@/lib/googlePlaces";
import { haversine } from "@/lib/optimization";
import { getGoogleMapsDirectionsUrl, getRouteMetricsForSpots } from "@/lib/routing";
import { useAuthStore } from "@/store/authStore";
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
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const SEARCH_RADIUS_KM = 5;
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded: isGoogleLoaded, loadError } = useGoogleMapsLoader();

  const selectedSpotId = useParkingStore((state) => state.selectedSpotId);
  const storeSpots = useParkingStore((state) => state.spots);
  const userLocation = useParkingStore((state) => state.userLocation);
  const destinationLocation = useParkingStore((state) => state.destinationLocation);
  const vehicleType = useParkingStore((state) => state.vehicleType);
  const replaceSpots = useParkingStore((state) => state.replaceSpots);
  const setRouteMetrics = useParkingStore((state) => state.setRouteMetrics);
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
  const [communitySpots, setCommunitySpots] = useState<Array<CommunitySpotCluster & { id: string }>>([]);
  const [auditingClusterId, setAuditingClusterId] = useState<string | null>(null);
  const [auditTargetClusterId, setAuditTargetClusterId] = useState<string | null>(null);
  const [auditSpotId, setAuditSpotId] = useState<string | null>(null);
  const [publicAuditHistory, setPublicAuditHistory] = useState<Array<PublicSpotAudit & { id: string }>>([]);
  const [publicAuditLoading, setPublicAuditLoading] = useState(false);
  const [publicAuditError, setPublicAuditError] = useState("");
  const [isRefreshingRoutes, setIsRefreshingRoutes] = useState(false);

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
  const selectedAuditSpot = useMemo(() => {
    return rankedSpots.find((spot) => spot.id === auditSpotId) ?? null;
  }, [rankedSpots, auditSpotId]);

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

  const refreshRouteEfficiency = async (
    spotsToEvaluate: Array<{ id: string; location: { lat: number; lng: number } }>,
    nextVehicleType: typeof vehicleType,
    origin = userLocation,
  ) => {
    if (!spotsToEvaluate.length || !isGoogleLoaded) {
      setRouteMetrics({});
      return;
    }

    setIsRefreshingRoutes(true);
    try {
      const metrics = await getRouteMetricsForSpots(
        origin,
        spotsToEvaluate.map((spot) => ({ id: spot.id, location: spot.location })),
        nextVehicleType,
      );
      setRouteMetrics(metrics);
    } catch {
      setRouteMetrics({});
    } finally {
      setIsRefreshingRoutes(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToCommunitySpots(
      (rows) => setCommunitySpots(rows.filter((row) => row.is_verified)),
      () => {
        // Keep map usable if subscription fails.
      },
      { verifiedOnly: true },
    );

    return () => unsubscribe();
  }, []);

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

      const nearbyVendorSpots = firestoreSpots
        .filter((spot) => {
          if (spot.is_approved !== true) {
            return false;
          }

          if (spot.status !== "open") {
            return false;
          }

          return haversine(destination.location, spot.location) <= SEARCH_RADIUS_KM;
        })
        .map((spot) => {
          return {
            ...spot,
            images: Array.isArray(spot.images) ? spot.images : [],
          };
        });

      const mergedNearbySpots = Array.from(
        new Map(
          [...nearbyVendorSpots, ...publicSpots].map((spot) => [spot.id, spot]),
        ).values(),
      );

      const mergedVendorCount = mergedNearbySpots.filter((spot) => spot.vendor_id !== "google-public").length;
      const mergedPublicCount = mergedNearbySpots.length - mergedVendorCount;

      replaceSpots(mergedNearbySpots);
      setSelectedSpotId(null);
      await refreshRouteEfficiency(mergedNearbySpots, vehicleType, userLocation);

      if (!mergedNearbySpots.length) {
        setDestinationStatus(
          `No parking spots found near ${destination.formattedAddress}. Try a wider destination query.`,
        );
        return;
      }

      setDestinationStatus(
        `Found ${mergedNearbySpots.length} nearby spots (${mergedVendorCount} approved vendor + ${mergedPublicCount} public) near ${destination.formattedAddress}.`,
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
    const link = getGoogleMapsDirectionsUrl(userLocation, spot.location, vehicleType);
    setFallbackMapsLink(link);

    if (typeof window !== "undefined") {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  const handleVehicleTypeChange = async (nextType: typeof vehicleType) => {
    if (vehicleType === nextType) {
      return;
    }

    setVehicleType(nextType);
    if (storeSpots.length) {
      await refreshRouteEfficiency(storeSpots, nextType, userLocation);
    }
  };

  const handleBookSpot = (spot: (typeof rankedSpots)[number]) => {
    if (spot.vendor_id === "google-public") {
      handleRouteSpot(spot);
      return;
    }

    router.push(`/booking?spotId=${spot.id}`);
  };

  const handleAuditCommunitySpot = async (
    clusterId: string,
    status: "space_left" | "full",
    message?: string,
  ) => {
    const reporterId = user?.uid || user?.email || "demo-user";
    if (!reporterId) {
      setDestinationStatus("Login required to submit community audit.");
      return;
    }

    setAuditingClusterId(clusterId);
    try {
      const currentLocation = await getCurrentPosition();
      await addCommunitySpotAudit(clusterId, reporterId, status, message, currentLocation);
      setDestinationStatus(
        status === "space_left"
          ? "Community update submitted: space available."
          : "Community update submitted: spot likely full.",
      );
    } catch (auditError) {
      setDestinationStatus(
        auditError instanceof Error
          ? auditError.message
          : "Unable to submit community spot audit.",
      );
    } finally {
      setAuditingClusterId(null);
    }
  };

  const handleLoadCommunityAuditHistory = async (
    clusterId: string,
  ): Promise<Array<CommunitySpotAudit & { id: string }>> => {
    return getCommunitySpotAuditHistory(clusterId, 40);
  };

  const loadPublicAuditHistory = async (spotId: string): Promise<void> => {
    setPublicAuditLoading(true);
    setPublicAuditError("");
    try {
      const rows = await getPublicSpotAuditHistory(spotId, 40);
      setPublicAuditHistory(rows);
    } catch (historyError) {
      const message = historyError instanceof Error ? historyError.message : "";
      const isIndexError =
        message.toLowerCase().includes("query requires an index") ||
        message.toLowerCase().includes("firestore/indexes");
      if (isIndexError) {
        setPublicAuditError("Audit history is temporarily unavailable. Please try again shortly.");
      } else {
        setPublicAuditError("Unable to load public spot audit history right now.");
        if (historyError instanceof Error) {
          console.error("[PublicAudit] Failed to load history", historyError);
        }
      }
      setPublicAuditHistory([]);
    } finally {
      setPublicAuditLoading(false);
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
              onClick={() => void handleVehicleTypeChange("bike")}
            >
              Bike
            </Button>
            <Button
              variant={vehicleType === "car" ? "primary" : "secondary"}
              onClick={() => void handleVehicleTypeChange("car")}
            >
              Car
            </Button>
            <Button
              variant={vehicleType === "suv" ? "primary" : "secondary"}
              onClick={() => void handleVehicleTypeChange("suv")}
            >
              SUV
            </Button>
            <Badge tone={isRefreshingRoutes ? "warning" : "neutral"}>
              {isRefreshingRoutes ? "Refreshing route efficiency..." : "Route efficiency active"}
            </Badge>
            <Badge tone="success">Visible Occupancy: {totalOccupied}/{totalCapacity || 0}</Badge>
          </div>

          <p className="card-subtitle" style={{ marginTop: "0.75rem" }}>
            {destinationStatus}
          </p>

          <p className="card-subtitle" style={{ marginTop: "0.5rem" }}>
            Ranking order: route efficiency first, then destination distance, price, and reliability.
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
            onBookSpot={handleBookSpot}
            onRouteSpot={handleRouteSpot}
            onReportSpot={(spot) => {
              if (spot.vendor_id === "google-public") {
                setSelectedSpotId(spot.id);
                setAuditSpotId(spot.id);
                setDestinationStatus("Public spot audit opened.");
                void loadPublicAuditHistory(spot.id);
                return;
              }
              setDestinationStatus("This audit button is for public spots only.");
            }}
          />
        </aside>

        <div>
          {isGoogleLoaded ? (
            <DynamicParkingMap
              spots={rankedSpots}
              communitySpots={communitySpots}
              destination={destinationLocation}
              selectedSpotId={selectedSpot?.id ?? null}
              onSelectSpot={setSelectedSpotId}
              selectedRoutePath={selectedSpot?.routePath || []}
              selectedRouteLabel={selectedSpot?.routeLabel}
              selectedRouteEtaMinutes={selectedSpot?.routeEtaMinutes}
              auditTargetClusterId={auditTargetClusterId}
              onClearAuditTarget={() => setAuditTargetClusterId(null)}
              onAuditCommunitySpot={handleAuditCommunitySpot}
              onLoadCommunityAuditHistory={handleLoadCommunityAuditHistory}
              auditingClusterId={auditingClusterId}
            />
          ) : (
            <div className="map-shell glass-card" />
          )}
        </div>
      </section>

      <PublicSpotAuditModal
        key={auditSpotId ?? "no-public-audit"}
        open={Boolean(auditSpotId)}
        onClose={() => {
          setAuditSpotId(null);
          setPublicAuditHistory([]);
          setPublicAuditError("");
        }}
        spot={selectedAuditSpot}
        reporterId={user?.uid || user?.email || "demo-user"}
        history={publicAuditHistory}
        isHistoryLoading={publicAuditLoading}
        historyError={publicAuditError}
        onRefreshHistory={async () => {
          if (!selectedAuditSpot) {
            return;
          }
          await loadPublicAuditHistory(selectedAuditSpot.id);
        }}
      />
    </div>
  );
}
