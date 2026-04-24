import { Badge, Button, Card } from "@/components/ui";
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

export function SpotCard({ spot, selected, onSelect, onBook, onRoute, onReport }: SpotCardProps) {
  const occupancyText = `${spot.current_occupancy}/${spot.total_spots} occupied`;

  return (
    <Card
      className={selected ? "spot-card-selected" : ""}
      title={spot.name}
      subtitle={spot.address}
      actions={<Badge tone={spot.status === "open" ? "success" : "neutral"}>{spot.status}</Badge>}
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
          <div className="spot-card-label">Distance</div>
          <div className="spot-card-value">{formatDistanceKm(spot.distanceKm)}</div>
        </div>
        <div>
          <div className="spot-card-label">Occupancy</div>
          <Badge tone={getAvailabilityTone(spot)}>{occupancyText}</Badge>
        </div>
        <div>
          <div className="spot-card-label">Trust</div>
          <div className="spot-card-value">{spot.trust_score}/100</div>
        </div>
      </div>

      <div className="hero-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <Button size="sm" variant="secondary" onClick={onRoute}>
          Navigate
        </Button>
        <Button size="sm" variant="ghost" onClick={onReport}>
          {spot.conflict_flag ? "Verify" : "Audit"}
        </Button>
        <Button style={{ gridColumn: "span 2" }} onClick={onBook} disabled={spot.status !== "open"}>
          {spot.status === "open" ? "Reserve Parking" : "Vendor Closed"}
        </Button>
      </div>
    </Card>
  );
}
