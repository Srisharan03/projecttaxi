import { Badge, Button, Card } from "@/components/ui";
import type { ParkingSpot } from "@/lib/firestore";

interface SpotManagerProps {
  spots: Array<ParkingSpot & { id: string }>;
  onToggleStatus: (spotId: string, currentStatus: "open" | "closed") => void;
}

export function SpotManager({ spots, onToggleStatus }: SpotManagerProps) {
  if (!spots.length) {
    return <p className="card-subtitle">No spots yet for this owner.</p>;
  }

  return (
    <div className="form-grid">
      {spots.map((spot) => (
        <Card key={spot.id} title={spot.name} subtitle={spot.address}>
          <div className="toggle-row">
            <span>
              Occupancy: {spot.current_occupancy}/{spot.total_spots}
            </span>
            <Badge tone={spot.status === "open" ? "success" : "neutral"}>{spot.status}</Badge>
          </div>
          <div className="hero-actions vendor-spot-manager-actions">
            <Button
              variant={spot.status === "open" ? "secondary" : "primary"}
              onClick={() => onToggleStatus(spot.id!, spot.status)}
            >
              {spot.status === "open" ? "Set Closed" : "Set Open"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
