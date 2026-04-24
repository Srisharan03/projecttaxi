interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearchDestination: () => void;
  isSearching?: boolean;
}

import { Card } from "@/components/ui";
import { Button } from "@/components/ui";

export function SearchBar({ value, onChange, onSearchDestination, isSearching = false }: SearchBarProps) {
  const canSearch = value.trim().length > 0;

  return (
    <Card title="Destination" subtitle="Search where you want to park, then load nearby public parking.">
      <div className="form-grid">
        <input
          className="input"
          placeholder="Try Banjara Hills, Jubilee Hills..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSearch) {
              onSearchDestination();
            }
          }}
        />

        <Button onClick={onSearchDestination} disabled={!canSearch} isLoading={isSearching}>
          Find Public Parking Near Destination
        </Button>
      </div>
    </Card>
  );
}
