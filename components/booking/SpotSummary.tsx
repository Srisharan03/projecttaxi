import { Badge, Card } from "@/components/ui";
import type { ParkingSpot } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";

interface SpotSummaryProps {
  spot: ParkingSpot & { id: string };
}

export function SpotSummary({ spot }: SpotSummaryProps) {
  return (
    <Card title={spot.name} subtitle={spot.address}>
      <div className="form-grid">
        <div className="toggle-row">
          <span>Status</span>
          <Badge tone={spot.status === "open" ? "success" : "warning"}>{spot.status}</Badge>
        </div>
        <div className="toggle-row">
          <span>Hourly Rate</span>
          <strong>{formatCurrency(spot.pricing.hourly_rate)}</strong>
        </div>
        <div className="toggle-row">
          <span>Flat Rate</span>
          <strong>{formatCurrency(spot.pricing.flat_rate)}</strong>
        </div>
        <div className="toggle-row">
          <span>Occupancy</span>
          <strong>
            {spot.current_occupancy}/{spot.total_spots}
          </strong>
        </div>
        <div className="toggle-row">
          <span>Trust</span>
          <strong>{spot.trust_score}/100</strong>
        </div>
      </div>
    </Card>
  );
}
