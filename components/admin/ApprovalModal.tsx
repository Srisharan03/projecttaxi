import { Badge, Button, Modal } from "@/components/ui";
import type { ParkingSpot, Vendor } from "@/lib/firestore";

type VendorWithId = Vendor & { id: string };
type SpotWithId = ParkingSpot & { id: string };

interface ApprovalModalProps {
  vendor: VendorWithId | null;
  spots: SpotWithId[];
  open: boolean;
  onClose: () => void;
  onApprove: (vendor: VendorWithId) => void;
  onReject: (vendor: VendorWithId) => void;
}

export function ApprovalModal({
  vendor,
  spots,
  open,
  onClose,
  onApprove,
  onReject,
}: ApprovalModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vendor ? `Review ${vendor.name}` : "Vendor Review"}
      description="Inspect profile details and approve listing visibility."
      footer={
        vendor ? (
          <div className="hero-actions">
            <Button variant="danger" onClick={() => onReject(vendor)}>
              Reject
            </Button>
            <Button onClick={() => onApprove(vendor)}>Approve</Button>
          </div>
        ) : null
      }
    >
      {vendor ? (
        <div className="form-grid">
          <div className="toggle-row">
            <span>Email</span>
            <strong>{vendor.email}</strong>
          </div>
          <div className="toggle-row">
            <span>Phone</span>
            <strong>{vendor.phone}</strong>
          </div>
          <div className="toggle-row">
            <span>Status</span>
            <Badge tone={vendor.status === "approved" ? "success" : "warning"}>{vendor.status}</Badge>
          </div>
          <div className="toggle-row">
            <span>Platform fee rate</span>
            <strong>{Math.round(vendor.platform_fee_rate * 100)}%</strong>
          </div>

          <div className="form-grid">
            <span className="card-subtitle">Submitted spots</span>
            {spots.map((spot) => (
              <div key={spot.id} className="toggle-row">
                <span>{spot.name}</span>
                <strong>
                  {spot.location.lat.toFixed(4)}, {spot.location.lng.toFixed(4)}
                </strong>
              </div>
            ))}
            {!spots.length ? <p className="card-subtitle">No spots attached to this vendor.</p> : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
