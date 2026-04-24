"use client";

import { useState } from "react";
import { GeofenceValidator } from "@/components/scan/GeofenceValidator";
import { QRScanner } from "@/components/scan/QRScanner";
import { ScanResultCard } from "@/components/scan/ScanResultCard";
import { Badge, Button, Card } from "@/components/ui";
import {
  calculatePlatformFee,
  checkIn,
  checkOut,
  getSessionById,
  getSpotById,
  getVendorById,
  rateSession,
} from "@/lib/firestore";
import { getCurrentPosition, getDistanceMeters, validateLocation } from "@/lib/geofence";
import "@/styles/scan.css";

interface QrPayload {
  sessionId: string;
  spotId: string;
  action?: "check_in" | "check_out";
}

export default function ScanPage() {
  const [payloadText, setPayloadText] = useState("");
  const [manualPayload, setManualPayload] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [processing, setProcessing] = useState(false);

  const processPayload = async (rawPayload: string) => {
    if (processing) {
      return;
    }

    setProcessing(true);
    setStatus("idle");
    setMessage("");

    try {
      const parsed = JSON.parse(rawPayload) as QrPayload;
      if (!parsed.sessionId || !parsed.spotId) {
        throw new Error("Invalid QR payload.");
      }

      const [session, spot] = await Promise.all([
        getSessionById(parsed.sessionId),
        getSpotById(parsed.spotId),
      ]);

      if (!session || !spot) {
        throw new Error("Session or spot not found.");
      }

      const currentLocation = await getCurrentPosition();
      const distance = getDistanceMeters(currentLocation, spot.location);
      setDistanceMeters(distance);

      if (!validateLocation(currentLocation, spot.location, 20)) {
        throw new Error("You must be within 20m of the parking spot.");
      }

      const inferredAction =
        session.status === "checked_in"
          ? "check_out"
          : session.status === "checked_out"
            ? "check_out"
            : parsed.action || "check_in";

      if (inferredAction === "check_in") {
        await checkIn(parsed.sessionId, parsed.spotId, currentLocation);
        setStatus("success");
        setMessage("Checked in successfully. Occupancy updated in real-time.");
      } else {
        const vendor = await getVendorById(spot.vendor_id);
        const platformFee = calculatePlatformFee(session.amount || 0, vendor?.platform_fee_rate ?? 0.15);

        await checkOut(parsed.sessionId, parsed.spotId, session.amount || 0, platformFee);
        if (rating > 0) {
          await rateSession(parsed.sessionId, rating);
        }

        setStatus("success");
        setMessage(
          `Checked out successfully. Platform fee: Rs ${platformFee.toFixed(0)}. Thanks for rating!`,
        );
      }
    } catch (scanError) {
      setStatus("error");
      setMessage(scanError instanceof Error ? scanError.message : "Scan flow failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="scan-page shell">
      <section className="section">
        <Card title="QR Scan" subtitle="Geofence-protected check-in and check-out.">
          <div className="hero-actions">
            <Badge tone="info">Radius lock: 20m</Badge>
            <Badge tone="warning">Occupancy updates on successful scan</Badge>
          </div>
        </Card>
      </section>

      <section className="scan-grid">
        <Card title="Camera Scanner">
          <QRScanner
            onScan={(decoded) => {
              setPayloadText(decoded);
              void processPayload(decoded);
            }}
          />
        </Card>

        <Card title="Manual Payload" subtitle="Use for testing without camera scan.">
          <div className="form-grid">
            <textarea
              className="textarea"
              rows={6}
              placeholder='{"sessionId":"...","spotId":"...","action":"check_in"}'
              value={manualPayload}
              onChange={(event) => setManualPayload(event.target.value)}
            />
            <label>
              <span className="card-subtitle">Rating after checkout</span>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(event) => setRating(Number(event.target.value) || 5)}
              />
            </label>
            <Button onClick={() => void processPayload(manualPayload)} isLoading={processing}>
              Process Payload
            </Button>
          </div>
        </Card>

        <ScanResultCard status={status} message={message} />

        <GeofenceValidator distanceMeters={distanceMeters} />

        <Card title="Last Payload">
          <p className="card-subtitle">{payloadText || "No scans yet."}</p>
        </Card>
      </section>
    </div>
  );
}
