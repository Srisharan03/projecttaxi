import { useState } from "react";
import { Card } from "@/components/ui";
import { Button } from "@/components/ui";

const AMENITIES = ["CCTV", "Covered", "EV Charging", "24/7", "Security"];

interface FilterPanelProps {
  amenities: string[];
  maxHourlyRate: number;
  sortBy: "score" | "distance" | "price";
  includeClosed: boolean;
  onAmenitiesChange: (amenities: string[]) => void;
  onMaxHourlyRateChange: (max: number) => void;
  onSortByChange: (sortBy: "score" | "distance" | "price") => void;
  onIncludeClosedChange: (includeClosed: boolean) => void;
}

export function FilterPanel({
  amenities,
  maxHourlyRate,
  sortBy,
  includeClosed,
  onAmenitiesChange,
  onMaxHourlyRateChange,
  onSortByChange,
  onIncludeClosedChange,
}: FilterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleAmenity = (amenity: string) => {
    if (amenities.includes(amenity)) {
      onAmenitiesChange(amenities.filter((item) => item !== amenity));
      return;
    }

    onAmenitiesChange([...amenities, amenity]);
  };

  return (
    <Card className="map-filter-card" title="Refine Results" subtitle="Use advanced filters only when needed.">
      <div className="form-grid">
        <label className="map-field">
          <span className="card-subtitle">Sort by</span>
          <select
            className="select"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as "score" | "distance" | "price")}
          >
            <option value="score">Smart Score</option>
            <option value="distance">Distance</option>
            <option value="price">Price</option>
          </select>
        </label>

        <label className="map-field">
          <span className="card-subtitle">Max hourly rate: Rs {maxHourlyRate}</span>
          <input
            type="range"
            min={30}
            max={300}
            value={maxHourlyRate}
            onChange={(event) => onMaxHourlyRateChange(Number(event.target.value))}
          />
        </label>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {showAdvanced ? "Hide Advanced Filters" : "Show Advanced Filters"}
        </Button>

        {showAdvanced ? (
          <>
            <div>
              <span className="card-subtitle" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Amenities</span>
              <div className="amenities-grid">
                {AMENITIES.map((amenity) => {
                  const checked = amenities.includes(amenity);
                  return (
                    <label key={amenity} className="toggle-row-compact">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAmenity(amenity)}
                      />
                      <span style={{ fontSize: "0.9rem" }}>{amenity}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="toggle-row">
              <span>Show closed spots</span>
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(event) => onIncludeClosedChange(event.target.checked)}
              />
            </label>
          </>
        ) : null}
      </div>
    </Card>
  );
}
