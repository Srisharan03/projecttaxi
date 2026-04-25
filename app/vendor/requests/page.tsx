"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import {
  respondToBookingRequest,
  subscribeToSessions,
  subscribeToSpots,
  subscribeToVendors,
  type ParkingSpot,
  type Session,
  type Vendor,
} from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import "@/styles/vendor.css";

type VendorWithId = Vendor & { id: string };
type SpotWithId = ParkingSpot & { id: string };
type SessionWithId = Session & { id: string };

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function VendorRequestsPage() {
  const user = useAuthStore((state) => state.user);
  const [vendors, setVendors] = useState<VendorWithId[]>([]);
  const [spots, setSpots] = useState<SpotWithId[]>([]);
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
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

  const vendorSpotMap = useMemo(() => {
    const map = new Map<string, SpotWithId>();
    if (!selectedVendor) {
      return map;
    }

    spots
      .filter((spot) => spot.vendor_id === selectedVendor.id)
      .forEach((spot) => {
        map.set(spot.id, spot);
      });

    return map;
  }, [spots, selectedVendor]);

  const vendorRequests = useMemo(() => {
    const list = sessions
      .filter((session) => vendorSpotMap.has(session.spot_id))
      .filter((session) => session.status === "booked" || session.status === "checked_in")
      .sort((a, b) => {
        const left = typeof a.booking_time === "object" && a.booking_time !== null && "toMillis" in a.booking_time
          ? (a.booking_time as { toMillis: () => number }).toMillis()
          : 0;
        const right =
          typeof b.booking_time === "object" && b.booking_time !== null && "toMillis" in b.booking_time
            ? (b.booking_time as { toMillis: () => number }).toMillis()
            : 0;
        return right - left;
      });

    return list;
  }, [sessions, vendorSpotMap]);

  const pendingCount = vendorRequests.filter((session) => (session.approval_status ?? "accepted") === "pending").length;

  const handleDecision = async (sessionId: string, decision: "accepted" | "rejected") => {
    setBusySessionId(sessionId);
    setStatusMessage("");
    setErrorMessage("");

    try {
      await respondToBookingRequest(sessionId, decision);
      setStatusMessage(`Booking request ${decision}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to process booking request.");
    } finally {
      setBusySessionId(null);
    }
  };

  return (
    <div className="vendor-page shell">
      <section className="section">
        <Card title="Booking Requests" subtitle="Approve or reject user booking requests for your time slots.">
          <div className="form-grid">
            <div className="vendor-toolbar">
              <label className="vendor-form-field">
                <span className="vendor-form-label">Owner Profile</span>
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

              <div className="vendor-toolbar-actions">
                <Link href="/vendor/dashboard">
                  <Button variant="secondary">Back to Dashboard</Button>
                </Link>
              </div>
            </div>

            {selectedVendor ? (
              <div className="vendor-summary-row">
                <Badge tone={selectedVendor.status === "approved" ? "success" : "warning"}>
                  Owner status: {selectedVendor.status}
                </Badge>
                <Badge tone={pendingCount > 0 ? "warning" : "success"}>
                  Pending Notifications: {pendingCount}
                </Badge>
                <Badge tone="info">Total Requests: {vendorRequests.length}</Badge>
              </div>
            ) : null}

            {statusMessage ? <p className="card-subtitle vendor-status-note-success">{statusMessage}</p> : null}
            {errorMessage ? <p className="card-subtitle vendor-status-note-error">{errorMessage}</p> : null}
          </div>
        </Card>
      </section>

      <section className="section">
        {!vendorRequests.length ? (
          <Card title="No Requests" subtitle="No booking requests found for this owner yet." />
        ) : (
          <div className="form-grid">
            {vendorRequests.map((session) => {
              const spot = vendorSpotMap.get(session.spot_id);
              const approval = session.approval_status ?? "accepted";
              const isBusy = busySessionId === session.id;

              return (
                <Card
                  key={session.id}
                  title={`${spot?.name ?? "Unknown Spot"} - ${session.vehicle_number}`}
                  subtitle={`${formatDateTime(session.start_time_iso)} to ${formatDateTime(session.end_time_iso)}`}
                  className="vendor-request-card"
                >
                  <div className="form-grid">
                    <div className="vendor-request-badges">
                      <Badge
                        tone={
                          approval === "accepted"
                            ? "success"
                            : approval === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        Request: {approval}
                      </Badge>
                      <Badge tone="info">Status: {session.status}</Badge>
                      <Badge tone={session.payment_status === "paid" ? "success" : "warning"}>
                        Payment: {session.payment_status}
                      </Badge>
                      <Badge tone="neutral">Fixed Amount: Rs {Math.round(session.amount || 0)}</Badge>
                    </div>

                    <div className="vendor-request-meta">
                      <p className="card-subtitle">Booking Code: {session.access_code || "-"}</p>
                      <p className="card-subtitle">Vehicle Type: {session.vehicle_type || "-"}</p>
                    </div>

                    {approval === "pending" ? (
                      <div className="vendor-request-actions">
                        <Button
                          type="button"
                          onClick={() => void handleDecision(session.id, "accepted")}
                          isLoading={isBusy}
                        >
                          Accept Request
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void handleDecision(session.id, "rejected")}
                          isLoading={isBusy}
                        >
                          Reject Request
                        </Button>
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

