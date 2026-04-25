"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Modal } from "@/components/ui";
import {
  addPublicSpotAudit,
  type PublicSpotAudit,
} from "@/lib/firestore";
import { getCurrentPosition } from "@/lib/geofence";
import type { RankedSpot } from "@/lib/optimization";

interface PublicSpotAuditModalProps {
  open: boolean;
  onClose: () => void;
  spot: RankedSpot | null;
  reporterId: string;
  history: Array<PublicSpotAudit & { id: string }>;
  isHistoryLoading: boolean;
  historyError: string;
  onRefreshHistory: () => Promise<void>;
}

function formatAuditTime(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return new Date(millis).toLocaleString();
  }

  return "Recently";
}

export function PublicSpotAuditModal({
  open,
  onClose,
  spot,
  reporterId,
  history,
  isHistoryLoading,
  historyError,
  onRefreshHistory,
}: PublicSpotAuditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const latestAudit = useMemo(() => history[0] ?? null, [history]);

  const submit = async (status: "space_left" | "full") => {
    if (!spot) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setStatusMessage("");
    try {
      const currentLocation = await getCurrentPosition();
      await addPublicSpotAudit(
        spot.id,
        spot.name,
        spot.address,
        reporterId,
        status,
        message,
        currentLocation,
        spot.location,
      );
      setStatusMessage(
        status === "space_left"
          ? "Audit submitted: parking available."
          : "Audit submitted: no parking available.",
      );
      setMessage("");
      await onRefreshHistory();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit audit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={spot ? `Audit: ${spot.name}` : "Audit Public Spot"}
      description="Share current availability for this exact public parking space."
      className="public-audit-modal"
    >
      {!spot ? <p className="card-subtitle">No public spot selected.</p> : null}

      {spot ? (
        <div className="form-grid public-audit-grid">
          <p className="card-subtitle public-audit-address">
            {spot.address}
          </p>

          <div className="glass-card public-audit-latest-card">
            <div className="hero-actions public-audit-latest-badges">
              <Badge tone="info">Latest</Badge>
              {latestAudit ? (
                <Badge tone={latestAudit.status === "space_left" ? "success" : "danger"}>
                  {latestAudit.status === "space_left" ? "Parking Here" : "No Parking"}
                </Badge>
              ) : (
                <Badge tone="neutral">No audits yet</Badge>
              )}
            </div>
            <p className="card-subtitle public-audit-message">
              {latestAudit?.message?.trim() || "No review message yet."}
            </p>
            {latestAudit ? (
              <p className="card-subtitle public-audit-time">
                {formatAuditTime(latestAudit.created_at)}
              </p>
            ) : null}
          </div>

          <label className="public-audit-field">
            <span className="card-subtitle public-audit-field-label">
              Quick review (optional)
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 220))}
              placeholder="Example: 2 slots free near entrance."
              className="input public-audit-textarea"
              aria-label="Add quick review"
            />
            <span className="public-audit-count">{message.length}/220</span>
          </label>

          <div className="hero-actions public-audit-actions">
            <Button
              size="lg"
              variant="secondary"
              isLoading={isSubmitting}
              onClick={() => void submit("space_left")}
            >
              Parking Here
            </Button>
            <Button size="lg" isLoading={isSubmitting} onClick={() => void submit("full")}>
              No Parking
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => setShowHistory((prev) => !prev)}
            disabled={isHistoryLoading}
            size="lg"
          >
            {showHistory ? "Hide History" : "View History"}
          </Button>

          {showHistory ? (
            <div className="form-grid public-audit-history-list">
              {isHistoryLoading ? <p className="card-subtitle">Loading history...</p> : null}
              {!isHistoryLoading && !history.length ? (
                <p className="card-subtitle">No history yet for this public spot.</p>
              ) : null}
              {!isHistoryLoading &&
                history.map((audit) => (
                  <div key={audit.id} className="glass-card public-audit-history-item">
                    <div className="hero-actions public-audit-history-badges">
                      <Badge tone={audit.status === "space_left" ? "success" : "danger"}>
                        {audit.status === "space_left" ? "Parking Here" : "No Parking"}
                      </Badge>
                      <Badge tone="neutral">{formatAuditTime(audit.created_at)}</Badge>
                    </div>
                    <p className="card-subtitle public-audit-message">
                      {audit.message?.trim() || "No message added."}
                    </p>
                  </div>
                ))}
            </div>
          ) : null}

          {statusMessage ? <p className="card-subtitle public-audit-success">{statusMessage}</p> : null}
          {historyError ? <p className="card-subtitle public-audit-error">{historyError}</p> : null}
          {error ? <p className="card-subtitle public-audit-error">{error}</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}
