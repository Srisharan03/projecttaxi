"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BookingForm, type BookingDraft } from "@/components/booking/BookingForm";
import { QrTicket } from "@/components/booking/QrTicket";
import { SessionTimer } from "@/components/booking/SessionTimer";
import { SpotSummary } from "@/components/booking/SpotSummary";
import { Badge, Button, Card } from "@/components/ui";
import { createSession, getSpotById, type ParkingSpot } from "@/lib/firestore";
import "@/styles/booking.css";

type SpotWithId = ParkingSpot & { id: string };

function getDefaultBookingDraft(): BookingDraft {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return {
    date,
    time,
    durationMinutes: 60,
    vehicleNumber: "",
    vehicleType: "car",
  };
}

function BookingPageContent() {
  const searchParams = useSearchParams();
  const spotId = searchParams.get("spotId");

  const [spot, setSpot] = useState<SpotWithId | null>(null);
  const [draft, setDraft] = useState<BookingDraft>(getDefaultBookingDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [qrPayload, setQrPayload] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);

  useEffect(() => {
    if (!spotId) {
      return;
    }

    void getSpotById(spotId)
      .then((result) => {
        setSpot(result);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load spot.");
      });
  }, [spotId]);

  const estimatedAmount = useMemo(() => {
    if (!spot) {
      return 0;
    }

    const hourly = spot.pricing.hourly_rate * (draft.durationMinutes / 60);
    return spot.pricing.flat_rate + hourly;
  }, [spot, draft.durationMinutes]);

  const handleCreateSession = async () => {
    if (!spot || !spotId) {
      setError("Select a spot from the map before booking.");
      return;
    }

    if (!draft.vehicleNumber.trim()) {
      setError("Enter vehicle number.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const newSessionId = await createSession({
        user_id: "demo-user",
        spot_id: spotId,
        vehicle_number: draft.vehicleNumber,
        vehicle_type: draft.vehicleType,
        duration_minutes: draft.durationMinutes,
        amount: Number(estimatedAmount.toFixed(2)),
        platform_fee: 0,
        payment_method: "upi",
        payment_status: "pending",
        status: "booked",
        qr_code_data: "",
        check_in_location: null,
        rating: null,
      });

      const payload = JSON.stringify({
        sessionId: newSessionId,
        spotId,
        action: "check_in",
      });

      setSessionId(newSessionId);
      setQrPayload(payload);
      setExpiresAt(Date.now() + 10 * 60 * 1000);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create session.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-page shell">
      <section className="section">
        <Card title="Booking & QR Pass" subtitle="Reserve a spot and scan when you arrive.">
          <div className="hero-actions">
            <Badge tone="info">Session state: {sessionId ? "booked" : "draft"}</Badge>
            {sessionId ? <Badge tone="success">Session ID: {sessionId}</Badge> : null}
          </div>
        </Card>
      </section>

      <section className="booking-grid">
        <div className="form-grid">
          {spot ? <SpotSummary spot={spot} /> : <Card title="Spot"><p className="card-subtitle">Load a spot from map booking CTA.</p></Card>}

          <BookingForm
            value={draft}
            amount={estimatedAmount}
            onChange={setDraft}
            onSubmit={handleCreateSession}
            disabled={!spot || spot.status !== "open"}
            loading={submitting}
          />

          {error ? <p className="card-subtitle">{error}</p> : null}
        </div>

        <div className="form-grid">
          {qrPayload ? (
            <>
              <QrTicket payload={qrPayload} />
              <Card title="Validation Window">
                <SessionTimer expiresAt={expiresAt} />
                <div className="hero-actions" style={{ marginTop: "0.8rem" }}>
                  <Link href={`/payment?sessionId=${sessionId}`}>
                    <Button>Proceed to Payment</Button>
                  </Link>
                  <Link href="/scan">
                    <Button variant="secondary">Open Scanner</Button>
                  </Link>
                </div>
              </Card>
            </>
          ) : (
            <Card title="QR Pass Pending">
              <p className="card-subtitle">Create a booking first to generate your QR entry pass.</p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="booking-page shell">
          <section className="section">
            <Card title="Booking">
              <p className="card-subtitle">Loading booking context...</p>
            </Card>
          </section>
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
