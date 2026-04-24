"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Badge, Button, Card, Modal } from "@/components/ui";
import { FilterPanel } from "@/components/map/FilterPanel";
import { SearchBar } from "@/components/map/SearchBar";
import { SpotList } from "@/components/map/SpotList";
import { storage } from "@/lib/firebase";
import {
  ensurePublicParkingSpots,
  incrementUserCredits,
  submitAudit,
  type SpotStatus,
} from "@/lib/firestore";
import { getCurrentPosition, validateLocation } from "@/lib/geofence";
import { getGoogleMapsDirectionsUrl, getRoute } from "@/lib/routing";
import { formatDistanceKm, minutesToHoursAndMinutes } from "@/lib/utils";
import { useFilterStore } from "@/store/filterStore";
import { useParkingStore } from "@/store/parkingStore";
import type { RankedSpot } from "@/lib/optimization";
import "leaflet/dist/leaflet.css";
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

  const selectedSpotId = useParkingStore((state) => state.selectedSpotId);
  const userLocation = useParkingStore((state) => state.userLocation);
  const vehicleType = useParkingStore((state) => state.vehicleType);
  const isLoading = useParkingStore((state) => state.isLoading);
  const error = useParkingStore((state) => state.error);
  const startSpotsSubscription = useParkingStore((state) => state.startSpotsSubscription);
  const stopSpotsSubscription = useParkingStore((state) => state.stopSpotsSubscription);
  const setSelectedSpotId = useParkingStore((state) => state.setSelectedSpotId);
  const setUserLocation = useParkingStore((state) => state.setUserLocation);
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

  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [routeMeta, setRouteMeta] = useState<{ distanceMeters: number; durationSeconds: number } | null>(
    null,
  );
  const [routeError, setRouteError] = useState<string>("");
  const [fallbackMapsLink, setFallbackMapsLink] = useState<string>("");

  const [auditSpot, setAuditSpot] = useState<RankedSpot | null>(null);
  const [auditStatus, setAuditStatus] = useState<SpotStatus>("open");
  const [auditFile, setAuditFile] = useState<File | null>(null);
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string>("");

  useEffect(() => {
    startSpotsSubscription();
    return () => stopSpotsSubscription();
  }, [startSpotsSubscription, stopSpotsSubscription]);

  useEffect(() => {
    void ensurePublicParkingSpots();
  }, []);

  useEffect(() => {
    getCurrentPosition()
      .then((coords) => setUserLocation(coords))
      .catch(() => {
        // Keep default city center for demo stability when geolocation is blocked.
      });
  }, [setUserLocation]);

  const rankedSpots = getRankedSpots({
    search: searchTerm,
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

  const requestRoute = async (spot: RankedSpot) => {
    setRouteError("");
    setFallbackMapsLink("");

    try {
      const route = await getRoute(userLocation, spot.location, vehicleType);
      setRouteCoordinates(route.coordinates);
      setRouteMeta({
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
      });
    } catch (routeFetchError) {
      setRouteCoordinates([]);
      setRouteMeta(null);
      setRouteError(
        routeFetchError instanceof Error
          ? routeFetchError.message
          : "Routing unavailable. Open fallback navigation.",
      );
      setFallbackMapsLink(getGoogleMapsDirectionsUrl(userLocation, spot.location));
    }
  };

  const handleSubmitAudit = async () => {
    if (!auditSpot || !auditFile) {
      setAuditMessage("Select a spot photo and try again.");
      return;
    }

    setAuditSubmitting(true);
    setAuditMessage("");

    try {
      const currentPosition = await getCurrentPosition();
      const withinRadius = validateLocation(currentPosition, auditSpot.location, 20);

      if (!withinRadius) {
        setAuditMessage("You must be within 20m of the parking spot to submit an audit.");
        return;
      }

      const storageRef = ref(storage, `audits/${auditSpot.id}/${Date.now()}-${auditFile.name}`);
      await uploadBytes(storageRef, auditFile);
      const photoUrl = await getDownloadURL(storageRef);

      const result = await submitAudit({
        spot_id: auditSpot.id,
        reporter_user_id: "demo-user",
        reported_status: auditStatus,
        photo_url: photoUrl,
        location: currentPosition,
      });

      await incrementUserCredits("demo-user", result.credits);

      setAuditMessage(
        result.conflict
          ? "Audit submitted. Conflict detected, resolver credits boosted."
          : "Audit submitted successfully. Credits added.",
      );
      setAuditFile(null);
    } catch (submitError) {
      setAuditMessage(submitError instanceof Error ? submitError.message : "Audit submit failed.");
    } finally {
      setAuditSubmitting(false);
    }
  };

  return (
    <div className="map-page shell">
      <section className="section">
        <Card title="Smart Discovery" subtitle="Real-time availability + trust-aware ranking.">
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
            <Badge tone="success">Live Occupancy: {totalOccupied}/{totalCapacity || 0}</Badge>
          </div>

          {selectedSpot?.conflict_flag ? (
            <div className="toggle-row" style={{ marginTop: "0.75rem" }}>
              <Badge tone="warning">Conflicting reports at selected spot</Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAuditSpot(selectedSpot);
                  setAuditStatus(selectedSpot.status === "closed" ? "closed" : "open");
                  setAuditMessage("Verify this spot for 5 credits.");
                }}
              >
                Verify this spot for 5 credits
              </Button>
            </div>
          ) : null}

          {routeMeta ? (
            <p className="card-subtitle" style={{ marginTop: "0.75rem" }}>
              Route ready: {formatDistanceKm(routeMeta.distanceMeters / 1000)} in{" "}
              {minutesToHoursAndMinutes(Math.round(routeMeta.durationSeconds / 60))}
            </p>
          ) : null}

          {routeError ? (
            <p className="card-subtitle" style={{ marginTop: "0.75rem", color: "#ffe7b2" }}>
              {routeError}
            </p>
          ) : null}

          {fallbackMapsLink ? (
            <a href={fallbackMapsLink} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost">Open Google Maps fallback</Button>
            </a>
          ) : null}

          {error ? <p className="card-subtitle">{error}</p> : null}
          {isLoading ? <p className="card-subtitle">Loading live spots...</p> : null}
        </Card>
      </section>

      <section className="map-grid">
        <aside className="form-grid">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
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
            onBookSpot={(spot) => router.push(`/booking?spotId=${spot.id}`)}
            onRouteSpot={requestRoute}
            onReportSpot={(spot) => {
              setAuditSpot(spot);
              setAuditStatus(spot.status === "closed" ? "closed" : "open");
              setAuditMessage("");
            }}
          />
        </aside>

        <div>
          <DynamicParkingMap
            spots={rankedSpots}
            userLocation={userLocation}
            selectedSpotId={selectedSpot?.id ?? null}
            routeCoordinates={routeCoordinates}
            onSelectSpot={setSelectedSpotId}
          />
        </div>
      </section>

      <Modal
        open={Boolean(auditSpot)}
        onClose={() => {
          setAuditSpot(null);
          setAuditMessage("");
        }}
        title={auditSpot ? `Report ${auditSpot.name}` : "Report Spot"}
        description="Upload proof near the spot. Conflicts trigger verification rewards."
        footer={
          <Button onClick={handleSubmitAudit} isLoading={auditSubmitting}>
            Submit Audit
          </Button>
        }
      >
        <div className="form-grid">
          <label>
            <span className="card-subtitle">Observed status</span>
            <select
              className="select"
              value={auditStatus}
              onChange={(event) => setAuditStatus(event.target.value as SpotStatus)}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>

          <label>
            <span className="card-subtitle">Photo proof</span>
            <input
              className="input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setAuditFile(file);
              }}
            />
          </label>

          {auditMessage ? <p className="card-subtitle">{auditMessage}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
