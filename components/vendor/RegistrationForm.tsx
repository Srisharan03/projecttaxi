"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { GoogleMap, MarkerF } from "@react-google-maps/api";
import { Badge, Button, Card } from "@/components/ui";
import { useGoogleMapsLoader } from "@/components/providers/GoogleMapsProvider";
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
};

const MAX_IMAGE_DIMENSION = 1200;
const MAX_FILES_PER_GROUP = 3;
const DEFAULT_PLATFORM_FEE_RATE = 0.15;
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const DEFAULT_SPOT_LOCATION = { lat: 17.385, lng: 78.4867 };
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

interface FilePreviewItem {
  name: string;
  size: number;
  isImage: boolean;
  typeLabel: string;
  previewUrl: string | null;
}

function debugLog(message: string, meta?: unknown): void {
  if (meta !== undefined) {
    console.log(`[VendorRegistration] ${message}`, meta);
    return;
  }

  console.log(`[VendorRegistration] ${message}`);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toTypeLabel(file: File): string {
  if (file.type === "application/pdf") {
    return "PDF";
  }

  if (file.type.startsWith("image/")) {
    return "Image";
  }

  return "File";
}

function FilePreviewGrid({
  files,
  emptyText,
}: {
  files: FileList | null;
  emptyText: string;
}) {
  const items: FilePreviewItem[] = useMemo(() => {
    if (!files?.length) {
      return [];
    }

    return Array.from(files).map((file) => {
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : null;

      return {
        name: file.name,
        size: file.size,
        isImage,
        typeLabel: toTypeLabel(file),
        previewUrl,
      };
    });
  }, [files]);

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [items]);

  if (!items.length) {
    return <p className="vendor-upload-empty">{emptyText}</p>;
  }

  return (
    <div className="vendor-preview-grid">
      {items.map((item) => (
        <article className="vendor-preview-card" key={`${item.name}-${item.size}`}>
          {item.isImage && item.previewUrl ? (
            <Image
              className="vendor-preview-image"
              src={item.previewUrl}
              alt={item.name}
              width={240}
              height={160}
              unoptimized
            />
          ) : (
            <div className="vendor-preview-file-tag">{item.typeLabel}</div>
          )}
          <p className="vendor-preview-name" title={item.name}>
            {item.name}
          </p>
          <p className="vendor-preview-size">{formatFileSize(item.size)}</p>
        </article>
      ))}
    </div>
  );
}

