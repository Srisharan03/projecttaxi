"use client";

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

export function ReportPublicSpotModal({ open, onClose, userId }: ReportPublicSpotModalProps) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [tag, setTag] = useState("Community Public Spot");
  const [busy, setBusy] = useState(false);
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
    if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) {
      setError("Enter valid latitude and longitude.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await reportCommunitySpot({
        user_id: userId,
        location: { lat: latNumber, lng: lngNumber },
        tag,
      });

      setMessage(
        result.isVerified
          ? `Report submitted. Spot verified with ${result.reportCount} unique reports.`
          : `Report submitted. Pending verification (${result.reportCount}/7 reports).`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit report.");
    } finally {
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
            <Button onClick={() => void submit()} isLoading={busy}>
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
