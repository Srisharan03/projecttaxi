"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLng } from "@/lib/firestore";
import type { RankedSpot } from "@/lib/optimization";

interface ParkingMapProps {
  spots: RankedSpot[];
  userLocation: LatLng;
  selectedSpotId: string | null;
  routeCoordinates: LatLng[];
  onSelectSpot: (spotId: string) => void;
}

function FitToSelection({
  selectedSpotId,
  spots,
  userLocation,
}: {
  selectedSpotId: string | null;
  spots: RankedSpot[];
  userLocation: LatLng;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedSpotId) {
      map.setView([userLocation.lat, userLocation.lng], 13);
      return;
    }

    const selected = spots.find((spot) => spot.id === selectedSpotId);
    if (!selected) {
      return;
    }

    map.setView([selected.location.lat, selected.location.lng], 15);
  }, [selectedSpotId, spots, userLocation, map]);

  return null;
}

function markerColor(spot: RankedSpot): string {
  if (spot.status === "closed") {
    return "#9ca3af";
  }

  if (spot.availabilityRatio > 0.5) {
    return "#10b981";
  }

  if (spot.availabilityRatio > 0.2) {
    return "#f59e0b";
  }

  return "#ef4444";
}

export function ParkingMap({
  spots,
  userLocation,
  selectedSpotId,
  routeCoordinates,
  onSelectSpot,
}: ParkingMapProps) {
  return (
    <div className="map-shell glass-card">
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={13}
        style={{ height: "100%", minHeight: "60vh", width: "100%", borderRadius: "18px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          pathOptions={{ color: "#06b6d4", fillColor: "#06b6d4", fillOpacity: 0.6 }}
          radius={10}
        >
          <Popup>You are here</Popup>
        </CircleMarker>

        {spots.map((spot) => (
          <CircleMarker
            key={spot.id}
            center={[spot.location.lat, spot.location.lng]}
            pathOptions={{
              color: markerColor(spot),
              fillColor: markerColor(spot),
              fillOpacity: selectedSpotId === spot.id ? 0.95 : 0.72,
              weight: selectedSpotId === spot.id ? 3 : 1,
            }}
            radius={selectedSpotId === spot.id ? 10 : 8}
            eventHandlers={{
              click: () => onSelectSpot(spot.id),
            }}
          >
            <Popup>
              <strong>{spot.name}</strong>
              <br />
              {spot.current_occupancy}/{spot.total_spots} occupied
              <br />
              Status: {spot.status}
            </Popup>
          </CircleMarker>
        ))}

        {routeCoordinates.length > 1 ? (
          <Polyline
            positions={routeCoordinates.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: "#06b6d4", weight: 5, opacity: 0.9 }}
          />
        ) : null}

        <FitToSelection selectedSpotId={selectedSpotId} spots={spots} userLocation={userLocation} />
      </MapContainer>
    </div>
  );
}
