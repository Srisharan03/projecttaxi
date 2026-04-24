"use client";

import { useMemo, useState } from "react";
import { GoogleMap, InfoWindowF, MarkerF } from "@react-google-maps/api";
import type { LatLng } from "@/lib/firestore";
import type { RankedSpot } from "@/lib/optimization";

interface ParkingMapProps {
  spots: RankedSpot[];
  destination: LatLng;
  selectedSpotId: string | null;
  onSelectSpot: (spotId: string) => void;
}

const mapContainerStyle = {
  height: "100%",
  minHeight: "60vh",
  width: "100%",
  borderRadius: "18px",
};

export function ParkingMap({ spots, destination, selectedSpotId, onSelectSpot }: ParkingMapProps) {
  const [activeInfoSpotId, setActiveInfoSpotId] = useState<string | null>(null);

  const center = useMemo(() => {
    const selected = spots.find((spot) => spot.id === selectedSpotId);
    if (selected) {
      return selected.location;
    }

    return destination;
  }, [spots, selectedSpotId, destination]);

  return (
    <div className="map-shell glass-card">
      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={14}>
        <MarkerF
          position={destination}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#06b6d4",
            fillOpacity: 0.95,
            strokeColor: "#0e7490",
            strokeWeight: 2,
            scale: 8,
          }}
          title="Destination"
        />

        {spots.map((spot) => {
          const selected = selectedSpotId === spot.id;

          return (
            <MarkerF
              key={spot.id}
              position={spot.location}
              title={spot.name}
              label={selected ? { text: "P", color: "#111827", fontWeight: "700" } : undefined}
              onClick={() => {
                onSelectSpot(spot.id);
                setActiveInfoSpotId(spot.id);
              }}
            >
              {activeInfoSpotId === spot.id ? (
                <InfoWindowF onCloseClick={() => setActiveInfoSpotId(null)}>
                  <div>
                    <strong>{spot.name}</strong>
                    <div>{spot.address}</div>
                    <div>Status: {spot.status}</div>
                  </div>
                </InfoWindowF>
              ) : null}
            </MarkerF>
          );
        })}
      </GoogleMap>
    </div>
  );
}
