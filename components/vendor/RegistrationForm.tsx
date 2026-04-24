"use client";

import { useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Badge, Button, Card } from "@/components/ui";
import { storage } from "@/lib/firebase";
import { getCurrentPosition } from "@/lib/geofence";
import { registerVendor, type VehicleType } from "@/lib/firestore";

const VEHICLE_OPTIONS: VehicleType[] = ["bike", "car", "suv"];
const AMENITY_OPTIONS = ["CCTV", "Closed Space", "EV Charging", "Security"];
const SPOT_TYPE_OPTIONS = ["mall", "municipal", "private", "residential", "roadside"] as const;
const SIZE_UNIT_OPTIONS = ["sqft", "yards"] as const;

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
  platformFeeRate: string;
}

interface SpotDraft {
  id: string;
  spotName: string;
  address: string;
  lat: string;
  lng: string;
  spotType: (typeof SPOT_TYPE_OPTIONS)[number];
  flatRate: string;
  hourlyRate: string;
  totalSpots: string;
  sizeValue: string;
  sizeUnit: (typeof SIZE_UNIT_OPTIONS)[number];
  vehicleTypes: VehicleType[];
  amenities: string[];
  otherAmenityInput: string;
  customAmenities: string[];
  spotPhotos: FileList | null;
}

const INITIAL_STATE: RegistrationState = {
  vendorName: "",
  email: "",
  phone: "",
  platformFeeRate: "0.15",
};

function debugLog(message: string, meta?: unknown): void {
  if (meta !== undefined) {
    console.log(`[VendorRegistration] ${message}`, meta);
    return;
  }

  console.log(`[VendorRegistration] ${message}`);
}

function createSpotDraft(seed?: number): SpotDraft {
  return {
    id: `${Date.now()}-${seed ?? Math.random()}`,
    spotName: "",
    address: "",
    lat: "17.385",
    lng: "78.4867",
    spotType: "private",
    flatRate: "50",
    hourlyRate: "80",
    totalSpots: "20",
    sizeValue: "200",
    sizeUnit: "sqft",
    vehicleTypes: ["car"],
    amenities: ["CCTV"],
    otherAmenityInput: "",
    customAmenities: [],
    spotPhotos: null,
  };
}

