"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BookingForm, type BookingDraft } from "@/components/booking/BookingForm";
import { SessionTimer } from "@/components/booking/SessionTimer";
import { SpotSummary } from "@/components/booking/SpotSummary";
import { Badge, Button, Card, Modal } from "@/components/ui";
import {
  createSession,
  generateSessionOtp,
  getSpotById,
  subscribeToUserSessions,
  type OtpAction,
  type ParkingSpot,
  type Session,
} from "@/lib/firestore";
import "@/styles/booking.css";

type SpotWithId = ParkingSpot & { id: string };
type SessionWithId = Session & { id: string };
type BookingViewFilter = "active" | "history" | "all";

const DEMO_USER_ID = "demo-user";

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultBookingDraft(): BookingDraft {
  const now = new Date();
  const date = getLocalDateString(now);
  const startHours = now.getHours().toString().padStart(2, "0");
  const startMinutes = now.getMinutes().toString().padStart(2, "0");

  const end = new Date(now.getTime() + 60 * 60 * 1000);
  const endHours = end.getHours().toString().padStart(2, "0");
  const endMinutes = end.getMinutes().toString().padStart(2, "0");

  return {
    date,
    startTime: `${startHours}:${startMinutes}`,
    endTime: `${endHours}:${endMinutes}`,
    vehicleNumber: "",
    vehicleType: "car",
  };
}

