interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

import { Card } from "@/components/ui";

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <Card title="Search" subtitle="Find parking near your destination.">
      <input
        className="input"
        placeholder="Try Banjara Hills, Jubilee Hills..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Card>
  );
}
