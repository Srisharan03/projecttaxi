import type { RankedSpot } from "@/lib/optimization";
import { SpotCard } from "@/components/map/SpotCard";

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
    return <p className="card-subtitle">No matching spots right now. Adjust filters and try again.</p>;
  }

  return (
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
  );
}
