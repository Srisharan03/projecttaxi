import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui";

interface QrTicketProps {
  payload: string;
}

export function QrTicket({ payload }: QrTicketProps) {
  return (
    <Card title="Scan at Entry / Exit" subtitle="Valid for geofenced check-in workflow.">
      <div style={{ display: "grid", placeItems: "center", gap: "0.75rem" }}>
        <QRCodeSVG value={payload} size={220} level="M" includeMargin />
        <p className="card-subtitle">Session payload generated successfully.</p>
      </div>
    </Card>
  );
}
