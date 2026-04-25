import type { RankedSpot } from "@/lib/optimization";
import { SpotCard } from "@/components/map/SpotCard";
import { Badge } from "@/components/ui";

interface SpotListProps {
  spots: RankedSpot[];
  selectedSpotId: string | null;
  onSelectSpot: (spot: RankedSpot) => void;
  onBookSpot: (spot: RankedSpot) => void;
  onRouteSpot: (spot: RankedSpot) => void;
  onReportSpot: (spot: RankedSpot) => void;
}

export function SpotList({
  spots,
  selectedSpotId,
  onSelectSpot,
  onBookSpot,
  onRouteSpot,
  onReportSpot,
}: SpotListProps) {
  if (!spots.length) {
    return (
      <div className="glass-card map-empty-state">
        <p className="card-subtitle">No matching spots right now. Try changing destination or filters.</p>
      </div>
    );
  }

  return (
    <div className="spot-list-wrap">
      <div className="spot-list-head">
        <h3>Nearby Spots</h3>
        <Badge tone="info">{spots.length} shown</Badge>
      </div>
      <div className="spot-list">
      {spots.map((spot) => (
        <SpotCard
          key={spot.id}
          spot={spot}
          selected={selectedSpotId === spot.id}
          onSelect={() => onSelectSpot(spot)}
          onBook={() => onBookSpot(spot)}
          onRoute={() => onRouteSpot(spot)}
          onReport={() => onReportSpot(spot)}
        />
      ))}
      </div>
    </div>
  );
}
