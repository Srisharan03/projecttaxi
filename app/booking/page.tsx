"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BookingForm, type BookingDraft } from "@/components/booking/BookingForm";
import { SessionTimer } from "@/components/booking/SessionTimer";
import { SpotSummary } from "@/components/booking/SpotSummary";
import { Badge, Button, Card, Modal } from "@/components/ui";
import {
  createSession,
  extendSession,
  generateSessionOtp,
  previewSessionExtension,
  getSpots,
  getSpotById,
  subscribeToUserSessions,
  type OtpAction,
  type ParkingSpot,
  type Session,
  type SessionExtensionPreview,
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

function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours > 0 && rem > 0) {
    return `${hours}h ${rem}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${rem}m`;
}

function isActiveSession(session: SessionWithId): boolean {
  return session.status === "booked" || session.status === "checked_in";
}

function getShortLocationName(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = parts[1] || parts[0] || "Unknown";
  return candidate.length > 28 ? `${candidate.slice(0, 28)}...` : candidate;
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
  const [extendMinutes, setExtendMinutes] = useState(30);
  const [extensionPreview, setExtensionPreview] = useState<SessionExtensionPreview | null>(null);
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionError, setExtensionError] = useState("");
  const [extensionSuccess, setExtensionSuccess] = useState("");
  const [showExpiryReminder, setShowExpiryReminder] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [spotMapById, setSpotMapById] = useState<Record<string, SpotWithId>>({});

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
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    void getSpots()
      .then((rows) => {
        if (cancelled) {
          return;
        }
        const next = rows.reduce<Record<string, SpotWithId>>((acc, row) => {
          acc[row.id] = row;
          return acc;
        }, {});
        setSpotMapById(next);
      })
      .catch(() => {
        // Keep booking list usable even if spot lookup fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (!selectedSession || selectedSession.status !== "checked_in") {
      return;
    }

    const now = Date.now();
    const triggerAtMs = selectedSession.end_time_ms - 10 * 60 * 1000;
    const delay = Math.max(0, triggerAtMs - now);
    const reminderKey = `expiry-reminder-${selectedSession.id}`;

    const notify = () => {
      setShowExpiryReminder(true);

      if (typeof window === "undefined") {
        return;
      }

      const alreadyNotified = window.localStorage.getItem(reminderKey) === "1";
      if (alreadyNotified) {
        return;
      }

      window.localStorage.setItem(reminderKey, "1");

      if (!("Notification" in window)) {
        return;
      }

      const dispatchNotification = () => {
        try {
          new Notification("Parking session ending soon", {
            body: "Your booking ends in about 10 minutes. Extend now if needed.",
          });
        } catch {
          // Keep in-app reminder active even if browser notification fails.
        }
      };

      if (Notification.permission === "granted") {
        dispatchNotification();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === "granted") {
              dispatchNotification();
            }
          })
          .catch(() => {
            // Non-blocking: in-app reminder already shown.
          });
      }
    };

    const timeoutId = window.setTimeout(() => {
      notify();
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedSession]);

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
  const activeSessionsCount = sessions.filter((session) => isActiveSession(session)).length;
  const historySessionsCount = sessions.length - activeSessionsCount;

  const sessionStatus = selectedSession?.status ?? "booked";
  const sessionApprovalStatus = selectedSession?.approval_status ?? "pending";
  const isAccepted = sessionApprovalStatus === "accepted";
  const isRejected = sessionApprovalStatus === "rejected";
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
  const sessionEndMs = selectedSession?.end_time_ms ?? 0;
  const minutesToExpiry =
    selectedSession && sessionEndMs > 0 ? Math.ceil((sessionEndMs - currentTimeMs) / (60 * 1000)) : null;
  const canExtendSession =
    Boolean(selectedSessionId) &&
    isAccepted &&
    !isRejected &&
    sessionStatus === "checked_in" &&
    (minutesToExpiry === null || minutesToExpiry > 0);
  const showActiveExpiryReminder = showExpiryReminder && sessionStatus === "checked_in";

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
      setError("Public spots are navigation-only. Booking is available only for owner spots.");
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
      setExtensionPreview(null);
      setExtensionError("");
      setExtensionSuccess("");
      setShowExpiryReminder(false);
      setSuccessMessage("Booking request sent successfully. Waiting for owner approval.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create session.");
      setSuccessMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewExtension = async () => {
    if (!selectedSessionId || !selectedSession) {
      setExtensionError("Select an active session first.");
      return;
    }

    const requestedEndMs = selectedSession.end_time_ms + extendMinutes * 60 * 1000;
    if (requestedEndMs <= selectedSession.end_time_ms) {
      setExtensionError("Choose a valid extension duration.");
      return;
    }

    setExtensionBusy(true);
    setExtensionError("");
    setExtensionSuccess("");

    try {
      const preview = await previewSessionExtension(selectedSessionId, requestedEndMs);
      setExtensionPreview(preview);
      if (!preview.possible) {
        setExtensionError(preview.note);
      }
    } catch (previewError) {
      setExtensionPreview(null);
      setExtensionError(
        previewError instanceof Error ? previewError.message : "Unable to preview extension.",
      );
    } finally {
      setExtensionBusy(false);
    }
  };

  const handleApplyExtension = async () => {
    if (!selectedSessionId || !selectedSession) {
      setExtensionError("Select an active session first.");
      return;
    }

    const requestedEndMs = selectedSession.end_time_ms + extendMinutes * 60 * 1000;
    if (requestedEndMs <= selectedSession.end_time_ms) {
      setExtensionError("Choose a valid extension duration.");
      return;
    }

    setExtensionBusy(true);
    setExtensionError("");
    setExtensionSuccess("");

    try {
      const applied = await extendSession(selectedSessionId, requestedEndMs);
      setExtensionPreview(applied);

      if (applied.allowedEndMs < applied.requestedEndMs) {
        setExtensionSuccess(
          `Partially extended until ${new Date(applied.allowedEndMs).toLocaleTimeString()}. Extra charge: Rs ${Math.round(applied.allowedExtraAmount)}.`,
        );
      } else {
        setExtensionSuccess(
          `Booking extended successfully. Extra charge: Rs ${Math.round(applied.allowedExtraAmount)}.`,
        );
      }
      setShowExpiryReminder(false);
    } catch (extendError) {
      setExtensionError(extendError instanceof Error ? extendError.message : "Unable to extend booking.");
    } finally {
      setExtensionBusy(false);
    }
  };

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
          <div className="booking-toolbar">
            <div className="booking-metric-row">
              <Badge tone="info">Total: {sessions.length}</Badge>
              <Badge tone="success">Active: {activeSessionsCount}</Badge>
              <Badge tone="neutral">History: {historySessionsCount}</Badge>
            </div>
            <div className="booking-filter-row">
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
          </div>

          {filteredSessions.length ? (
            <div className="booking-list-grid">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`booking-session-card ${selectedSessionId === session.id ? "booking-session-card-active" : ""}`}
                  onClick={() => {
                    setIsCreatingNew(false);
                    setSelectedSessionId(session.id);
                    setIsBookingModalOpen(true);
                    setSuccessMessage("");
                    setError("");
                    setExtensionPreview(null);
                    setExtensionError("");
                    setExtensionSuccess("");
                    setShowExpiryReminder(false);
                  }}
                >
                  <div className="booking-session-top">
                    <Badge tone={isActiveSession(session) ? "success" : "neutral"}>{session.status}</Badge>
                    <Badge tone="info">Code: {session.access_code}</Badge>
                    <Badge tone="warning">Rs {Math.round(session.amount || 0)}</Badge>
                  </div>
                  <div className="booking-session-meta">
                    <p className="card-subtitle">
                      Location:{" "}
                      <strong>
                        {spotMapById[session.spot_id]
                          ? getShortLocationName(spotMapById[session.spot_id].address)
                        : "Loading..."}
                      </strong>
                    </p>
                    <p className="card-subtitle">
                      Park Start:{" "}
                      <strong>
                        {session.check_in_time
                          ? formatSessionTime(session.check_in_time)
                        : new Date(session.start_time_iso).toLocaleString()}
                      </strong>
                    </p>
                    <p className="card-subtitle">
                      Exit:{" "}
                      <strong>
                        {session.check_out_time
                          ? formatSessionTime(session.check_out_time)
                          : new Date(session.end_time_iso).toLocaleString()}
                      </strong>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="card-subtitle booking-empty-note">
              No bookings in this view.
            </p>
          )}
        </Card>
      </section>

      <Modal
        open={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title={isCreatingNew ? "Create Booking Request" : "Booking Details"}
        description={isCreatingNew ? "Send booking request to owner." : "Manage OTP and track booking status."}
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
              <p className="card-subtitle booking-inline-note booking-inline-note-success">
                {successMessage}
              </p>
            ) : null}
            {error ? <p className="card-subtitle">{error}</p> : null}
          </div>

          <div className="form-grid">
            {!isCreatingNew ? (
              <Card title="Live Booking Updates" subtitle="Real-time status from owner actions and OTP verification.">
                <div className="booking-status-panel">
                  <div className="booking-status-chip-row">
                    <Badge tone={sessionStatus === "checked_in" ? "success" : "info"}>
                      Session: {sessionStatus}
                    </Badge>
                    <Badge
                      tone={
                        sessionApprovalStatus === "accepted"
                          ? "success"
                          : sessionApprovalStatus === "rejected"
                            ? "danger"
                            : "warning"
                      }
                    >
                      Approval: {sessionApprovalStatus}
                    </Badge>
                  </div>
                  <div className="booking-status-divider" />
                  <div className="booking-status-block">
                    <div className="toggle-row">
                      <span>Start Time</span>
                      <strong>{checkInTimeLabel || "Waiting for entry OTP verification"}</strong>
                    </div>
                    <div className="toggle-row">
                      <span>End Time</span>
                      <strong>{checkOutTimeLabel || "Waiting for exit OTP verification"}</strong>
                    </div>
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
              <Card title="Request Status" subtitle="Send request and wait for owner approval.">
                <p className="card-subtitle">
                  Once request is sent, this booking will move to your active list with status pending/accepted.
                </p>
              </Card>
            )}

            {!isCreatingNew && sessionStatus !== "checked_out" && (canExtendSession || showActiveExpiryReminder) ? (
              <Card
                title="Expiry Reminder & Extension"
                subtitle="Get notified before slot ends and extend only if capacity allows."
              >
                <div className="form-grid">
                  {typeof minutesToExpiry === "number" ? (
                    <div className="toggle-row">
                      <span>Time Remaining</span>
                      <strong>{minutesToExpiry > 0 ? formatDurationMinutes(minutesToExpiry) : "Expired"}</strong>
                    </div>
                  ) : null}

                  {showActiveExpiryReminder ? (
                    <div className="glass-card booking-alert-card">
                      <p className="card-subtitle booking-alert-text">
                        Your booking is ending in ~10 minutes. Ready to move or extend now?
                      </p>
                    </div>
                  ) : null}

                  {canExtendSession ? (
                    <>
                      <label>
                        <span className="card-subtitle">Extend By (minutes)</span>
                        <select
                          className="select"
                          value={String(extendMinutes)}
                          onChange={(event) => {
                            setExtendMinutes(Number(event.target.value));
                            setExtensionPreview(null);
                            setExtensionError("");
                            setExtensionSuccess("");
                          }}
                        >
                          <option value="10">10 min</option>
                          <option value="15">15 min</option>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">60 min</option>
                        </select>
                      </label>

                      <div className="booking-extension-actions">
                        <Button variant="secondary" onClick={() => void handlePreviewExtension()} isLoading={extensionBusy}>
                          Check Extension
                        </Button>
                        <Button onClick={() => void handleApplyExtension()} isLoading={extensionBusy}>
                          Extend Now
                        </Button>
                      </div>

                      {extensionPreview ? (
                        <div className="glass-card booking-slot-card">
                          <div className="toggle-row">
                            <span>Requested Until</span>
                            <strong>{new Date(extensionPreview.requestedEndMs).toLocaleTimeString()}</strong>
                          </div>
                          <div className="toggle-row">
                            <span>Available Until</span>
                            <strong>{new Date(extensionPreview.allowedEndMs).toLocaleTimeString()}</strong>
                          </div>
                          <div className="toggle-row">
                            <span>Extra Charge</span>
                            <strong>Rs {Math.round(extensionPreview.allowedExtraAmount)}</strong>
                          </div>
                          <p className="card-subtitle booking-extension-note">
                            {extensionPreview.note}
                          </p>
                        </div>
                      ) : null}

                      {extensionSuccess ? (
                        <p className="card-subtitle booking-inline-note booking-inline-note-success">
                          {extensionSuccess}
                        </p>
                      ) : null}
                      {extensionError ? (
                        <p className="card-subtitle booking-inline-note booking-inline-note-error">
                          {extensionError}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </Card>
            ) : null}

            {shouldShowActiveOtp ? (
              <Card title="Active OTP">
                <div className="form-grid">
                  <Badge tone="info">OTP Action: {otpAction === "check_in" ? "Entry" : "Exit"}</Badge>
                  <div className="glass-card booking-otp-display">
                    <p className="card-subtitle">Share this OTP with owner</p>
                    <p className="booking-otp-code">
                      {otpCode}
                    </p>
                    {bookingCode ? (
                      <p className="card-subtitle booking-otp-sub">
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
                      : "Your booking request was rejected by owner. Please choose another time and rebook."}
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
                    Waiting for owner acceptance. You can switch bookings from My Bookings above.
                  </p>
                )}

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
