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
  const handleCardAction =
    (callback: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      callback();
    };

  return (
    <Card
      className={`spot-card ${selected ? "spot-card-selected" : ""} ${isPublicSpot ? "spot-card-public" : "spot-card-vendor"}`}
      title={spot.name}
      subtitle={spot.address}
      actions={
        <div className="hero-actions spot-card-badges">
          <Badge tone={isPublicSpot ? "info" : "success"}>{isPublicSpot ? "Public" : "Owner"}</Badge>
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
      </div>

      <div className="spot-card-meta-row">
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

      <div className="spot-card-actions">
        <div className="spot-card-quick-actions">
          <button
            type="button"
            className="spot-icon-btn"
            onClick={handleCardAction(onRoute)}
            aria-label="Navigate"
            title="Navigate"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 19L19 12L5 5V10L14 12L5 14V19Z" fill="currentColor" />
            </svg>
          </button>
          {isPublicSpot ? (
            <button
              type="button"
              className="spot-icon-btn"
              onClick={handleCardAction(onReport)}
              aria-label={spot.conflict_flag ? "Verify spot" : "Audit spot"}
              title={spot.conflict_flag ? "Verify spot" : "Audit spot"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 2L3 6V12C3 17 6.6 21.7 12 23C17.4 21.7 21 17 21 12V6L12 2ZM10.6 16.2L7.4 13L8.8 11.6L10.6 13.4L15.2 8.8L16.6 10.2L10.6 16.2Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : null}
          {showProofButton ? (
            <button
              type="button"
              className="spot-icon-btn"
              onClick={handleCardAction(() => setShowProofModal(true))}
              aria-label="View proof"
              title="View proof"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM8.5 9C7.7 9 7 8.3 7 7.5S7.7 6 8.5 6S10 6.7 10 7.5S9.3 9 8.5 9ZM5 19L9 14L12 18L16 13L19 19H5Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : null}
        </div>

        {isPublicSpot ? (
          <Button
            size="sm"
            className="spot-card-primary-action"
            onClick={(event) => {
              event.stopPropagation();
              onRoute();
            }}
            disabled={spot.status !== "open"}
          >
            {spot.status === "open" ? "Navigate (Public Spot)" : "Closed"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="spot-card-primary-action"
            onClick={(event) => {
              event.stopPropagation();
              onBook();
            }}
            disabled={spot.status !== "open"}
          >
            Book Slot
          </Button>
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
