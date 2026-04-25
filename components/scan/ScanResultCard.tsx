import { Badge, Card } from "@/components/ui";

interface ScanResultCardProps {
  status: "idle" | "success" | "error";
  message: string;
}

export function ScanResultCard({ status, message }: ScanResultCardProps) {
  const tone = status === "success" ? "success" : status === "error" ? "danger" : "neutral";

  return (
    <Card title="Verification Status" subtitle="Session update result." className="scan-result-card">
      <div className="scan-result-grid">
        <Badge tone={tone}>
          {status.toUpperCase()}
        </Badge>
        <p className={`card-subtitle ${status === "error" ? "scan-result-message-error" : "scan-result-message"}`}>
          {message || "Enter OTP and verify to begin."}
        </p>
      </div>
    </Card>
  );
}
