import { Badge, Card } from "@/components/ui";

interface GeofenceValidatorProps {
  distanceMeters: number | null;
  radiusMeters?: number;
}

export function GeofenceValidator({
  distanceMeters,
  radiusMeters = 20,
}: GeofenceValidatorProps) {
  const withinRadius = distanceMeters !== null ? distanceMeters <= radiusMeters : false;

  return (
    <Card title="Geofence Check" subtitle="Validation required before occupancy updates.">
      {distanceMeters === null ? (
        <p className="card-subtitle">Awaiting OTP verification and location match.</p>
      ) : (
        <div className="toggle-row">
          <span>Distance to spot</span>
          <Badge tone={withinRadius ? "success" : "danger"}>
            {distanceMeters.toFixed(1)}m / {radiusMeters}m
          </Badge>
        </div>
      )}
    </Card>
  );
}
