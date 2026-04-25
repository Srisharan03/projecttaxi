"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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
  type ParkingSpot,
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

const DEFAULT_PUBLIC_SCHEDULE: ParkingSpot["availability_schedule"] = {
  monday: { open: "00:00", close: "23:59" },
  tuesday: { open: "00:00", close: "23:59" },
  wednesday: { open: "00:00", close: "23:59" },
  thursday: { open: "00:00", close: "23:59" },
  friday: { open: "00:00", close: "23:59" },
  saturday: { open: "00:00", close: "23:59" },
  sunday: { open: "00:00", close: "23:59" },
};

function toCommunityPublicSpot(cluster: CommunitySpotCluster & { id: string }): ParkingSpot & { id: string } {
  const estimatedCapacity = Math.max(8, Math.min(80, Math.round((cluster.estimated_yards ?? 120) / 4)));
  const latestAuditSaysFull = cluster.latest_audit_status === "full";
  const reliabilityScore = Math.max(45, Math.min(99, cluster.reliability_score || 0));
  const tag = cluster.tag?.trim() || "Community Public Spot";

  return {
    id: `community-${cluster.id}`,
    name: tag,
    address: `Community-reported public parking (${cluster.location.lat.toFixed(5)}, ${cluster.location.lng.toFixed(5)})`,
    location: cluster.location,
    vendor_id: "community-public",
    type: "roadside",
    vehicle_types: ["bike", "car", "suv"],
    pricing: {
      flat_rate: 0,
      hourly_rate: 0,
    },
    total_spots: estimatedCapacity,
    current_occupancy: latestAuditSaysFull ? estimatedCapacity : 0,
    status: latestAuditSaysFull ? "closed" : "open",
    is_approved: true,
    trust_score: reliabilityScore,
    rating: Number((reliabilityScore / 20).toFixed(1)),
    review_count: cluster.report_count || 0,
    amenities: ["Public", "Community Verified"],
    images: cluster.report_image_url ? [cluster.report_image_url] : [],
    availability_schedule: DEFAULT_PUBLIC_SCHEDULE,
    conflict_flag: false,
  };
}

function isSameLocation(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
  precision = 0.000001,
): boolean {
  return Math.abs(left.lat - right.lat) <= precision && Math.abs(left.lng - right.lng) <= precision;
}

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
  const [spotSearchTerm, setSpotSearchTerm] = useState("");
  const [, setDestinationStatus] = useState<string>("Enter a destination and load public parking nearby.");
  const [communitySpots, setCommunitySpots] = useState<Array<CommunitySpotCluster & { id: string }>>([]);
  const [auditingClusterId, setAuditingClusterId] = useState<string | null>(null);
  const [auditTargetClusterId, setAuditTargetClusterId] = useState<string | null>(null);
  const [auditSpotId, setAuditSpotId] = useState<string | null>(null);
  const [publicAuditHistory, setPublicAuditHistory] = useState<Array<PublicSpotAudit & { id: string }>>([]);
  const [publicAuditLoading, setPublicAuditLoading] = useState(false);
  const [publicAuditError, setPublicAuditError] = useState("");
  const hasSyncedInitialLocation = useRef(false);

  const rankedSpots = getRankedSpots({
    search: spotSearchTerm,
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

  useEffect(() => {
    if (hasSyncedInitialLocation.current) {
      return;
    }

    getCurrentPosition()
      .then((coords) => {
        hasSyncedInitialLocation.current = true;
        // On first load, keep destination aligned with live user location instead of fallback center.
        if (isSameLocation(destinationLocation, userLocation)) {
          setDestinationLocation(coords);
        }
        setUserLocation(coords);
      })
      .catch(() => {
        hasSyncedInitialLocation.current = true;
        // Keep fallback location when user does not grant GPS permission.
      });
  }, [destinationLocation, setDestinationLocation, setUserLocation, userLocation]);

  const refreshRouteEfficiency = async (
    spotsToEvaluate: Array<{ id: string; location: { lat: number; lng: number } }>,
    nextVehicleType: typeof vehicleType,
    origin = userLocation,
  ) => {
    if (!spotsToEvaluate.length || !isGoogleLoaded) {
      setRouteMetrics({});
      return;
    }

    try {
      const metrics = await getRouteMetricsForSpots(
        origin,
        spotsToEvaluate.map((spot) => ({ id: spot.id, location: spot.location })),
        nextVehicleType,
      );
      setRouteMetrics(metrics);
    } catch {
      setRouteMetrics({});
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

      const nearbyCommunitySpots = communitySpots
        .filter((cluster) => haversine(destination.location, cluster.location) <= SEARCH_RADIUS_KM)
        .map(toCommunityPublicSpot);

      const mergedNearbySpots = Array.from(
        new Map(
          [...nearbyVendorSpots, ...publicSpots, ...nearbyCommunitySpots].map((spot) => [spot.id, spot]),
        ).values(),
      );

      const mergedVendorCount = mergedNearbySpots.filter((spot) => spot.vendor_id !== "google-public" && spot.vendor_id !== "community-public").length;
      const mergedGooglePublicCount = mergedNearbySpots.filter((spot) => spot.vendor_id === "google-public").length;
      const mergedCommunityPublicCount = mergedNearbySpots.filter((spot) => spot.vendor_id === "community-public").length;

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
        `Found ${mergedNearbySpots.length} nearby spots (${mergedVendorCount} approved owner + ${mergedGooglePublicCount} Google public + ${mergedCommunityPublicCount} community verified) near ${destination.formattedAddress}.`,
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
      <section className="section map-top-section">
        <Card className="map-vehicle-card">
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
          </div>
        </Card>
      </section>

      <section className="map-grid">
        <aside className="form-grid map-sidebar">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            spotSearch={spotSearchTerm}
            onSpotSearchChange={setSpotSearchTerm}
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

        <div className="map-canvas-wrap">
          {isGoogleLoaded ? (
            <DynamicParkingMap
              spots={rankedSpots}
              communitySpots={communitySpots.filter((cluster) => !rankedSpots.some((spot) => spot.id === `community-${cluster.id}`))}
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
