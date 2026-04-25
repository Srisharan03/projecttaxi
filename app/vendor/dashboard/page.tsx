"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import {
  subscribeToSessions,
  subscribeToSpots,
  subscribeToVendors,
  toggleSpotStatus,
  updateVendorSpot,
  type ParkingSpot,
  type Session,
  type Vendor,
} from "@/lib/firestore";
import "@/styles/vendor.css";

type VendorWithId = Vendor & { id: string };
type SpotWithId = ParkingSpot & { id: string };
type SessionWithId = Session & { id: string };

interface SpotEditDraft {
  name: string;
  address: string;
  totalSpots: string;
  hourlyRate: string;
  flatRate: string;
  amenitiesInput: string;
  images: string[];
  newImages: FileList | null;
}

const MAX_FILES_PER_GROUP = 3;
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

function parseAmenities(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toDraft(spot: SpotWithId): SpotEditDraft {
  return {
    name: spot.name,
    address: spot.address,
    totalSpots: String(spot.total_spots),
    hourlyRate: String(spot.pricing.hourly_rate),
    flatRate: String(spot.pricing.flat_rate),
    amenitiesInput: spot.amenities.join(", "),
    images: Array.isArray(spot.images) ? spot.images : [],
    newImages: null,
  };
}

async function uploadFilesToCloudinary(folder: string, files: FileList | null): Promise<string[]> {
  if (!files?.length) {
    return [];
  }

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local.",
    );
  }

  if (files.length > MAX_FILES_PER_GROUP) {
    throw new Error(`You can upload maximum ${MAX_FILES_PER_GROUP} files at a time.`);
  }

  const uploads = Array.from(files).map(async (file) => {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image upload failed for ${file.name}. ${errorText}`);
    }

    const payload = (await response.json()) as { secure_url?: string };
    if (!payload.secure_url) {
      throw new Error(`Cloudinary did not return a secure URL for ${file.name}.`);
    }

    return payload.secure_url;
  });

  return Promise.all(uploads);
}

export default function VendorDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [vendors, setVendors] = useState<VendorWithId[]>([]);
  const [spots, setSpots] = useState<SpotWithId[]>([]);
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SpotEditDraft>>({});
  const [busySpotId, setBusySpotId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribeVendors = subscribeToVendors((rows) => setVendors(rows));
    const unsubscribeSpots = subscribeToSpots((rows) => setSpots(rows));
    const unsubscribeSessions = subscribeToSessions((rows) => setSessions(rows));

    return () => {
      unsubscribeVendors();
      unsubscribeSpots();
      unsubscribeSessions();
    };
  }, []);

  const vendorPool = useMemo(() => {
    const email = user?.email;
    if (typeof email !== "string" || !email) {
      return vendors;
    }

    return vendors.filter((vendor) => vendor.email.toLowerCase() === email.toLowerCase());
  }, [vendors, user]);

  const effectiveVendorId = useMemo(() => {
    if (vendorId && vendorPool.some((vendor) => vendor.id === vendorId)) {
      return vendorId;
    }

    return vendorPool[0]?.id ?? "";
  }, [vendorId, vendorPool]);

  const selectedVendor = useMemo(() => {
    return vendorPool.find((vendor) => vendor.id === effectiveVendorId) ?? null;
  }, [vendorPool, effectiveVendorId]);

  const vendorSpots = useMemo(() => {
    if (!selectedVendor) {
      return [];
    }

    return spots
      .filter((spot) => spot.vendor_id === selectedVendor.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [spots, selectedVendor]);

  const totalSpots = vendorSpots.length;
  const openSpots = vendorSpots.filter((spot) => spot.status === "open").length;
  const totalCapacity = vendorSpots.reduce((acc, spot) => acc + spot.total_spots, 0);
  const totalOccupied = vendorSpots.reduce((acc, spot) => acc + spot.current_occupancy, 0);
  const vendorSpotIds = new Set(vendorSpots.map((spot) => spot.id));
  const pendingRequestCount = sessions.filter((session) => {
    if (!vendorSpotIds.has(session.spot_id)) {
      return false;
    }

    return (session.approval_status ?? "accepted") === "pending" && session.status === "booked";
  }).length;

  const startEdit = (spot: SpotWithId) => {
    setDrafts((current) => ({ ...current, [spot.id]: toDraft(spot) }));
    setEditingSpotId(spot.id);
    setStatusMessage("");
    setErrorMessage("");
  };

  const cancelEdit = (spotId: string) => {
    setEditingSpotId((current) => (current === spotId ? null : current));
    setDrafts((current) => {
      const next = { ...current };
      delete next[spotId];
      return next;
    });
  };

  const updateDraft = (spotId: string, patch: Partial<SpotEditDraft>) => {
    setDrafts((current) => {
      const base = current[spotId];
      if (!base) {
        return current;
      }

      return {
        ...current,
        [spotId]: { ...base, ...patch },
      };
    });
  };

  const removeDraftImage = (spotId: string, imageUrl: string) => {
    const draft = drafts[spotId];
    if (!draft) {
      return;
    }

    updateDraft(spotId, { images: draft.images.filter((url) => url !== imageUrl) });
  };

  const handleToggleAvailability = async (spot: SpotWithId) => {
    setBusySpotId(spot.id);
    setStatusMessage("");
    setErrorMessage("");

    try {
      await toggleSpotStatus(spot.id, spot.status === "open" ? "closed" : "open");
      setStatusMessage(`${spot.name} is now ${spot.status === "open" ? "closed" : "open"}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to change spot availability.");
    } finally {
      setBusySpotId(null);
    }
  };

  const handleSaveSpot = async (spot: SpotWithId) => {
    const draft = drafts[spot.id];
    if (!draft) {
      return;
    }

    const amenities = parseAmenities(draft.amenitiesInput);
    if (!draft.name.trim() || !draft.address.trim()) {
      setErrorMessage("Spot name and address are required.");
      return;
    }

    if (!amenities.length) {
      setErrorMessage("Add at least one amenity.");
      return;
    }

    setBusySpotId(spot.id);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const uploadedImages = await uploadFilesToCloudinary(
        `vendor-spots-updates/${spot.vendor_id}/${spot.id}`,
        draft.newImages,
      );

      const mergedImages = Array.from(new Set([...draft.images, ...uploadedImages]));

      await updateVendorSpot(spot.id, {
        name: draft.name.trim(),
        address: draft.address.trim(),
        amenities,
        images: mergedImages,
        total_spots: Number(draft.totalSpots || 0),
        pricing: {
          flat_rate: Number(draft.flatRate || 0),
          hourly_rate: Number(draft.hourlyRate || 0),
        },
      });

      setStatusMessage(`${draft.name} updated successfully.`);
      cancelEdit(spot.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save spot changes.");
    } finally {
      setBusySpotId(null);
    }
  };

  return (
    <div className="vendor-page shell">
      <section className="section">
        <Card
          title="Spot Operations Dashboard"
          subtitle="Track live occupancy, control availability, and edit your parking spots."
        >
          <div className="form-grid">
            <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "1fr auto" }}>
              <label className="vendor-form-field">
                <span className="vendor-form-label">Vendor Profile</span>
                <select
                  className="select"
                  value={effectiveVendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                >
                  {vendorPool.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="hero-actions" style={{ alignSelf: "end" }}>
                <Link href="/vendor/requests">
                  <Button variant="secondary">
                    Booking Requests {pendingRequestCount > 0 ? `(${pendingRequestCount})` : ""}
                  </Button>
                </Link>
                <Link href="/vendor/register">
                  <Button variant="secondary">Register Parking Spot</Button>
                </Link>
              </div>
            </div>

            {selectedVendor ? (
              <div className="hero-actions">
                <Badge tone={selectedVendor.status === "approved" ? "success" : "warning"}>
                  Vendor status: {selectedVendor.status}
                </Badge>
                <Badge tone="info">Spots: {totalSpots}</Badge>
                <Badge tone="success">Open now: {openSpots}</Badge>
                <Badge tone="neutral">Occupancy: {totalOccupied}/{totalCapacity || 0}</Badge>
                <Badge tone={pendingRequestCount > 0 ? "warning" : "success"}>
                  Pending Requests: {pendingRequestCount}
                </Badge>
              </div>
            ) : null}

            {statusMessage ? <p className="card-subtitle" style={{ color: "#0f766e" }}>{statusMessage}</p> : null}
            {errorMessage ? <p className="card-subtitle" style={{ color: "#b91c1c" }}>{errorMessage}</p> : null}
          </div>
        </Card>
      </section>

      <section className="section">
        {!vendorSpots.length ? (
          <Card title="No Parking Spots Yet" subtitle="Register a spot to start tracking occupancy and managing availability." />
        ) : (
          <div className="form-grid">
            {vendorSpots.map((spot) => {
              const isEditing = editingSpotId === spot.id;
              const draft = drafts[spot.id];
              const coverImage = (isEditing ? draft?.images?.[0] : spot.images?.[0]) ?? "";
              const isBusy = busySpotId === spot.id;

              return (
                <Card key={spot.id} title={spot.name} subtitle={spot.address} className="vendor-ops-card">
                  <div className="form-grid">
                    <div className="vendor-ops-head">
                      {coverImage ? (
                        <Image
                          src={coverImage}
                          alt={`${spot.name} cover`}
                          width={240}
                          height={140}
                          style={{ width: "180px", height: "110px", objectFit: "cover", borderRadius: "10px" }}
                          unoptimized
                        />
                      ) : (
                        <div className="vendor-preview-file-tag" style={{ width: "180px", height: "110px" }}>
                          No Image
                        </div>
                      )}

                      <div className="form-grid" style={{ gap: "0.5rem", flex: 1 }}>
                        <div className="hero-actions">
                          <Badge tone={spot.is_approved ? "success" : "warning"}>
                            {spot.is_approved ? "Approved" : "Pending Approval"}
                          </Badge>
                          <Badge tone={spot.status === "open" ? "success" : "neutral"}>
                            {spot.status === "open" ? "Open" : "Closed"}
                          </Badge>
                        </div>
                        <p className="card-subtitle">
                          Occupancy: <strong>{spot.current_occupancy}/{spot.total_spots}</strong>
                        </p>
                        <div className="hero-actions">
                          <Button
                            variant={spot.status === "open" ? "secondary" : "primary"}
                            onClick={() => void handleToggleAvailability(spot)}
                            isLoading={isBusy}
                          >
                            {spot.status === "open" ? "Set Closed" : "Set Open"}
                          </Button>
                          {!isEditing ? (
                            <Button variant="ghost" onClick={() => startEdit(spot)}>
                              Edit Spot
                            </Button>
                          ) : (
                            <Button variant="ghost" onClick={() => cancelEdit(spot.id)}>
                              Cancel Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditing && draft ? (
                      <div className="vendor-upload-block">
                        <div className="vendor-form-grid-2">
                          <label className="vendor-form-field">
                            <span className="vendor-form-label">Spot Name</span>
                            <input
                              className="input"
                              value={draft.name}
                              onChange={(event) => updateDraft(spot.id, { name: event.target.value })}
                            />
                          </label>
                          <label className="vendor-form-field">
                            <span className="vendor-form-label">Address</span>
                            <input
                              className="input"
                              value={draft.address}
                              onChange={(event) => updateDraft(spot.id, { address: event.target.value })}
                            />
                          </label>
                        </div>

                        <div className="vendor-form-grid-2">
                          <label className="vendor-form-field">
                            <span className="vendor-form-label">Hourly Rate</span>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              value={draft.hourlyRate}
                              onChange={(event) => updateDraft(spot.id, { hourlyRate: event.target.value })}
                            />
                          </label>
                          <label className="vendor-form-field">
                            <span className="vendor-form-label">Flat Rate</span>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              value={draft.flatRate}
                              onChange={(event) => updateDraft(spot.id, { flatRate: event.target.value })}
                            />
                          </label>
                        </div>

                        <div className="vendor-form-grid-2">
                          <label className="vendor-form-field">
                            <span className="vendor-form-label">Total Slots</span>
                            <input
                              className="input"
                              type="number"
                              min={1}
                              value={draft.totalSpots}
                              onChange={(event) => updateDraft(spot.id, { totalSpots: event.target.value })}
                            />
                          </label>
                          <label className="vendor-form-field">
                            <span className="vendor-form-label">Amenities (comma separated)</span>
                            <input
                              className="input"
                              value={draft.amenitiesInput}
                              onChange={(event) => updateDraft(spot.id, { amenitiesInput: event.target.value })}
                              placeholder="CCTV, EV Charging, Security"
                            />
                          </label>
                        </div>

                        <label className="vendor-form-field">
                          <span className="vendor-form-label">Add New Spot Images</span>
                          <input
                            className="input"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(event) => updateDraft(spot.id, { newImages: event.target.files })}
                          />
                          <span className="vendor-form-helper">
                            Upload up to {MAX_FILES_PER_GROUP} files in one update.
                          </span>
                        </label>

                        <div className="hero-actions">
                          {draft.images.map((url) => (
                            <Button
                              key={url}
                              type="button"
                              variant="ghost"
                              onClick={() => removeDraftImage(spot.id, url)}
                            >
                              Remove Existing Image
                            </Button>
                          ))}
                          {!draft.images.length ? <p className="card-subtitle">No existing images attached.</p> : null}
                        </div>

                        <div className="hero-actions">
                          <Button
                            type="button"
                            onClick={() => void handleSaveSpot(spot)}
                            isLoading={isBusy}
                          >
                            Save Spot Changes
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
