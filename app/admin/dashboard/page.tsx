"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprovalModal } from "@/components/admin/ApprovalModal";
import { VendorTable } from "@/components/admin/VendorTable";
import { Badge, Button, Card } from "@/components/ui";
import {
  approveVendor,
  getAllSessions,
  rejectVendor,
  subscribeToSpots,
  subscribeToVendors,
  type ParkingSpot,
  type Vendor,
} from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";
import "@/styles/admin.css";

type VendorWithId = Vendor & { id: string };
type SpotWithId = ParkingSpot & { id: string };

export default function AdminDashboardPage() {
  const [vendors, setVendors] = useState<VendorWithId[]>([]);
  const [spots, setSpots] = useState<SpotWithId[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedVendor, setSelectedVendor] = useState<VendorWithId | null>(null);
  const [platformRevenue, setPlatformRevenue] = useState(0);

  useEffect(() => {
    const unsubscribeVendors = subscribeToVendors(setVendors);
    const unsubscribeSpots = subscribeToSpots(setSpots);

    void getAllSessions(300).then((rows) => {
      setPlatformRevenue(rows.reduce((acc, session) => acc + (session.platform_fee || 0), 0));
    });

    return () => {
      unsubscribeVendors();
      unsubscribeSpots();
    };
  }, []);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => vendor.status === statusFilter);
  }, [vendors, statusFilter]);

  const selectedVendorSpots = useMemo(() => {
    if (!selectedVendor) {
      return [];
    }

    return spots.filter((spot) => spot.vendor_id === selectedVendor.id);
  }, [spots, selectedVendor]);

  const pendingCount = vendors.filter((vendor) => vendor.status === "pending").length;
  const approvedCount = vendors.filter((vendor) => vendor.status === "approved").length;
  const liveSpotsCount = spots.filter((spot) => spot.is_approved && spot.status === "open").length;

  const handleApprove = async (vendor: VendorWithId) => {
    await approveVendor(vendor.id, vendor.spots);
    setSelectedVendor(null);
  };

  const handleReject = async (vendor: VendorWithId) => {
    await rejectVendor(vendor.id);
    setSelectedVendor(null);
  };

  return (
    <div className="admin-page shell">
      <section className="section admin-grid">
        <Card title="Admin Control" subtitle="Approve inventory and monitor platform health.">
          <div className="hero-actions">
            <Badge tone="warning">Pending: {pendingCount}</Badge>
            <Badge tone="success">Approved: {approvedCount}</Badge>
            <Badge tone="info">Live Spots: {liveSpotsCount}</Badge>
            <Badge tone="neutral">Platform Revenue: {formatCurrency(platformRevenue)}</Badge>
          </div>
        </Card>

        <Card title="Vendor Review Queue">
          <div className="hero-actions" style={{ marginBottom: "0.75rem" }}>
            <Button
              variant={statusFilter === "pending" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === "approved" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("approved")}
            >
              Approved
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("rejected")}
            >
              Rejected
            </Button>
          </div>

          <VendorTable vendors={filteredVendors} onOpenVendor={setSelectedVendor} />
        </Card>
      </section>

      <ApprovalModal
        open={Boolean(selectedVendor)}
        vendor={selectedVendor}
        spots={selectedVendorSpots}
        onClose={() => setSelectedVendor(null)}
        onApprove={(vendor) => void handleApprove(vendor)}
        onReject={(vendor) => void handleReject(vendor)}
      />
    </div>
  );
}
