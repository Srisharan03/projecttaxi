import { useState } from "react";
import Image from "next/image";
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
  const [activeImage, setActiveImage] = useState<{ title: string; url: string } | null>(null);

  const isImageUrl = (value: string): boolean => {
    const lower = value.toLowerCase();
    return (
      lower.includes("/image/") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif")
    );
  };

  const openAsset = (title: string, url: string) => {
    if (isImageUrl(url)) {
      setActiveImage({ title, url });
      return;
    }

    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={vendor ? `Review ${vendor.name}` : "Vendor Review"}
        description="Inspect full registration details and approve listing visibility."
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
            <div className="hero-actions">
              <Badge tone={vendor.status === "approved" ? "success" : "warning"}>{vendor.status}</Badge>
              <Badge tone="info">Spots: {spots.length}</Badge>
              <Badge tone="neutral">Fee: {Math.round(vendor.platform_fee_rate * 100)}%</Badge>
            </div>

            <div className="glass-card" style={{ padding: "0.75rem" }}>
              <p className="card-subtitle" style={{ marginBottom: "0.4rem" }}><strong>Vendor Details</strong></p>
              <div className="toggle-row"><span>Name</span><strong>{vendor.name}</strong></div>
              <div className="toggle-row"><span>Email</span><strong>{vendor.email}</strong></div>
              <div className="toggle-row"><span>Phone</span><strong>{vendor.phone}</strong></div>
              <div className="toggle-row"><span>Revenue earned</span><strong>{vendor.revenue_earned ?? 0}</strong></div>
              {vendor.profile_image ? (
                <div className="hero-actions" style={{ marginTop: "0.5rem" }}>
                  <Button size="sm" variant="ghost" onClick={() => openAsset("Vendor Profile Image", vendor.profile_image || "")}>
                    View Profile Image
                  </Button>
                </div>
              ) : (
                <p className="card-subtitle">Profile image: Not provided</p>
              )}
              {vendor.documents?.length ? (
                <div className="form-grid" style={{ marginTop: "0.5rem" }}>
                  <p className="card-subtitle"><strong>Documents</strong></p>
                  <div className="hero-actions">
                    {vendor.documents.map((url, index) => (
                      <Button
                        key={`${url}-${index}`}
                        size="sm"
                        variant="secondary"
                        onClick={() => openAsset(`Document ${index + 1}`, url)}
                      >
                        View Doc {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="card-subtitle">Documents: Not provided</p>
              )}
            </div>

            <div className="form-grid">
              <span className="card-subtitle"><strong>Submitted Spots</strong></span>
              {spots.map((spot) => (
                <div key={spot.id} className="glass-card" style={{ padding: "0.75rem", display: "grid", gap: "0.45rem" }}>
                  <div className="hero-actions">
                    <Badge tone="info">{spot.type}</Badge>
                    <Badge tone={spot.is_approved ? "success" : "warning"}>{spot.is_approved ? "Approved" : "Pending"}</Badge>
                    <Badge tone={spot.status === "open" ? "success" : "neutral"}>{spot.status}</Badge>
                  </div>
                  <div className="toggle-row"><span>Name</span><strong>{spot.name}</strong></div>
                  <div className="toggle-row"><span>Address</span><strong>{spot.address}</strong></div>
                  <div className="toggle-row">
                    <span>Coordinates</span>
                    <strong>{spot.location.lat.toFixed(6)}, {spot.location.lng.toFixed(6)}</strong>
                  </div>
                  <div className="toggle-row"><span>Vehicle Types</span><strong>{spot.vehicle_types.join(", ") || "N/A"}</strong></div>
                  <div className="toggle-row"><span>Total Slots</span><strong>{spot.total_spots}</strong></div>
                  <div className="toggle-row"><span>Current Occupancy</span><strong>{spot.current_occupancy}</strong></div>
                  <div className="toggle-row">
                    <span>Pricing</span>
                    <strong>Flat ₹{spot.pricing.flat_rate} | Hourly ₹{spot.pricing.hourly_rate}</strong>
                  </div>
                  <div className="toggle-row"><span>Amenities</span><strong>{spot.amenities.join(", ") || "N/A"}</strong></div>
                  <div className="toggle-row">
                    <span>Size</span>
                    <strong>
                      {spot.size_sqft ? `${spot.size_sqft} sqft` : ""}
                      {spot.size_sqft && spot.size_yards ? " / " : ""}
                      {spot.size_yards ? `${spot.size_yards} sqyd` : ""}
                      {!spot.size_sqft && !spot.size_yards ? "N/A" : ""}
                    </strong>
                  </div>

                  <div className="form-grid">
                    <p className="card-subtitle"><strong>Spot Images</strong></p>
                    {spot.images?.length ? (
                      <div className="hero-actions">
                        {spot.images.map((url, index) => (
                          <Button
                            key={`${spot.id}-image-${index}`}
                            size="sm"
                            variant="secondary"
                            onClick={() => openAsset(`${spot.name} Image ${index + 1}`, url)}
                          >
                            View Image {index + 1}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="card-subtitle">No spot images uploaded.</p>
                    )}
                  </div>
                </div>
              ))}
              {!spots.length ? <p className="card-subtitle">No spots attached to this vendor.</p> : null}
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(activeImage)}
        onClose={() => setActiveImage(null)}
        title={activeImage?.title || "Preview"}
        description="Submitted asset preview"
      >
        {activeImage?.url ? (
          <Image
            src={activeImage.url}
            alt={activeImage.title || "asset"}
            width={900}
            height={520}
            unoptimized
            style={{ width: "100%", height: "auto", borderRadius: "12px", objectFit: "cover" }}
          />
        ) : (
          <p className="card-subtitle">No preview available.</p>
        )}
      </Modal>
    </>
  );
}
