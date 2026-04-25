"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge, Button, Card, Modal } from "@/components/ui";
import type { RankedSpot } from "@/lib/optimization";
import { formatCurrency, formatDistanceKm } from "@/lib/utils";

interface SpotCardProps {
  spot: RankedSpot;
  selected: boolean;
  onSelect: () => void;
  onBook: () => void;
  onRoute: () => void;
  onReport: () => void;
}

function getAvailabilityTone(spot: RankedSpot): "success" | "warning" | "danger" {
  if (spot.availabilityRatio > 0.5) {
    return "success";
  }

  if (spot.availabilityRatio > 0.2) {
    return "warning";
  }

  return "danger";
}

export function SpotCard({
  spot,
  selected,
  onSelect,
  onBook,
  onRoute,
  onReport,
}: SpotCardProps) {
  const [showProofModal, setShowProofModal] = useState(false);
  const occupancyText = `${spot.current_occupancy}/${spot.total_spots} occupied`;
  const previewImage = spot.images?.[0] ?? "";
  const isPublicSpot = spot.vendor_id === "google-public" || spot.vendor_id === "community-public";
  const showProofButton = Boolean(previewImage);

  return (
    <Card
      className={`${selected ? "spot-card-selected" : ""} ${isPublicSpot ? "spot-card-public" : "spot-card-vendor"}`}
      title={spot.name}
      subtitle={spot.address}
      actions={
        <div className="hero-actions">
          <Badge tone={isPublicSpot ? "info" : "success"}>{isPublicSpot ? "Public" : "Vendor"}</Badge>
          <Badge tone={spot.status === "open" ? "success" : "neutral"}>{spot.status}</Badge>
        </div>
      }
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSelect();
        }
      }}
    >
      <div className="spot-card-grid">
        <div>
          <div className="spot-card-label">Rate</div>
          <div className="spot-card-value">{formatCurrency(spot.pricing.hourly_rate)}/hr</div>
        </div>
        <div>
          <div className="spot-card-label">From You</div>
          <div className="spot-card-value">{formatDistanceKm(spot.currentDistanceKm)}</div>
        </div>
        <div>
          <div className="spot-card-label">ETA</div>
          <div className="spot-card-value">~{spot.routeEtaMinutes} min</div>
        </div>
        <div>
          <div className="spot-card-label">To Destination</div>
          <div className="spot-card-value">{formatDistanceKm(spot.destinationDistanceKm)}</div>
        </div>
        {!isPublicSpot ? (
          <div>
            <div className="spot-card-label">Occupancy</div>
            <Badge tone={getAvailabilityTone(spot)}>{occupancyText}</Badge>
          </div>
        ) : null}
        <div>
          <div className="spot-card-label">Route Fit</div>
          <div className="spot-card-value">{spot.routeLabel}</div>
        </div>
      </div>

      <div className="hero-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <Button size="sm" variant="secondary" onClick={onRoute}>
          Navigate
        </Button>
        {isPublicSpot ? (
          <Button size="sm" variant="ghost" onClick={onReport}>
            {spot.conflict_flag ? "Verify" : "Audit"}
          </Button>
        ) : null}
        {showProofButton ? (
          <Button style={{ gridColumn: "span 2" }} size="sm" variant="ghost" onClick={() => setShowProofModal(true)}>
            View Proof
          </Button>
        ) : null}
        {isPublicSpot ? (
          <Button style={{ gridColumn: "span 2" }} onClick={onRoute} disabled={spot.status !== "open"}>
            {spot.status === "open" ? "Navigate (Public Spot)" : "Closed"}
          </Button>
        ) : (
          <>
            <Button style={{ gridColumn: "span 2" }} onClick={onBook} disabled={spot.status !== "open"}>
              Book Slot
            </Button>
          </>
        )}
      </div>
      <Modal
        open={showProofModal}
        onClose={() => setShowProofModal(false)}
        title={`${spot.name} Proof Image`}
        description="Community-provided visual proof for reliability."
      >
        {previewImage ? (
          <Image
            src={previewImage}
            alt={`${spot.name} proof`}
            width={900}
            height={520}
            unoptimized
            style={{ width: "100%", height: "auto", borderRadius: "12px", objectFit: "cover" }}
          />
        ) : (
          <p className="card-subtitle">No proof image available.</p>
        )}
      </Modal>
    </Card>
  );
}