function buildDateTime(date: string, time: string): Date | null {
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

function formatSessionTime(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  return "Not available";
}

function isActiveSession(session: SessionWithId): boolean {
  return session.status === "booked" || session.status === "checked_in";
}

function BookingPageContent() {
  const searchParams = useSearchParams();
  const spotIdFromQuery = searchParams.get("spotId");
  const openInRequestMode = Boolean(spotIdFromQuery);

  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [viewFilter, setViewFilter] = useState<BookingViewFilter>("active");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(openInRequestMode);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(openInRequestMode);

  const [spot, setSpot] = useState<SpotWithId | null>(null);
  const [draft, setDraft] = useState<BookingDraft>(() => getDefaultBookingDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpAction, setOtpAction] = useState<OtpAction>("check_in");

  useEffect(() => {
    return subscribeToUserSessions(
      DEMO_USER_ID,
      (rows) => {
        setSessions(rows);
        setSelectedSessionId((current) => {
          if (!rows.length) {
            setIsCreatingNew(true);
            return null;
          }

          if (isCreatingNew) {
            return current;
          }

          if (current && rows.some((session) => session.id === current)) {
            return current;
          }

          const nextSelected = rows.find((session) => isActiveSession(session)) ?? rows[0];
          setIsCreatingNew(false);
          return nextSelected.id;
        });
      },
      (subscriptionError) => {
        setError(subscriptionError.message || "Failed to load your bookings.");
      },
    );
  }, [isCreatingNew]);

  useEffect(() => {
    if (!isCreatingNew || !spotIdFromQuery) {
      return;
    }

    void getSpotById(spotIdFromQuery)
      .then((result) => {
        setSpot(result);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load spot.");
      });
  }, [isCreatingNew, spotIdFromQuery]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  useEffect(() => {
    if (!selectedSession || isCreatingNew) {
      return;
    }

    void getSpotById(selectedSession.spot_id).then((result) => {
      setSpot(result);
    });
  }, [selectedSession, isCreatingNew]);

  const bookingTiming = useMemo(() => {
    const start = buildDateTime(draft.date, draft.startTime);
    const end = buildDateTime(draft.date, draft.endTime);

    if (!start || !end) {
      return { valid: false, durationMinutes: 0, start: null, end: null };
    }

    const duration = Math.ceil((end.getTime() - start.getTime()) / (60 * 1000));
    if (duration <= 0) {
      return { valid: false, durationMinutes: 0, start, end };
    }

    return { valid: true, durationMinutes: duration, start, end };
  }, [draft.date, draft.startTime, draft.endTime]);

  const estimatedAmount = useMemo(() => {
    if (!spot || !bookingTiming.valid) {
      return 0;
    }

    const bookedHours = bookingTiming.durationMinutes / 60;
    const hourlyAmount = spot.pricing.hourly_rate * bookedHours;
    return Number(Math.max(spot.pricing.flat_rate, hourlyAmount).toFixed(2));
  }, [spot, bookingTiming]);

  const filteredSessions = useMemo(() => {
    if (viewFilter === "all") {
      return sessions;
    }

    if (viewFilter === "active") {
      return sessions.filter((session) => isActiveSession(session));
    }

    return sessions.filter((session) => !isActiveSession(session));
  }, [sessions, viewFilter]);

  const sessionStatus = selectedSession?.status ?? "booked";
  const sessionApprovalStatus = selectedSession?.approval_status ?? "pending";
  const bookingCode = selectedSession?.access_code ?? "";
  const sessionAmount = Number((selectedSession?.amount || 0).toFixed(2));
  const sessionExtraAmount = Number((selectedSession?.extra_amount || 0).toFixed(2));
  const amountPayable = sessionAmount;
  const cancellationReason =
    (selectedSession?.cancellation_reason as "vendor_rejected" | "slot_expired" | undefined) ?? "";
  const checkInTimeLabel = selectedSession?.check_in_time
    ? formatSessionTime(selectedSession.check_in_time)
    : "";
  const checkOutTimeLabel = selectedSession?.check_out_time
    ? formatSessionTime(selectedSession.check_out_time)
    : "";

  const handleGenerateOtp = async (action: OtpAction) => {
    if (!selectedSessionId) {
      setError("Select an active booking first.");
      setSuccessMessage("");
      return;
    }

    try {
      const { code, expiresAtMs } = await generateSessionOtp(selectedSessionId, action);
      setOtpAction(action);
      setOtpCode(code);
      setOtpExpiresAt(expiresAtMs);
      setError("");
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : "Unable to generate OTP.");
      setSuccessMessage("");
    }
  };

  const handleCreateSession = async () => {
    if (!spot || !spot.id) {
      setError("Select a spot from the map before booking.");
      setSuccessMessage("");
      return;
    }

    if (spot.vendor_id === "google-public") {
      setError("Public spots are navigation-only. Booking is available only for vendor spots.");
      setSuccessMessage("");
      return;
    }

    if (!draft.vehicleNumber.trim()) {
      setError("Enter vehicle number.");
      setSuccessMessage("");
      return;
    }

    if (!bookingTiming.valid || !bookingTiming.start || !bookingTiming.end) {
      setError("Please enter a valid start and end time.");
      setSuccessMessage("");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const newSessionId = await createSession({
        user_id: DEMO_USER_ID,
        spot_id: spot.id,
        vehicle_number: draft.vehicleNumber,
        vehicle_type: draft.vehicleType,
        duration_minutes: bookingTiming.durationMinutes,
        amount: estimatedAmount,
        payment_method: "upi",
        payment_status: "pending",
        start_time_iso: bookingTiming.start.toISOString(),
        end_time_iso: bookingTiming.end.toISOString(),
        start_time_ms: bookingTiming.start.getTime(),
        end_time_ms: bookingTiming.end.getTime(),
        qr_code_data: JSON.stringify({
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
        }),
      });

      setSelectedSessionId(newSessionId);
      setIsCreatingNew(false);
      setOtpCode("");
      setOtpExpiresAt(0);
      setSuccessMessage("Booking request sent successfully. Waiting for vendor approval.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create session.");
      setSuccessMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  const isAccepted = sessionApprovalStatus === "accepted";
  const isRejected = sessionApprovalStatus === "rejected";
  const canGenerateEntryOtp =
    Boolean(selectedSessionId) && isAccepted && !isRejected && sessionStatus === "booked";
  const canGenerateExitOtp =
    Boolean(selectedSessionId) && isAccepted && !isRejected && sessionStatus === "checked_in";
  const shouldShowActiveOtp =
    Boolean(otpCode) &&
    ((otpAction === "check_in" && sessionStatus === "booked") ||
      (otpAction === "check_out" && sessionStatus === "checked_in"));

  return (
    <div className="booking-page shell">
      <section className="section">
        <Card title="My Bookings" subtitle="View active and history bookings.">
          <div className="hero-actions">
            <Badge tone="info">Total: {sessions.length}</Badge>
            <Badge tone="success">Active: {sessions.filter((session) => isActiveSession(session)).length}</Badge>
            <Badge tone="neutral">History: {sessions.filter((session) => !isActiveSession(session)).length}</Badge>
            <Button
              variant={viewFilter === "active" ? "primary" : "secondary"}
              onClick={() => setViewFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={viewFilter === "history" ? "primary" : "secondary"}
              onClick={() => setViewFilter("history")}
            >
              History
            </Button>
            <Button
              variant={viewFilter === "all" ? "primary" : "secondary"}
              onClick={() => setViewFilter("all")}
            >
              All
            </Button>
          </div>

          {filteredSessions.length ? (
            <div className="form-grid" style={{ marginTop: "0.8rem" }}>
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="glass-card"
                  style={{
                    textAlign: "left",
                    padding: "0.8rem",
                    border: selectedSessionId === session.id ? "2px solid #1d4ed8" : "1px solid #dbe2f1",
                    borderRadius: "12px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setIsCreatingNew(false);
                    setSelectedSessionId(session.id);
                    setIsBookingModalOpen(true);
                    setSuccessMessage("");
                    setError("");
                  }}
                >
                  <div className="hero-actions">
                    <Badge tone={isActiveSession(session) ? "success" : "neutral"}>{session.status}</Badge>
                    <Badge tone="info">Code: {session.access_code}</Badge>
                    <Badge tone="warning">Rs {Math.round(session.amount || 0)}</Badge>
                  </div>
                  <p className="card-subtitle" style={{ marginTop: "0.45rem" }}>
                    {new Date(session.start_time_iso).toLocaleString()} to {new Date(session.end_time_iso).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="card-subtitle" style={{ marginTop: "0.8rem" }}>
              No bookings in this view.
            </p>
          )}
        </Card>
      </section>

      <Modal
        open={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title={isCreatingNew ? "Create Booking Request" : "Booking Details"}
        description={isCreatingNew ? "Send booking request to vendor." : "Manage OTP and track booking status."}
        className="booking-detail-modal"
      >
        <div className="booking-modal-grid">
          <div className="form-grid">
            {spot ? (
              <SpotSummary spot={spot} />
            ) : (
              <Card title="Spot">
                <p className="card-subtitle">Select an existing booking or create a new booking from map.</p>
              </Card>
            )}

            {isCreatingNew ? (
              <BookingForm
                value={draft}
                amount={estimatedAmount}
                onChange={setDraft}
                onSubmit={handleCreateSession}
                disabled={!spot || spot.status !== "open" || spot.vendor_id === "google-public"}
                loading={submitting}
              />
            ) : (
              <Card title="Booking Details" subtitle="Viewing selected booking.">
                <div className="form-grid">
                  <div className="toggle-row">
                    <span>Booking Code</span>
                    <strong>{bookingCode || "-"}</strong>
                  </div>
                  <div className="toggle-row">
                    <span>Status</span>
                    <strong>{sessionStatus}</strong>
                  </div>
                  <div className="toggle-row">
                    <span>Approval</span>
                    <strong>{sessionApprovalStatus}</strong>
                  </div>
                  {selectedSession ? (
                    <div className="toggle-row">
                      <span>Scheduled Slot</span>
                      <strong>
                        {new Date(selectedSession.start_time_iso).toLocaleString()} to{" "}
                        {new Date(selectedSession.end_time_iso).toLocaleString()}
                      </strong>
                    </div>
                  ) : null}
                </div>
              </Card>
            )}

            {successMessage ? (
              <p className="card-subtitle" style={{ color: "#0f766e" }}>
                {successMessage}
              </p>
            ) : null}
            {error ? <p className="card-subtitle">{error}</p> : null}
          </div>

          <div className="form-grid">
            {!isCreatingNew ? (
              <Card title="Live Booking Updates" subtitle="Real-time status from vendor actions and OTP verification.">
                <div className="form-grid">
                  <div className="toggle-row">
                    <span>Start Time</span>
                    <strong>{checkInTimeLabel || "Waiting for entry OTP verification"}</strong>
                  </div>
                  <div className="toggle-row">
                    <span>End Time</span>
                    <strong>{checkOutTimeLabel || "Waiting for exit OTP verification"}</strong>
                  </div>
                  {sessionStatus === "checked_out" ? (
                    <>
                      <div className="toggle-row">
                        <span>Final Amount</span>
                        <strong>Rs {Math.round(sessionAmount || 0)}</strong>
                      </div>
                      <div className="toggle-row">
                        <span>Amount Payable</span>
                        <strong>Rs {Math.round(amountPayable || 0)}</strong>
                      </div>
                      <div className="toggle-row">
                        <span>Extra Amount</span>
                        <strong>Rs {Math.round(sessionExtraAmount || 0)}</strong>
                      </div>
                    </>
                  ) : null}
                </div>
              </Card>
            ) : (
              <Card title="Request Status" subtitle="Send request and wait for vendor approval.">
                <p className="card-subtitle">
                  Once request is sent, this booking will move to your active list with status pending/accepted.
                </p>
              </Card>
            )}

            {shouldShowActiveOtp ? (
              <Card title="Active OTP">
                <div className="form-grid">
                  <Badge tone="info">OTP Action: {otpAction === "check_in" ? "Entry" : "Exit"}</Badge>
                  <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p className="card-subtitle">Share this OTP with vendor</p>
                    <p style={{ fontSize: "2rem", letterSpacing: "0.45rem", fontWeight: 700, margin: 0 }}>
                      {otpCode}
                    </p>
                    {bookingCode ? (
                      <p className="card-subtitle" style={{ marginTop: "0.6rem" }}>
                        Booking Code: <strong>{bookingCode}</strong>
                      </p>
                    ) : null}
                  </div>
                  <Card title="Validation Window">
                    <SessionTimer expiresAt={otpExpiresAt} />
                  </Card>
                </div>
              </Card>
            ) : (
              <Card title={sessionStatus === "checked_out" ? "Booking Completed" : "OTP Actions"}>
                {!selectedSessionId ? (
                  <p className="card-subtitle">Select an active booking to continue OTP flow.</p>
                ) : isRejected ? (
                  <p className="card-subtitle">
                    {cancellationReason === "slot_expired"
                      ? "Your booking was cancelled because the time slot passed. Please choose another time and rebook."
                      : "Your booking request was rejected by vendor. Please choose another time and rebook."}
                  </p>
                ) : canGenerateEntryOtp ? (
                  <div className="form-grid">
                    <p className="card-subtitle">Request approved. Generate entry OTP now.</p>
                    <Button onClick={() => void handleGenerateOtp("check_in")}>Generate Entry OTP</Button>
                  </div>
                ) : canGenerateExitOtp ? (
                  <div className="form-grid">
                    <p className="card-subtitle">Entry verified. Generate exit OTP when leaving.</p>
                    <Button onClick={() => void handleGenerateOtp("check_out")}>Generate Exit OTP</Button>
                  </div>
                ) : sessionStatus === "checked_out" ? (
                  <p className="card-subtitle">
                    Booking completed. Amount payable: Rs {Math.round(amountPayable || 0)}.
                  </p>
                ) : (
                  <p className="card-subtitle">
                    Waiting for vendor acceptance. You can switch bookings from My Bookings above.
                  </p>
                )}

                <div className="hero-actions" style={{ marginTop: "0.8rem" }}>
                  <Link href="/scan">
                    <Button variant="ghost">Open Vendor OTP Verify</Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Modal>
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
