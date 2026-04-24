"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";
import { SpotManager } from "@/components/vendor/SpotManager";
import {
  getSpotSessions,
  subscribeToSpots,
  subscribeToVendors,
  toggleSpotStatus,
  type ParkingSpot,
  type Session,
  type Vendor,
} from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";
import "@/styles/vendor.css";

type VendorWithId = Vendor & { id: string };
type SpotWithId = ParkingSpot & { id: string };
type SessionWithId = Session & { id: string };

export default function VendorDashboardPage() {
  const [vendors, setVendors] = useState<VendorWithId[]>([]);
  const [spots, setSpots] = useState<SpotWithId[]>([]);
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [vendorId, setVendorId] = useState("");

  useEffect(() => {
    const unsubscribeVendors = subscribeToVendors((rows) => {
      setVendors(rows);
      if (!vendorId && rows.length) {
        setVendorId(rows[0].id);
      }
    });

    const unsubscribeSpots = subscribeToSpots((rows) => {
      setSpots(rows);
    });

    return () => {
      unsubscribeVendors();
      unsubscribeSpots();
    };
  }, [vendorId]);

  const selectedVendor = useMemo(() => {
    return vendors.find((vendor) => vendor.id === vendorId) ?? null;
  }, [vendors, vendorId]);

  const vendorSpots = useMemo(() => {
    if (!selectedVendor) {
      return [];
    }

    return spots.filter((spot) => spot.vendor_id === selectedVendor.id);
  }, [spots, selectedVendor]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!vendorSpots.length) {
        setSessions([]);
        return;
      }

      const merged = await Promise.all(vendorSpots.map((spot) => getSpotSessions(spot.id!)));
      setSessions(merged.flat());
    };

    void loadSessions();
  }, [vendorSpots]);

  const grossRevenue = sessions.reduce((acc, session) => acc + (session.amount || 0), 0);
  const platformFees = sessions.reduce((acc, session) => acc + (session.platform_fee || 0), 0);
  const netRevenue = Math.max(grossRevenue - platformFees, 0);

  const occupancyChartData = vendorSpots.map((spot) => ({
    name: spot.name,
    occupied: spot.current_occupancy,
    total: spot.total_spots,
  }));

  return (
    <div className="vendor-page shell">
      <section className="section">
        <Card title="Vendor Dashboard" subtitle="Live operations, occupancy, and payouts.">
          <div className="form-grid">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
              <label style={{ flex: 1, minWidth: "250px" }}>
                <span className="card-subtitle">Select Vendor Profile</span>
                <select
                  className="select"
                  value={vendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                >
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </label>

              <Link href="/scan">
                <Button size="lg" style={{ height: "100%", padding: "0 2rem", fontSize: "1.1rem" }}>
                  📷 Scan QR Code
                </Button>
              </Link>
            </div>

            {selectedVendor ? (
              <div className="hero-actions" style={{ marginTop: "1rem" }}>
                <Badge tone={selectedVendor.status === "approved" ? "success" : "warning"}>
                  Vendor status: {selectedVendor.status}
                </Badge>
                <Badge tone="info">Platform fee: {Math.round(selectedVendor.platform_fee_rate * 100)}%</Badge>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="vendor-grid">
        <Card title="Revenue Summary" subtitle="Gross, fee, and net split.">
          <div className="form-grid">
            <div className="toggle-row">
              <span>Gross Revenue</span>
              <strong>{formatCurrency(grossRevenue)}</strong>
            </div>
            <div className="toggle-row">
              <span>Platform Fees</span>
              <strong>{formatCurrency(platformFees)}</strong>
            </div>
            <div className="toggle-row">
              <span>Net Revenue</span>
              <strong>{formatCurrency(netRevenue)}</strong>
            </div>
          </div>
        </Card>

        <Card title="Live Occupancy" subtitle="Real-time from active spot inventory.">
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={occupancyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(145, 158, 191, 0.2)" />
                <XAxis dataKey="name" stroke="#b7c0d4" />
                <YAxis stroke="#b7c0d4" />
                <Tooltip />
                <Bar dataKey="occupied" fill="#14b8a6" />
                <Bar dataKey="total" fill="#334155" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Spot Live Toggle" subtitle="Control user visibility in real-time.">
          <SpotManager
            spots={vendorSpots}
            onToggleStatus={(spotId, currentStatus) =>
              void toggleSpotStatus(spotId, currentStatus === "open" ? "closed" : "open")
            }
          />
        </Card>

        <Card title="Recent Sessions" subtitle="Latest check-ins and check-outs.">
          <div className="form-grid">
            {sessions.slice(0, 8).map((session) => (
              <div key={session.id} className="toggle-row">
                <span>
                  {session.vehicle_number} • {session.status}
                </span>
                <strong>{formatCurrency(session.amount || 0)}</strong>
              </div>
            ))}
            {!sessions.length ? <p className="card-subtitle">No sessions yet.</p> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
