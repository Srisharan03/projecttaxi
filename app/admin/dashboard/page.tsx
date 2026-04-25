"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprovalModal } from "@/components/admin/ApprovalModal";
import { VendorTable } from "@/components/admin/VendorTable";
import { Badge, Button, Card } from "@/components/ui";
import {
  approveVendor,
  deleteCommunitySpotCluster,
  getAllSessions,
  rejectVendor,
  subscribeToCommunitySpots,
  subscribeToSpots,
  subscribeToVendors,
  type CommunitySpotCluster,
  type ParkingSpot,
  type Vendor,
} from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";
import "@/styles/admin.css";

type VendorWithId = Vendor & { id: string };
type SpotWithId = ParkingSpot & { id: string };
type CommunitySpotWithId = CommunitySpotCluster & { id: string };

export default function AdminDashboardPage() {
  const [vendors, setVendors] = useState<VendorWithId[]>([]);
  const [spots, setSpots] = useState<SpotWithId[]>([]);
  const [communitySpots, setCommunitySpots] = useState<CommunitySpotWithId[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [dashboardTab, setDashboardTab] = useState<"vendors" | "community">("vendors");
  const [selectedVendor, setSelectedVendor] = useState<VendorWithId | null>(null);
  const [platformRevenue, setPlatformRevenue] = useState(0);
  const [deletingClusterId, setDeletingClusterId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeVendors = subscribeToVendors(setVendors);
    const unsubscribeSpots = subscribeToSpots(setSpots);
    const unsubscribeCommunitySpots = subscribeToCommunitySpots(setCommunitySpots);

    void getAllSessions(300).then((rows) => {
      setPlatformRevenue(rows.reduce((acc, session) => acc + (session.platform_fee || 0), 0));
    });

    return () => {
      unsubscribeVendors();
      unsubscribeSpots();
      unsubscribeCommunitySpots();
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
  const pendingCommunityCount = communitySpots.filter((spot) => !spot.is_verified).length;
  const verifiedCommunityCount = communitySpots.filter((spot) => spot.is_verified).length;

  const handleApprove = async (vendor: VendorWithId) => {
    await approveVendor(vendor.id, vendor.spots);
    setSelectedVendor(null);
  };

  const handleReject = async (vendor: VendorWithId) => {
    await rejectVendor(vendor.id);
    setSelectedVendor(null);
  };

  const handleDeleteCommunitySpot = async (clusterId: string) => {
    setDeletingClusterId(clusterId);
    try {
      await deleteCommunitySpotCluster(clusterId);
    } finally {
      setDeletingClusterId(null);
    }
  };

  return (
    <div className="admin-page shell">
      <section className="section admin-grid">
        <Card title="Admin Control" subtitle="Approve inventory and monitor platform health.">
          <div className="hero-actions">
            <Badge tone="warning">Pending: {pendingCount}</Badge>
            <Badge tone="success">Approved: {approvedCount}</Badge>
            <Badge tone="info">Live Spots: {liveSpotsCount}</Badge>
            <Badge tone="warning">Community Pending: {pendingCommunityCount}</Badge>
            <Badge tone="success">Community Verified: {verifiedCommunityCount}</Badge>
            <Badge tone="neutral">Platform Revenue: {formatCurrency(platformRevenue)}</Badge>
          </div>
        </Card>

        <Card title="Review Panels">
          <div className="hero-actions" style={{ marginBottom: "0.75rem" }}>
            <Button
              variant={dashboardTab === "vendors" ? "primary" : "secondary"}
              onClick={() => setDashboardTab("vendors")}
            >
              Vendor Queue
            </Button>
            <Button
              variant={dashboardTab === "community" ? "primary" : "secondary"}
              onClick={() => setDashboardTab("community")}
            >
              Community Spots
            </Button>
          </div>

          {dashboardTab === "vendors" ? (
            <div className="form-grid">
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
            </div>
          ) : (
            <div className="form-grid">
              <Card title="Pending Clusters" subtitle="Automatic verification at 7 unique reports.">
                <div className="form-grid">
                  {communitySpots.filter((cluster) => !cluster.is_verified).length ? (
                    communitySpots
                      .filter((cluster) => !cluster.is_verified)
                      .map((cluster) => (
                        <div key={cluster.id} className="glass-card" style={{ padding: "0.8rem" }}>
                          <div className="hero-actions">
                            <Badge tone="warning">Pending</Badge>
                            <Badge tone="info">Reports: {cluster.report_count}</Badge>
                            <Badge tone="neutral">Reliability: {cluster.reliability_score || 0}%</Badge>
                          </div>
                          <p className="card-subtitle">
                            {cluster.location.lat.toFixed(6)}, {cluster.location.lng.toFixed(6)}
                          </p>
                          <div className="hero-actions">
                            <Button
                              variant="secondary"
                              isLoading={deletingClusterId === cluster.id}
                              onClick={() => void handleDeleteCommunitySpot(cluster.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="card-subtitle">No pending community clusters.</p>
                  )}
                </div>
              </Card>

              <Card title="Verified Spots" subtitle="Shown on map as community public spots.">
                <div className="form-grid">
                  {communitySpots.filter((cluster) => cluster.is_verified).length ? (
                    communitySpots
                      .filter((cluster) => cluster.is_verified)
                      .map((cluster) => (
                        <div key={cluster.id} className="glass-card" style={{ padding: "0.8rem" }}>
                          <div className="hero-actions">
                            <Badge tone="success">Verified</Badge>
                            <Badge tone="info">Reports: {cluster.report_count}</Badge>
                            <Badge tone="neutral">Reliability: {cluster.reliability_score || 0}%</Badge>
                          </div>
                          <p className="card-subtitle">
                            {cluster.location.lat.toFixed(6)}, {cluster.location.lng.toFixed(6)}
                          </p>
                          <div className="hero-actions">
                            <Button
                              variant="secondary"
                              isLoading={deletingClusterId === cluster.id}
                              onClick={() => void handleDeleteCommunitySpot(cluster.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="card-subtitle">No verified community spots.</p>
                  )}
                </div>
              </Card>
            </div>
          )}
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
