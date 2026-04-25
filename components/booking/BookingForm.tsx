import { Button, Card } from "@/components/ui";
import type { VehicleType } from "@/lib/firestore";

export interface BookingDraft {
  date: string;
  startTime: string;
  endTime: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
}

interface BookingFormProps {
  value: BookingDraft;
  amount: number;
  onChange: (next: BookingDraft) => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function BookingForm({
  value,
  amount,
  onChange,
  onSubmit,
  disabled,
  loading,
}: BookingFormProps) {
  return (
    <Card title="Booking Details" subtitle="Create a booking request for vendor approval.">
      <div className="form-grid">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <label>
            <span className="card-subtitle">Date</span>
            <input
              type="date"
              className="input"
              value={value.date}
              onChange={(event) => onChange({ ...value, date: event.target.value })}
            />
          </label>
          <label>
            <span className="card-subtitle">Start Time</span>
            <input
              type="time"
              className="input"
              value={value.startTime}
              onChange={(event) => onChange({ ...value, startTime: event.target.value })}
            />
          </label>
        </div>

        <label>
          <span className="card-subtitle">End Time</span>
          <input
            className="input"
            type="time"
            value={value.endTime}
            onChange={(event) => onChange({ ...value, endTime: event.target.value })}
          />
        </label>

        <input
          className="input"
          placeholder="Vehicle number"
          value={value.vehicleNumber}
          onChange={(event) => onChange({ ...value, vehicleNumber: event.target.value.toUpperCase() })}
        />

        <label>
          <span className="card-subtitle">Vehicle type</span>
          <select
            className="select"
            value={value.vehicleType}
            onChange={(event) => onChange({ ...value, vehicleType: event.target.value as VehicleType })}
          >
            <option value="bike">Bike</option>
            <option value="car">Car</option>
            <option value="suv">SUV</option>
          </select>
        </label>

        <div className="toggle-row">
          <span>Fixed Booking Amount</span>
          <strong>Rs {Math.round(amount)}</strong>
        </div>

        <Button onClick={onSubmit} disabled={disabled} isLoading={loading}>
          Create Booking Request
        </Button>
      </div>
    </Card>
  );
}
