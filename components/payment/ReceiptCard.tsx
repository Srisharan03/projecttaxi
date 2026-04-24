import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import type { Session } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";

interface ReceiptCardProps {
  session: Session & { id: string };
}

export function ReceiptCard({ session }: ReceiptCardProps) {
  return (
    <Card title="Payment Receipt" subtitle="Booking confirmed. Use scanner for check-in/out.">
      <div className="form-grid">
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
        <div className="hero-actions">
          <Link href="/scan">
            <Button>Scan QR</Button>
          </Link>
          <Link href={`/map?spotId=${session.spot_id}`}>
            <Button variant="secondary">Navigate to Spot</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
