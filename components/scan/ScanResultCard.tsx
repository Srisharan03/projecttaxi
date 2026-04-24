import { Badge, Card } from "@/components/ui";

interface ScanResultCardProps {
  status: "idle" | "success" | "error";
  message: string;
}

export function ScanResultCard({ status, message }: ScanResultCardProps) {
  return (
    <Card title="Scan Status" subtitle="Session update result.">
      <div className="form-grid">
        <Badge tone={status === "success" ? "success" : status === "error" ? "danger" : "neutral"}>
          {status.toUpperCase()}
        </Badge>
        <p className="card-subtitle">{message || "Scan QR to begin."}</p>
      </div>
    </Card>
  );
}
