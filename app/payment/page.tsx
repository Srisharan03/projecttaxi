"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PaymentMethodCards } from "@/components/payment/PaymentMethodCards";
import { ReceiptCard } from "@/components/payment/ReceiptCard";
import { Badge, Button, Card } from "@/components/ui";
import { getSessionById, markSessionPaid, type Session } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";
import "@/styles/booking.css";
import "@/styles/payment.css";

type SessionWithId = Session & { id: string };

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const mode = searchParams.get("mode");
  const spotId = searchParams.get("spotId");

  const [session, setSession] = useState<SessionWithId | null>(null);
  const [method, setMethod] = useState<"upi" | "cash">("upi");
  const [upiProvider, setUpiProvider] = useState<"gpay" | "phonepe" | "paytm">("gpay");
  const [cashOtp, setCashOtp] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void getSessionById(sessionId)
      .then((result) => setSession(result))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load session.");
      });
  }, [sessionId]);

  const completePayment = async () => {
    if (!session) {
      setError("Missing session context.");
      return;
    }

    if (method === "cash" && cashOtp.length !== 4) {
      setError("Enter valid 4-digit OTP for cash confirmation.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      await markSessionPaid(session.id, method);
      const refreshed = await getSessionById(session.id);
      setSession(refreshed);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Payment failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="payment-page shell">
      <section className="section">
        <Card title="Payment" subtitle="Complete payment to unlock check-in flow.">
          {session ? (
            <div className="payment-summary-badges">
              <Badge tone="info">Session: {session.id}</Badge>
              <Badge tone="neutral">Amount: {formatCurrency(session.amount || 0)}</Badge>
              <Badge tone={mode === "entry" ? "warning" : "info"}>
                {mode === "entry" ? "Entry Payment" : "Exit Payment"}
              </Badge>
              <Badge tone={session.payment_status === "paid" ? "success" : "warning"}>
                {session.payment_status}
              </Badge>
            </div>
          ) : (
            <p className="card-subtitle payment-inline-note">Load a session from booking first.</p>
          )}
        </Card>
      </section>

      <section className="payment-grid">
        <div className="payment-main-column">
          <PaymentMethodCards
            method={method}
            upiProvider={upiProvider}
            cashOtp={cashOtp}
            onMethodChange={setMethod}
            onUpiProviderChange={setUpiProvider}
            onCashOtpChange={setCashOtp}
            onPay={() => void completePayment()}
            isLoading={processing}
          />
        </div>

        <div className="payment-side-column">
          {session && session.payment_status === "paid" ? (
            <div className="form-grid">
              <ReceiptCard session={session} />
              {spotId ? (
                <Link href={`/booking?spotId=${spotId}`}>
                  <Button>Back to Booking</Button>
                </Link>
              ) : null}
            </div>
          ) : (
            <Card title="Receipt Pending">
              <p className="card-subtitle payment-inline-note">
                Complete payment to generate receipt and continue.
              </p>
            </Card>
          )}
        </div>
      </section>

      {error ? (
        <section className="section">
          <p className="card-subtitle payment-error-note">{error}</p>
        </section>
      ) : null}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="payment-page shell">
          <section className="section">
            <Card title="Payment">
              <p className="card-subtitle">Loading payment session...</p>
            </Card>
          </section>
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