async function uploadFiles(folder: string, files: FileList | null): Promise<string[]> {
  if (!files?.length) {
    debugLog(`No files selected for ${folder}`);
    return [];
  }

  debugLog(`Starting upload batch for ${folder}`, { count: files.length });

  const compressImageFile = async (file: File): Promise<Blob> => {
    if (!file.type.startsWith("image/")) {
      debugLog(`Skipping compression for non-image file ${file.name}`, {
        type: file.type,
        sizeKB: Number((file.size / 1024).toFixed(2)),
      });
      return file;
    }

    const compressionStart = performance.now();
    const imageBitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
    canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.78);
    });

    const compressed = blob ?? file;
    debugLog(`Compressed ${file.name}`, {
      originalKB: Number((file.size / 1024).toFixed(2)),
      compressedKB: Number((compressed.size / 1024).toFixed(2)),
      width: canvas.width,
      height: canvas.height,
      durationMs: Number((performance.now() - compressionStart).toFixed(2)),
    });

    return compressed;
  };

  const uploads = Array.from(files).map(async (file) => {
    const uploadStart = performance.now();

    try {
      const content = await compressImageFile(file);
      const fileRef = ref(storage, `${folder}/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, content, {
        contentType: file.type.startsWith("image/") ? "image/jpeg" : file.type,
      });
      const url = await getDownloadURL(fileRef);

      debugLog(`Uploaded ${file.name}`, {
        folder,
        uploadMs: Number((performance.now() - uploadStart).toFixed(2)),
        finalKB: Number((content.size / 1024).toFixed(2)),
      });

      return url;
    } catch (error) {
      console.error(`[VendorRegistration] Upload failed for ${file.name}`, error);
      throw error;
    }
  });

  const urls = await Promise.all(uploads);
  debugLog(`Completed upload batch for ${folder}`, { uploaded: urls.length });
  return urls;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function RegistrationForm() {
  const [step, setStep] = useState<"vendor" | "spots">("vendor");
  const [state, setState] = useState<RegistrationState>(INITIAL_STATE);
  const [vendorImage, setVendorImage] = useState<FileList | null>(null);
  const [spotDrafts, setSpotDrafts] = useState<SpotDraft[]>([createSpotDraft(0)]);
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [result, setResult] = useState<{ vendorId: string; spotIds: string[] } | null>(null);
  const [error, setError] = useState<string>("");

  const canContinueToSpots = useMemo(() => {
    return !!state.vendorName.trim() && !!state.email.trim() && !!state.phone.trim();
  }, [state]);

  const canSubmit = useMemo(() => {
    return (
      canContinueToSpots &&
      spotDrafts.length > 0 &&
      spotDrafts.every((spot) => {
        return (
          !!spot.spotName.trim() &&
          !!spot.address.trim() &&
          !!spot.lat.trim() &&
          !!spot.lng.trim() &&
          !!spot.hourlyRate.trim() &&
          !!spot.sizeValue.trim() &&
          spot.vehicleTypes.length > 0
        );
      })
    );
  }, [canContinueToSpots, spotDrafts]);

  const updateSpot = (spotId: string, patch: Partial<SpotDraft>) => {
    setSpotDrafts((current) =>
      current.map((spot) => {
        if (spot.id !== spotId) {
          return spot;
        }

        return { ...spot, ...patch };
      }),
    );
  };

  const addSpot = () => {
    setSpotDrafts((current) => [...current, createSpotDraft(current.length)]);
  };

  const removeSpot = (spotId: string) => {
    setSpotDrafts((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((spot) => spot.id !== spotId);
    });
  };

  const toggleVehicleType = (spotId: string, vehicleType: VehicleType) => {
    setSpotDrafts((current) =>
      current.map((spot) => {
        if (spot.id !== spotId) {
          return spot;
        }

        const exists = spot.vehicleTypes.includes(vehicleType);
        if (exists) {
          return {
            ...spot,
            vehicleTypes: spot.vehicleTypes.filter((item) => item !== vehicleType),
          };
        }

        return {
          ...spot,
          vehicleTypes: [...spot.vehicleTypes, vehicleType],
        };
      }),
    );
  };

  const toggleAmenity = (spotId: string, amenity: string) => {
    setSpotDrafts((current) =>
      current.map((spot) => {
        if (spot.id !== spotId) {
          return spot;
        }

        const exists = spot.amenities.includes(amenity);
        if (exists) {
          return {
            ...spot,
            amenities: spot.amenities.filter((item) => item !== amenity),
          };
        }

        return {
          ...spot,
          amenities: [...spot.amenities, amenity],
        };
      }),
    );
  };

  const addCustomAmenity = (spotId: string) => {
    setSpotDrafts((current) =>
      current.map((spot) => {
        if (spot.id !== spotId) {
          return spot;
        }

        const value = spot.otherAmenityInput.trim();
        if (!value || spot.customAmenities.includes(value)) {
          return spot;
        }

        return {
          ...spot,
          customAmenities: [...spot.customAmenities, value],
          otherAmenityInput: "",
        };
      }),
    );
  };

  const removeCustomAmenity = (spotId: string, amenity: string) => {
    setSpotDrafts((current) =>
      current.map((spot) => {
        if (spot.id !== spotId) {
          return spot;
        }

        return {
          ...spot,
          customAmenities: spot.customAmenities.filter((item) => item !== amenity),
        };
      }),
    );
  };

  const fillCurrentLocation = async (spotId: string) => {
    try {
      const coords = await getCurrentPosition();
      updateSpot(spotId, {
        lat: String(coords.lat),
        lng: String(coords.lng),
      });
      setError("");
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Unable to fetch current location for this spot.",
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSubmitStatus("Uploading images and documents...");
    const submitStart = performance.now();

    debugLog("Submit started", {
      vendorName: state.vendorName,
      email: state.email,
      spotCount: spotDrafts.length,
      documentCount: documents?.length ?? 0,
      vendorImageCount: vendorImage?.length ?? 0,
    });

    try {
      const vendorSlug = state.vendorName.replace(/\s+/g, "-").toLowerCase();

      const [vendorImageUrls, documentUrls, allSpotImageUrls] = await withTimeout(
        Promise.all([
          uploadFiles(`vendor-profile/${vendorSlug}`, vendorImage),
          uploadFiles(`vendor-docs/${vendorSlug}`, documents),
          Promise.all(
            spotDrafts.map((spot, index) =>
              uploadFiles(`vendor-spots/${vendorSlug}/${index + 1}`, spot.spotPhotos),
            ),
          ),
        ]),
        120000,
        "Uploads are taking too long. Please reduce image count and try again.",
      );

      debugLog("Upload stage completed", {
        vendorImages: vendorImageUrls.length,
        documents: documentUrls.length,
        spotImageCounts: allSpotImageUrls.map((images) => images.length),
      });

      setSubmitStatus("Saving spot details with location and pricing...");

      const registration = await withTimeout(
        registerVendor({
          vendor: {
            name: state.vendorName,
            email: state.email,
            phone: state.phone,
            profile_image: vendorImageUrls[0] ?? "",
            documents: documentUrls,
            platform_fee_rate: Number(state.platformFeeRate || 0.15),
          },
          spots: spotDrafts.map((spot, index) => {
            const amenities = [...spot.amenities, ...spot.customAmenities];

            return {
              name: spot.spotName,
              address: spot.address,
              location: {
                lat: Number(spot.lat),
                lng: Number(spot.lng),
              },
              size_sqft: spot.sizeUnit === "sqft" ? Number(spot.sizeValue) : undefined,
              size_yards: spot.sizeUnit === "yards" ? Number(spot.sizeValue) : undefined,
              type: spot.spotType,
              vehicle_types: spot.vehicleTypes,
              pricing: {
                flat_rate: Number(spot.flatRate || 0),
                hourly_rate: Number(spot.hourlyRate || 0),
              },
              total_spots: Number(spot.totalSpots || 0),
              amenities,
              images: allSpotImageUrls[index],
              availability_schedule: DEFAULT_SCHEDULE,
            };
          }),
        }),
        60000,
        "Saving registration took too long. Please try again.",
      );

      debugLog("Firestore save completed", registration);

      setResult(registration);
      setSubmitStatus("Registration complete. Your spot is now discoverable on the map.");
      setStep("vendor");
      setState(INITIAL_STATE);
      setVendorImage(null);
      setSpotDrafts([createSpotDraft(0)]);
      setDocuments(null);
    } catch (submitError) {
      console.error("[VendorRegistration] Submit failed", submitError);
      setSubmitStatus("");
      setError(submitError instanceof Error ? submitError.message : "Unable to register vendor.");
    } finally {
      debugLog("Submit finished", {
        totalMs: Number((performance.now() - submitStart).toFixed(2)),
      });
      setSubmitting(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {step === "vendor" ? (
        <Card title="Step 1: Vendor Details" subtitle="Basic profile before adding parking spaces.">
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
              placeholder="Phone Number"
              value={state.phone}
              onChange={(event) => setState((current) => ({ ...current, phone: event.target.value }))}
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

            <label>
              <span className="card-subtitle">Vendor photo</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(event) => setVendorImage(event.target.files)}
              />
            </label>

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

          <div className="hero-actions" style={{ marginTop: "1rem" }}>
            <Button type="button" disabled={!canContinueToSpots} onClick={() => setStep("spots")}>
              Continue to Spot Details
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "spots" ? (
        <Card
          title="Step 2: Parking Spot Details"
          subtitle="One vendor can register multiple parking spots in one submission."
        >
          <div className="form-grid">
            {spotDrafts.map((spot, index) => (
              <Card
                key={spot.id}
                title={`Spot ${index + 1}`}
                subtitle="Image, size, location, amenities, and price"
              >
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Spot Name"
                    value={spot.spotName}
                    onChange={(event) => updateSpot(spot.id, { spotName: event.target.value })}
                  />

                  <label>
                    <span className="card-subtitle">Space image upload</span>
                    <input
                      className="input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(event) => updateSpot(spot.id, { spotPhotos: event.target.files })}
                    />
                  </label>

                  <input
                    className="input"
                    placeholder="Address"
                    value={spot.address}
                    onChange={(event) => updateSpot(spot.id, { address: event.target.value })}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <input
                      className="input"
                      placeholder="Latitude"
                      value={spot.lat}
                      onChange={(event) => updateSpot(spot.id, { lat: event.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Longitude"
                      value={spot.lng}
                      onChange={(event) => updateSpot(spot.id, { lng: event.target.value })}
                    />
                  </div>

                  <Button type="button" variant="secondary" onClick={() => void fillCurrentLocation(spot.id)}>
                    Use Current Location
                  </Button>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      placeholder="Space size"
                      value={spot.sizeValue}
                      onChange={(event) => updateSpot(spot.id, { sizeValue: event.target.value })}
                    />
                    <select
                      className="select"
                      value={spot.sizeUnit}
                      onChange={(event) =>
                        updateSpot(spot.id, {
                          sizeUnit: event.target.value as SpotDraft["sizeUnit"],
                        })
                      }
                    >
                      {SIZE_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    className="select"
                    value={spot.spotType}
                    onChange={(event) =>
                      updateSpot(spot.id, {
                        spotType: event.target.value as SpotDraft["spotType"],
                      })
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
                      placeholder="Flat price"
                      value={spot.flatRate}
                      onChange={(event) => updateSpot(spot.id, { flatRate: event.target.value })}
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="Price per hour"
                      value={spot.hourlyRate}
                      onChange={(event) => updateSpot(spot.id, { hourlyRate: event.target.value })}
                    />
                  </div>

                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder="Total parking slots"
                    value={spot.totalSpots}
                    onChange={(event) => updateSpot(spot.id, { totalSpots: event.target.value })}
                  />

                  <div>
                    <span className="card-subtitle">Amenities</span>
                    <div className="hero-actions" style={{ marginTop: "0.4rem" }}>
                      {AMENITY_OPTIONS.map((amenity) => {
                        const active = spot.amenities.includes(amenity);
                        return (
                          <Button
                            key={amenity}
                            type="button"
                            variant={active ? "primary" : "secondary"}
                            onClick={() => toggleAmenity(spot.id, amenity)}
                          >
                            {amenity}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem" }}>
                    <input
                      className="input"
                      placeholder="Other amenity"
                      value={spot.otherAmenityInput}
                      onChange={(event) =>
                        updateSpot(spot.id, {
                          otherAmenityInput: event.target.value,
                        })
                      }
                    />
                    <Button type="button" variant="secondary" onClick={() => addCustomAmenity(spot.id)}>
                      Add Other
                    </Button>
                  </div>

                  {spot.customAmenities.length ? (
                    <div className="hero-actions">
                      {spot.customAmenities.map((amenity) => (
                        <Button
                          key={amenity}
                          type="button"
                          variant="ghost"
                          onClick={() => removeCustomAmenity(spot.id, amenity)}
                        >
                          {amenity} x
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  <div>
                    <span className="card-subtitle">Vehicle types</span>
                    <div className="hero-actions" style={{ marginTop: "0.4rem" }}>
                      {VEHICLE_OPTIONS.map((type) => {
                        const active = spot.vehicleTypes.includes(type);
                        return (
                          <Button
                            key={type}
                            type="button"
                            variant={active ? "primary" : "secondary"}
                            onClick={() => toggleVehicleType(spot.id, type)}
                          >
                            {type.toUpperCase()}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="hero-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={spotDrafts.length === 1}
                      onClick={() => removeSpot(spot.id)}
                    >
                      Remove This Spot
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            <div className="hero-actions">
              <Button type="button" variant="secondary" onClick={addSpot}>
                Add Another Parking Spot
              </Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <Button type="button" variant="ghost" onClick={() => setStep("vendor")}>
                Back to Vendor Details
              </Button>
              <Button type="submit" isLoading={submitting} disabled={!canSubmit}>
                Submit Vendor + {spotDrafts.length} Spot(s)
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="hero-actions">
        <Badge tone="warning">New spots are submitted as pending. Admin approval makes them live on map and bookings.</Badge>
      </div>

      {submitStatus ? <p className="card-subtitle">{submitStatus}</p> : null}

      {result ? (
        <Card title="Registration Submitted">
          <p className="card-subtitle">Vendor ID: {result.vendorId}</p>
          <p className="card-subtitle">Spot IDs: {result.spotIds.join(", ")}</p>
        </Card>
      ) : null}

      {error ? <p className="card-subtitle">{error}</p> : null}
    </form>
  );
}
