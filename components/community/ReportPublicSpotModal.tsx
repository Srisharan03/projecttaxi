"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { getCurrentPosition } from "@/lib/geofence";
import { reportCommunitySpot } from "@/lib/firestore";
import "@/styles/community.css";

interface ReportPublicSpotModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

async function uploadReportImage(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Image upload is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "community-reports");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Image upload failed. Please try another image.");
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error("Image upload failed to return URL.");
  }

  return payload.secure_url;
}

export function ReportPublicSpotModal({ open, onClose, userId }: ReportPublicSpotModalProps) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [tag, setTag] = useState("Community Public Spot");
  const [estimatedYards, setEstimatedYards] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    void getCurrentPosition()
      .then((coords) => {
        setLat(coords.lat.toFixed(6));
        setLng(coords.lng.toFixed(6));
        setGpsReady(true);
      })
      .catch(() => {
        // User can still type coordinates manually.
        setGpsReady(false);
      });
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const fillCurrentLocation = async () => {
    setError("");
    setMessage("");
    try {
      const coords = await getCurrentPosition();
      setLat(coords.lat.toFixed(6));
      setLng(coords.lng.toFixed(6));
      setGpsReady(true);
    } catch (locationError) {
      setGpsReady(false);
      setError(locationError instanceof Error ? locationError.message : "Failed to fetch location.");
    }
  };

  const submit = async () => {
    const latNumber = Number(lat);
    const lngNumber = Number(lng);
    const yardsNumber = Number(estimatedYards);
    if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) {
      setError("Enter valid latitude and longitude.");
      return;
    }
    if (estimatedYards.trim() && (Number.isNaN(yardsNumber) || yardsNumber <= 0)) {
      setError("Estimated yards must be a positive number.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      let reportImageUrl = uploadedImageUrl;
      if (imageFile && !uploadedImageUrl) {
        setUploadingImage(true);
        reportImageUrl = await uploadReportImage(imageFile);
        setUploadedImageUrl(reportImageUrl);
      }

      const result = await reportCommunitySpot({
        user_id: userId,
        location: { lat: latNumber, lng: lngNumber },
        tag,
        estimated_yards: estimatedYards.trim() ? yardsNumber : undefined,
        report_image_url: reportImageUrl || undefined,
      });

      setMessage(
        result.isVerified
          ? `Report submitted. Spot verified with ${result.reportCount} unique reports.`
          : `Report submitted. Pending verification (${result.reportCount}/7 reports).`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit report.");
    } finally {
      setUploadingImage(false);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report Public Spot"
      description="Submit your current GPS location for community public-spot verification."
      className="community-report-modal"
    >
      <div className="community-report-wrap">
        <div className="community-report-banner">
          <p className="community-report-banner-title">Community verification activates at 7 unique reports</p>
          <div className="community-report-badges">
            <span className="community-chip">Cluster Radius: 20m</span>
            <span className={`community-chip ${gpsReady ? "community-chip-success" : "community-chip-muted"}`}>
              GPS: {gpsReady ? "Ready" : "Manual"}
            </span>
          </div>
        </div>

        <div className="form-grid">
          <label>
            <span className="card-subtitle">Public Spot Tag</span>
            <input
              className="input"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Community Public Spot"
            />
          </label>

          <label>
            <span className="card-subtitle">Yards (estimated)</span>
            <input
              className="input"
              type="number"
              min="1"
              step="0.5"
              value={estimatedYards}
              onChange={(event) => setEstimatedYards(event.target.value)}
              placeholder="120"
            />
          </label>

          <label>
            <span className="card-subtitle">Upload or Take Image</span>
            <input
              className="input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setImageFile(file);
                setUploadedImageUrl("");
                setMessage("");
                setError("");

                if (!file) {
                  setImagePreviewUrl("");
                  return;
                }

                const objectUrl = URL.createObjectURL(file);
                setImagePreviewUrl(objectUrl);
              }}
            />
            {imagePreviewUrl ? (
              <Image
                src={imagePreviewUrl}
                alt="Public spot preview"
                width={720}
                height={360}
                unoptimized
                className="community-report-preview"
              />
            ) : null}
          </label>

          <div className="community-coords-grid">
            <label>
              <span className="card-subtitle">Latitude</span>
              <input
                className="input"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                placeholder="17.385000"
              />
            </label>
            <label>
              <span className="card-subtitle">Longitude</span>
              <input
                className="input"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                placeholder="78.486700"
              />
            </label>
          </div>

          <div className="community-report-actions">
            <Button variant="secondary" onClick={() => void fillCurrentLocation()}>
              Refresh GPS
            </Button>
            <Button onClick={() => void submit()} isLoading={busy || uploadingImage}>
              Submit Community Report
            </Button>
          </div>

          {message ? <p className="community-status community-status-success">{message}</p> : null}
          {error ? <p className="community-status community-status-error">{error}</p> : null}
        </div>
      </div>
    </Modal>
  );
}
