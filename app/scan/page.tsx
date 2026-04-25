"use client";

import { useState } from "react";
import { ScanResultCard } from "@/components/scan/ScanResultCard";
import { Badge, Button, Card } from "@/components/ui";
import {
  getSessionByAccessCode,
  getSessionById,
  processSessionOtpByAccessCode,
  rateSession,
  type OtpAction,
} from "@/lib/firestore";
import "@/styles/scan.css";

function formatSessionTime(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const dateValue = (value as { toDate: () => Date }).toDate();
    return dateValue.toLocaleString();
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  return "Not available";
}

export default function ScanPage() {
  const [bookingCode, setBookingCode] = useState("");
  const [otp, setOtp] = useState("");
  const [action, setAction] = useState<OtpAction>("check_in");
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [payableAmount, setPayableAmount] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleVerifyOtp = async () => {
    if (processing) {
      return;
    }

    if (!bookingCode.trim()) {
      setStatus("error");
      setMessage("Booking code is required.");
      return;
    }

    setProcessing(true);
    setStatus("idle");
    setMessage("");
    setPayableAmount(null);

    try {
      const normalizedCode = bookingCode.trim().toUpperCase();
      const session = await getSessionByAccessCode(normalizedCode);
      if (!session) {
        throw new Error("Booking code not found.");
      }

      const result = await processSessionOtpByAccessCode(normalizedCode, action, otp.trim());
      const latestSession = await getSessionById(session.id);

      if (result.action === "check_in") {
        setStatus("success");
        const startTimeText = latestSession?.check_in_time
          ? formatSessionTime(latestSession.check_in_time)
          : "Not available";
        setMessage(
          `OTP verified. Booking started at ${startTimeText}. Current amount: Rs ${Math.round(latestSession?.amount || result.finalAmount)}.`,
        );
      } else {
        if (rating > 0) {
          await rateSession(session.id, rating);
        }

        const endTimeText = latestSession?.check_out_time
          ? formatSessionTime(latestSession.check_out_time)
          : "Not available";
        const finalAmount = Math.round(latestSession?.amount || result.finalAmount);
        const extraAmount = Math.round(latestSession?.extra_amount || result.extraAmount);
        const overtime = latestSession?.overtime_minutes ?? result.overtimeMinutes;
        setPayableAmount(finalAmount);

        setStatus("success");
        if (extraAmount > 0) {
          setMessage(
            `OTP verified. Booking ended at ${endTimeText}. Extra charge: Rs ${extraAmount} for ${overtime} overtime mins. Final amount: Rs ${finalAmount}.`,
          );
        } else {
          setMessage(
            `OTP verified. Booking ended at ${endTimeText}. Final amount: Rs ${finalAmount}.`,
          );
        }
      }
    } catch (otpError) {
      setStatus("error");
      setMessage(otpError instanceof Error ? otpError.message : "OTP verification failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="scan-page shell">
      <section className="section">
        <Card title="OTP Verification" subtitle="Verify 6-digit entry and exit OTP using booking code.">
          <div className="scan-intro-badges">
            <Badge tone="info">No Spot ID needed</Badge>
            <Badge tone="success">No user geolocation needed</Badge>
          </div>
        </Card>
      </section>

      <section className="scan-grid">
        <Card
          title="Owner OTP Console"
          subtitle="Enter booking code and OTP to process entry or exit."
          className="scan-console-card"
        >
          <div className="scan-form-grid">
            <label className="scan-field">
              <span className="card-subtitle">Booking Code</span>
              <input
                className="input"
                value={bookingCode}
                onChange={(event) => setBookingCode(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
              />
            </label>

            <label className="scan-field">
              <span className="card-subtitle">Action</span>
              <select
                className="select"
                value={action}
                onChange={(event) => setAction(event.target.value as OtpAction)}
              >
                <option value="check_in">Entry (Check-in)</option>
                <option value="check_out">Exit (Check-out)</option>
              </select>
            </label>

            <label className="scan-field">
              <span className="card-subtitle">6-digit OTP</span>
              <input
                className="input"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </label>

            <label className="scan-field">
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

            <Button onClick={() => void handleVerifyOtp()} isLoading={processing} className="scan-verify-btn">
              Verify OTP
            </Button>
          </div>
        </Card>

        <ScanResultCard status={status} message={message} />

        {payableAmount !== null ? (
          <Card title="Amount Payable" subtitle="Show this final amount to user and owner." className="scan-payable-card">
            <div className="toggle-row">
              <span>Final Payable</span>
              <strong>Rs {payableAmount}</strong>
            </div>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