function createSpotDraft(id: string): SpotDraft {
  return {
    id,
    spotName: "",
    address: "",
    lat: "",
    lng: "",
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

function getSpotCoordinates(spot: SpotDraft): { lat: number; lng: number } {
  const lat = Number(spot.lat);
  const lng = Number(spot.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return DEFAULT_SPOT_LOCATION;
}

async function uploadFilesToCloudinary(label: string, files: FileList | null): Promise<string[]> {
  if (!files?.length) {
    debugLog(`No files selected for ${label}`);
    return [];
  }

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local.",
    );
  }

  if (files.length > MAX_FILES_PER_GROUP) {
    throw new Error(
      `${label}: You can upload maximum ${MAX_FILES_PER_GROUP} files.`,
    );
  }

  debugLog(`Starting Cloudinary upload batch for ${label}`, { count: files.length });

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
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height));

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
    const conversionStart = performance.now();

    try {
      const content = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", content, file.name);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", label);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${label}: Cloudinary upload failed for ${file.name}. ${errorText}`);
      }

      const payload = (await response.json()) as { secure_url?: string };
      if (!payload.secure_url) {
        throw new Error(`${label}: Cloudinary did not return a secure URL for ${file.name}.`);
      }

      debugLog(`Uploaded ${file.name} to Cloudinary`, {
        label,
        conversionMs: Number((performance.now() - conversionStart).toFixed(2)),
        finalKB: Number((content.size / 1024).toFixed(2)),
        url: payload.secure_url,
      });

      return payload.secure_url;
    } catch (error) {
      console.error(`[VendorRegistration] Cloudinary upload failed for ${file.name}`, error);
      throw error;
    }
  });

  const urls = await Promise.all(uploads);
  debugLog(`Completed Cloudinary upload batch for ${label}`, { uploaded: urls.length });
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
  const { isLoaded: isLocationMapReady, loadError: locationMapError } = useGoogleMapsLoader();
  const [step, setStep] = useState<"vendor" | "spots">("vendor");
  const [state, setState] = useState<RegistrationState>(INITIAL_STATE);
  const [vendorImage, setVendorImage] = useState<FileList | null>(null);
  const [spotDrafts, setSpotDrafts] = useState<SpotDraft[]>([createSpotDraft("spot-0")]);
  const [spotSequence, setSpotSequence] = useState(1);
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [result, setResult] = useState<boolean>(false);
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
    setSpotDrafts((current) => [...current, createSpotDraft(`spot-${spotSequence}`)]);
    setSpotSequence((current) => current + 1);
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
        lat: coords.lat.toFixed(6),
        lng: coords.lng.toFixed(6),
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

  const setSpotCoordinatesFromMap = (spotId: string, lat: number, lng: number) => {
    updateSpot(spotId, {
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    });
    setError("");
  };

  const setSpotCoordinatesFromAddress = async (spotId: string) => {
    const targetSpot = spotDrafts.find((spot) => spot.id === spotId);
    if (!targetSpot) {
      return;
    }

    if (!targetSpot.address.trim()) {
      setError("Enter the spot address first, then use 'Set Pin From Address'.");
      return;
    }

    if (!isLocationMapReady || typeof window === "undefined" || !window.google?.maps) {
      setError("Map is still loading. Try again in a moment.");
      return;
    }

    try {
      const geocoder = new window.google.maps.Geocoder();
      const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ address: targetSpot.address.trim() }, (geocodeResults, status) => {
          if (status !== google.maps.GeocoderStatus.OK || !geocodeResults?.length) {
            reject(new Error("Address not found. Please refine the address or pin on map."));
            return;
          }

          resolve(geocodeResults);
        });
      });

      const topResult = results[0];
      const location = topResult.geometry.location;

      setSpotCoordinatesFromMap(spotId, location.lat(), location.lng());
      updateSpot(spotId, { address: topResult.formatted_address || targetSpot.address });
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Unable to set location from this address.",
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
    setSubmitStatus("Submitting your registration...");
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
          uploadFilesToCloudinary(`vendor-profile/${vendorSlug}`, vendorImage),
          uploadFilesToCloudinary(`vendor-docs/${vendorSlug}`, documents),
          Promise.all(
            spotDrafts.map((spot, index) =>
              uploadFilesToCloudinary(`vendor-spots/${vendorSlug}/${index + 1}`, spot.spotPhotos),
            ),
          ),
        ]),
        120000,
        "Upload is taking too long. Please reduce file size/count and try again.",
      );

      debugLog("Upload stage completed", {
        vendorImages: vendorImageUrls.length,
        documents: documentUrls.length,
        spotImageCounts: allSpotImageUrls.map((images) => images.length),
      });

      const registration = await withTimeout(
        registerVendor({
          vendor: {
            name: state.vendorName,
            email: state.email,
            phone: state.phone,
            profile_image: vendorImageUrls[0] ?? "",
            documents: documentUrls,
            platform_fee_rate: DEFAULT_PLATFORM_FEE_RATE,
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

      setResult(Boolean(registration.vendorId));
      setSubmitStatus("Registration submitted successfully. Pending admin approval.");
      setStep("vendor");
      setState(INITIAL_STATE);
      setVendorImage(null);
      setSpotDrafts([createSpotDraft("spot-0")]);
      setSpotSequence(1);
      setDocuments(null);
    } catch (submitError) {
      console.error("[VendorRegistration] Submit failed", submitError);
      setSubmitStatus("");
      setError("Submission failed. Please try again.");
    } finally {
      debugLog("Submit finished", {
        totalMs: Number((performance.now() - submitStart).toFixed(2)),
      });
      setSubmitting(false);
    }
  };

  return (
    <form className="form-grid vendor-form" onSubmit={handleSubmit}>
      {step === "vendor" ? (
        <Card title="Step 1: Owner Details" subtitle="Basic profile before adding parking spaces.">
          <div className="form-grid vendor-form-panel">
            <div className="vendor-form-grid-2">
              <label className="vendor-form-field">
                <span className="vendor-form-label">Owner or Business Name</span>
                <input
                  className="input"
                  name="vendor_name"
                  placeholder="Ex: Central Mall Parking"
                  value={state.vendorName}
                  onChange={(event) => setState((current) => ({ ...current, vendorName: event.target.value }))}
                />
              </label>

              <label className="vendor-form-field">
                <span className="vendor-form-label">Business Email</span>
                <input
                  className="input"
                  type="email"
                  name="vendor_email"
                  placeholder="Ex: parking@business.com"
                  value={state.email}
                  onChange={(event) => setState((current) => ({ ...current, email: event.target.value }))}
                />
              </label>

              <label className="vendor-form-field">
                <span className="vendor-form-label">Phone Number</span>
                <input
                  className="input"
                  name="vendor_phone"
                  placeholder="Ex: +91 98765 43210"
                  value={state.phone}
                  onChange={(event) => setState((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>

            </div>

            <div className="vendor-upload-block">
              <label className="vendor-form-field">
                <span className="vendor-form-label">Owner Profile Photo</span>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setVendorImage(event.target.files)}
                />
                <span className="vendor-form-helper">Upload one clear photo for profile verification.</span>
              </label>
              <FilePreviewGrid files={vendorImage} emptyText="No profile image selected yet." />
            </div>

            <div className="vendor-upload-block">
              <label className="vendor-form-field">
                <span className="vendor-form-label">Verification Documents</span>
                <input
                  className="input"
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(event) => setDocuments(event.target.files)}
                />
                <span className="vendor-form-helper">
                  Upload up to {MAX_FILES_PER_GROUP} files (images or PDF).
                </span>
              </label>
              <FilePreviewGrid files={documents} emptyText="No verification documents selected yet." />
            </div>
          </div>

          <div className="hero-actions vendor-step-actions">
            <Button type="button" disabled={!canContinueToSpots} onClick={() => setStep("spots")}>
              Continue to Spot Details
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "spots" ? (
        <Card
          title="Step 2: Parking Spot Details"
          subtitle="One owner can register multiple parking spots in one submission."
        >
          <div className="form-grid">
            {spotDrafts.map((spot, index) => {
              const selectedCoordinates = getSpotCoordinates(spot);
              const hasSelectedCoordinates = Boolean(spot.lat.trim()) && Boolean(spot.lng.trim());

              return (
                <Card
                  key={spot.id}
                  title={`Spot ${index + 1}`}
                  subtitle="Image, size, location, amenities, and price"
                  className="vendor-spot-card"
                >
                <div className="form-grid vendor-form-panel">
                  <label className="vendor-form-field">
                    <span className="vendor-form-label">Spot Name</span>
                    <input
                      className="input"
                      name={`spot_name_${spot.id}`}
                      placeholder="Ex: Basement B2 Parking"
                      value={spot.spotName}
                      onChange={(event) => updateSpot(spot.id, { spotName: event.target.value })}
                    />
                  </label>

                  <div className="vendor-upload-block">
                    <label className="vendor-form-field">
                      <span className="vendor-form-label">Spot Photos</span>
                      <input
                        className="input"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(event) => updateSpot(spot.id, { spotPhotos: event.target.files })}
                      />
                      <span className="vendor-form-helper">
                        Upload up to {MAX_FILES_PER_GROUP} images. These will appear in map cards.
                      </span>
                    </label>
                    <FilePreviewGrid files={spot.spotPhotos} emptyText="No spot photos selected yet." />
                  </div>

                  <label className="vendor-form-field">
                    <span className="vendor-form-label">Full Address</span>
                    <input
                      className="input"
                      name={`spot_address_${spot.id}`}
                      placeholder="Ex: Road no. 12, Banjara Hills, Hyderabad"
                      value={spot.address}
                      onChange={(event) => updateSpot(spot.id, { address: event.target.value })}
                    />
                  </label>

                  <div className="vendor-upload-block">
                    <div className="vendor-location-header">
                      <span className="vendor-form-label">Pick Spot Location on Map</span>
                      <span className="vendor-form-helper">
                        Use address pinning, current location, or click map to place marker.
                      </span>
                    </div>

                    <div className="vendor-location-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void setSpotCoordinatesFromAddress(spot.id)}
                        disabled={!spot.address.trim()}
                      >
                        Set Pin From Address
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void fillCurrentLocation(spot.id)}
                      >
                        Use Current Location
                      </Button>
                    </div>

                    {GOOGLE_MAPS_KEY ? (
                      locationMapError ? (
                        <p className="vendor-upload-empty">
                          Map failed to load. Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
                        </p>
                      ) : isLocationMapReady ? (
                        <GoogleMap
                          mapContainerClassName="vendor-location-map"
                          center={selectedCoordinates}
                          zoom={15}
                          onClick={(event) => {
                            const latLng = event.latLng;
                            if (!latLng) {
                              return;
                            }

                            setSpotCoordinatesFromMap(spot.id, latLng.lat(), latLng.lng());
                          }}
                          options={{
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                          }}
                        >
                          <MarkerF
                            position={selectedCoordinates}
                            draggable
                            onDragEnd={(event) => {
                              const latLng = event.latLng;
                              if (!latLng) {
                                return;
                              }

                              setSpotCoordinatesFromMap(spot.id, latLng.lat(), latLng.lng());
                            }}
                          />
                        </GoogleMap>
                      ) : (
                        <div className="vendor-location-map vendor-location-map-loading">
                          Loading map...
                        </div>
                      )
                    ) : (
                      <p className="vendor-upload-empty">
                        Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` to enable map picker.
                      </p>
                    )}

                    <div className="vendor-coordinate-pill-row">
                      <Badge tone={hasSelectedCoordinates ? "success" : "warning"}>
                        {hasSelectedCoordinates
                          ? `Lat: ${spot.lat} | Lng: ${spot.lng}`
                          : "Location not selected yet"}
                      </Badge>
                    </div>
                  </div>

                  <div className="vendor-form-grid-2">
                    <label className="vendor-form-field">
                      <span className="vendor-form-label">Space Size</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        name={`spot_size_value_${spot.id}`}
                        placeholder="Ex: 200"
                        value={spot.sizeValue}
                        onChange={(event) => updateSpot(spot.id, { sizeValue: event.target.value })}
                      />
                    </label>
                    <label className="vendor-form-field">
                      <span className="vendor-form-label">Size Unit</span>
                      <select
                        className="select"
                        name={`spot_size_unit_${spot.id}`}
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
                    </label>
                  </div>

                  <label className="vendor-form-field">
                    <span className="vendor-form-label">Spot Type</span>
                    <select
                      className="select"
                      name={`spot_type_${spot.id}`}
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
                  </label>

                  <div className="vendor-form-grid-2">
                    <label className="vendor-form-field">
                      <span className="vendor-form-label">Flat Rate (Optional)</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        name={`spot_flat_rate_${spot.id}`}
                        placeholder="Ex: 50"
                        value={spot.flatRate}
                        onChange={(event) => updateSpot(spot.id, { flatRate: event.target.value })}
                      />
                    </label>
                    <label className="vendor-form-field">
                      <span className="vendor-form-label">Hourly Rate</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        name={`spot_hourly_rate_${spot.id}`}
                        placeholder="Ex: 80"
                        value={spot.hourlyRate}
                        onChange={(event) => updateSpot(spot.id, { hourlyRate: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="vendor-form-field">
                    <span className="vendor-form-label">Total Parking Slots</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      name={`spot_total_slots_${spot.id}`}
                      placeholder="Ex: 20"
                      value={spot.totalSpots}
                      onChange={(event) => updateSpot(spot.id, { totalSpots: event.target.value })}
                    />
                  </label>

                  <div>
                    <span className="vendor-form-label">Amenities</span>
                    <div className="hero-actions vendor-option-row">
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

                  <div className="vendor-inline-field">
                    <label className="vendor-form-field">
                      <span className="vendor-form-label">Add Custom Amenity</span>
                      <input
                        className="input"
                        name={`spot_other_amenity_${spot.id}`}
                        placeholder="Ex: Covered Entry"
                        value={spot.otherAmenityInput}
                        onChange={(event) =>
                          updateSpot(spot.id, {
                            otherAmenityInput: event.target.value,
                          })
                        }
                      />
                    </label>
                    <Button type="button" variant="secondary" onClick={() => addCustomAmenity(spot.id)}>
                      Add Amenity
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
                    <span className="vendor-form-label">Supported Vehicle Types</span>
                    <div className="hero-actions vendor-option-row">
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
              );
            })}

            <div className="hero-actions">
              <Button type="button" variant="secondary" onClick={addSpot}>
                Add Another Parking Spot
              </Button>
            </div>

            <div className="vendor-form-grid-2">
              <Button type="button" variant="ghost" onClick={() => setStep("vendor")}>
                Back to Owner Details
              </Button>
              <Button type="submit" isLoading={submitting} disabled={!canSubmit}>
                Submit Owner + {spotDrafts.length} Spot(s)
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
          <p className="card-subtitle">Your registration has been sent to admin for approval.</p>
        </Card>
      ) : null}

      {error ? <p className="card-subtitle">{error}</p> : null}
    </form>
  );
}
