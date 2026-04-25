import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import type { Session } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";

interface ReceiptCardProps {
  session: Session & { id: string };
}

export function ReceiptCard({ session }: ReceiptCardProps) {
  return (
    <Card title="Payment Receipt" subtitle="Booking confirmed. Use OTP verification for check-in/out.">
      <div className="payment-receipt-grid">
        <div className="toggle-row">
          <span>Session</span>
          <strong>{session.id}</strong>
        </div>
        <div className="toggle-row">
          <span>Vehicle</span>
          <strong>{session.vehicle_number}</strong>
        </div>
        <div className="toggle-row">
          <span>Amount</span>
          <strong>{formatCurrency(session.amount || 0)}</strong>
        </div>
        <div className="toggle-row">
          <span>Payment</span>
          <Badge tone="success">{session.payment_status}</Badge>
        </div>
        <div className="payment-receipt-actions">
          <Link href="/scan">
            <Button>Verify OTP</Button>
          </Link>
          <Link href={`/map?spotId=${session.spot_id}`}>
            <Button variant="secondary">Navigate to Spot</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
