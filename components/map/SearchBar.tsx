interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  spotSearch: string;
  onSpotSearchChange: (value: string) => void;
  onSearchDestination: () => void;
  isSearching?: boolean;
}

import { Badge, Button, Card } from "@/components/ui";

export function SearchBar({
  value,
  onChange,
  spotSearch,
  onSpotSearchChange,
  onSearchDestination,
  isSearching = false,
}: SearchBarProps) {
  const canSearch = value.trim().length > 0;

  return (
    <Card className="map-search-card" title="Find Parking" subtitle="Start with destination, then refine spot list.">
      <div className="form-grid">
        <label className="map-field">
          <span className="map-field-label">Destination</span>
          <input
            className="input"
            placeholder="Ex: Banjara Hills, Jubilee Hills..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSearch) {
                onSearchDestination();
              }
            }}
          />
        </label>

        <Button onClick={onSearchDestination} disabled={!canSearch} isLoading={isSearching}>
          Load Nearby Spots
        </Button>

        <label className="map-field">
          <span className="map-field-label">Quick Filter</span>
          <input
            className="input"
            placeholder="Filter spots by name or address..."
            value={spotSearch}
            onChange={(event) => onSpotSearchChange(event.target.value)}
          />
        </label>

        <div className="map-search-chips">
          <Badge tone="info">Realtime ranking</Badge>
          <Badge tone="success">Public + owner spots</Badge>
        </div>
      </div>
    </Card>
  );
}
