"use client";

import { useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Badge, Button, Card } from "@/components/ui";
import { storage } from "@/lib/firebase";
import { registerVendor, type VehicleType } from "@/lib/firestore";

const VEHICLE_OPTIONS: VehicleType[] = ["bike", "car", "suv"];
const AMENITY_OPTIONS = ["CCTV", "Covered", "EV Charging", "24/7", "Security"];
const SPOT_TYPE_OPTIONS = ["mall", "municipal", "private", "residential", "roadside"] as const;

const DEFAULT_SCHEDULE = {
  monday: { open: "06:00", close: "23:00" },
  tuesday: { open: "06:00", close: "23:00" },
  wednesday: { open: "06:00", close: "23:00" },
  thursday: { open: "06:00", close: "23:00" },
  friday: { open: "06:00", close: "23:00" },
  saturday: { open: "06:00", close: "23:00" },
  sunday: { open: "06:00", close: "23:00" },
};

interface RegistrationState {
  vendorName: string;
  email: string;
  phone: string;
  spotName: string;
  address: string;
  lat: string;
  lng: string;
  spotType: (typeof SPOT_TYPE_OPTIONS)[number];
  flatRate: string;
  hourlyRate: string;
  totalSpots: string;
  platformFeeRate: string;
  vehicleTypes: VehicleType[];
  amenities: string[];
}

const INITIAL_STATE: RegistrationState = {
  vendorName: "",
  email: "",
  phone: "",
  spotName: "",
  address: "",
  lat: "17.385",
  lng: "78.4867",
  spotType: "private",
  flatRate: "50",
  hourlyRate: "80",
  totalSpots: "20",
  platformFeeRate: "0.15",
  vehicleTypes: ["car"],
  amenities: ["CCTV"],
};

async function uploadFiles(folder: string, files: FileList | null): Promise<string[]> {
  if (!files?.length) {
    return [];
  }

  const uploads = Array.from(files).map(async (file) => {
    const fileRef = ref(storage, `${folder}/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  });

  return Promise.all(uploads);
}

export function RegistrationForm() {
  const [state, setState] = useState<RegistrationState>(INITIAL_STATE);
  const [spotPhotos, setSpotPhotos] = useState<FileList | null>(null);
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ vendorId: string; spotId: string } | null>(null);
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(() => {
    return (
      !!state.vendorName.trim() &&
      !!state.email.trim() &&
      !!state.phone.trim() &&
      !!state.spotName.trim() &&
      !!state.address.trim()
    );
  }, [state]);

  const toggleVehicleType = (vehicleType: VehicleType) => {
    setState((current) => {
      const exists = current.vehicleTypes.includes(vehicleType);
      if (exists) {
        return {
          ...current,
          vehicleTypes: current.vehicleTypes.filter((item) => item !== vehicleType),
        };
      }

      return {
        ...current,
        vehicleTypes: [...current.vehicleTypes, vehicleType],
      };
    });
  };

  const toggleAmenity = (amenity: string) => {
    setState((current) => {
      const exists = current.amenities.includes(amenity);
      if (exists) {
        return {
          ...current,
          amenities: current.amenities.filter((item) => item !== amenity),
        };
      }

      return {
        ...current,
        amenities: [...current.amenities, amenity],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const [imageUrls, documentUrls] = await Promise.all([
        uploadFiles(`vendor-spots/${state.vendorName.replace(/\s+/g, "-").toLowerCase()}`, spotPhotos),
        uploadFiles(`vendor-docs/${state.vendorName.replace(/\s+/g, "-").toLowerCase()}`, documents),
      ]);

      const registration = await registerVendor({
        vendor: {
          name: state.vendorName,
          email: state.email,
          phone: state.phone,
          documents: documentUrls,
          platform_fee_rate: Number(state.platformFeeRate || 0.15),
        },
        spot: {
          name: state.spotName,
          address: state.address,
          location: {
            lat: Number(state.lat),
            lng: Number(state.lng),
          },
          type: state.spotType,
          vehicle_types: state.vehicleTypes,
          pricing: {
            flat_rate: Number(state.flatRate || 0),
            hourly_rate: Number(state.hourlyRate || 0),
          },
          total_spots: Number(state.totalSpots || 0),
          amenities: state.amenities,
          images: imageUrls,
          availability_schedule: DEFAULT_SCHEDULE,
        },
      });

      setResult(registration);
      setState(INITIAL_STATE);
      setSpotPhotos(null);
      setDocuments(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to register vendor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <Card title="Vendor Details" subtitle="Create your ParkSaathi marketplace profile.">
        <div className="form-grid">
          <input
            className="input"
            placeholder="Vendor / Business Name"
            value={state.vendorName}
            onChange={(event) => setState((current) => ({ ...current, vendorName: event.target.value }))}
          />
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={state.email}
            onChange={(event) => setState((current) => ({ ...current, email: event.target.value }))}
          />
          <input
            className="input"
            placeholder="Phone"
            value={state.phone}
            onChange={(event) => setState((current) => ({ ...current, phone: event.target.value }))}
          />
          <label>
            <span className="card-subtitle">Verification documents</span>
            <input
              className="input"
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(event) => setDocuments(event.target.files)}
            />
          </label>
        </div>
      </Card>

      <Card title="Spot Details" subtitle="This listing appears after admin approval.">
        <div className="form-grid">
          <input
            className="input"
            placeholder="Spot Name"
            value={state.spotName}
            onChange={(event) => setState((current) => ({ ...current, spotName: event.target.value }))}
          />
          <input
            className="input"
            placeholder="Address"
            value={state.address}
            onChange={(event) => setState((current) => ({ ...current, address: event.target.value }))}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <input
              className="input"
              placeholder="Latitude"
              value={state.lat}
              onChange={(event) => setState((current) => ({ ...current, lat: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Longitude"
              value={state.lng}
              onChange={(event) => setState((current) => ({ ...current, lng: event.target.value }))}
            />
          </div>

          <select
            className="select"
            value={state.spotType}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                spotType: event.target.value as RegistrationState["spotType"],
              }))
            }
          >
            {SPOT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <input
              className="input"
              type="number"
              min={0}
              placeholder="Flat rate"
              value={state.flatRate}
              onChange={(event) => setState((current) => ({ ...current, flatRate: event.target.value }))}
            />
            <input
              className="input"
              type="number"
              min={0}
              placeholder="Hourly rate"
              value={state.hourlyRate}
              onChange={(event) => setState((current) => ({ ...current, hourlyRate: event.target.value }))}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="Total spots"
              value={state.totalSpots}
              onChange={(event) => setState((current) => ({ ...current, totalSpots: event.target.value }))}
            />
            <input
              className="input"
              type="number"
              step={0.01}
              min={0.05}
              max={0.5}
              placeholder="Platform fee rate"
              value={state.platformFeeRate}
              onChange={(event) =>
                setState((current) => ({ ...current, platformFeeRate: event.target.value }))
              }
            />
          </div>

          <label>
            <span className="card-subtitle">Spot photos</span>
            <input
              className="input"
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => setSpotPhotos(event.target.files)}
            />
          </label>

          <div>
            <span className="card-subtitle">Vehicle types</span>
            <div className="hero-actions" style={{ marginTop: "0.4rem" }}>
              {VEHICLE_OPTIONS.map((type) => {
                const active = state.vehicleTypes.includes(type);
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={active ? "primary" : "secondary"}
                    onClick={() => toggleVehicleType(type)}
                  >
                    {type.toUpperCase()}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="card-subtitle">Amenities</span>
            <div className="hero-actions" style={{ marginTop: "0.4rem" }}>
              {AMENITY_OPTIONS.map((amenity) => {
                const active = state.amenities.includes(amenity);
                return (
                  <Button
                    key={amenity}
                    type="button"
                    variant={active ? "primary" : "secondary"}
                    onClick={() => toggleAmenity(amenity)}
                  >
                    {amenity}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="hero-actions">
        <Button type="submit" isLoading={submitting} disabled={!canSubmit}>
          Submit for Approval
        </Button>
        <Badge tone="warning">New spots remain hidden until admin approval</Badge>
      </div>

      {result ? (
        <Card title="Registration Submitted">
          <p className="card-subtitle">Vendor ID: {result.vendorId}</p>
          <p className="card-subtitle">Spot ID: {result.spotId}</p>
        </Card>
      ) : null}

      {error ? <p className="card-subtitle">{error}</p> : null}
    </form>
  );
}
