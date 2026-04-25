"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { GoogleMap, InfoWindowF, MarkerF, PolylineF } from "@react-google-maps/api";
import type { CommunitySpotAudit, CommunitySpotCluster, LatLng } from "@/lib/firestore";
import type { RankedSpot } from "@/lib/optimization";
import { Badge, Button, Modal } from "@/components/ui";

interface ParkingMapProps {
  spots: RankedSpot[];
  communitySpots?: Array<CommunitySpotCluster & { id: string }>;
  destination: LatLng;
  selectedSpotId: string | null;
  selectedRoutePath?: LatLng[];
  selectedRouteLabel?: string;
  selectedRouteEtaMinutes?: number;
  onSelectSpot: (spotId: string) => void;
  auditTargetClusterId?: string | null;
  onClearAuditTarget?: () => void;
  onAuditCommunitySpot?: (clusterId: string, status: "space_left" | "full", message?: string) => void;
  onLoadCommunityAuditHistory?: (
    clusterId: string,
  ) => Promise<Array<CommunitySpotAudit & { id: string }>>;
  auditingClusterId?: string | null;
}

const mapContainerStyle = {
  height: "100%",
  minHeight: "60vh",
  width: "100%",
  borderRadius: "18px",
};

function formatAgo(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    const minutes = Math.max(1, Math.floor((Date.now() - millis) / (60 * 1000)));
    return `${minutes} min ago`;
  }

  return "recently";
}

function formatAuditTimestamp(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return new Date(millis).toLocaleString();
  }

  return "Recently";
}

export function ParkingMap({
  spots,
  communitySpots = [],
  destination,
  selectedSpotId,
  selectedRoutePath = [],
  selectedRouteLabel,
  selectedRouteEtaMinutes,
  onSelectSpot,
  auditTargetClusterId,
  onClearAuditTarget,
  onAuditCommunitySpot,
  onLoadCommunityAuditHistory,
  auditingClusterId,
}: ParkingMapProps) {
  const [activeInfoSpotId, setActiveInfoSpotId] = useState<string | null>(null);
  const [activeCommunitySpotId, setActiveCommunitySpotId] = useState<string | null>(null);
  const [auditMessages, setAuditMessages] = useState<Record<string, string>>({});
  const [historyClusterId, setHistoryClusterId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<Array<CommunitySpotAudit & { id: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const center = useMemo(() => {
    const selected = spots.find((spot) => spot.id === selectedSpotId);
    if (selected) {
      return selected.location;
    }

    return destination;
  }, [spots, selectedSpotId, destination]);

  const historyCluster = useMemo(() => {
    return communitySpots.find((cluster) => cluster.id === historyClusterId) ?? null;
  }, [communitySpots, historyClusterId]);
  const openCommunitySpotId = auditTargetClusterId ?? activeCommunitySpotId;

  const openHistory = async (clusterId: string) => {
    if (!onLoadCommunityAuditHistory) {
      return;
    }

    setHistoryClusterId(clusterId);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const rows = await onLoadCommunityAuditHistory(clusterId);
      setHistoryRows(rows);
    } catch (historyLoadError) {
      setHistoryError(
        historyLoadError instanceof Error ? historyLoadError.message : "Unable to load audit history.",
      );
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      <div className="map-shell glass-card">
        <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={14}>
        {selectedRoutePath.length > 1 ? (
          <PolylineF
            path={selectedRoutePath}
            options={{
              strokeColor: "#2563eb",
              strokeOpacity: 0.9,
              strokeWeight: 5,
            }}
          />
        ) : null}
        <MarkerF
          position={destination}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#06b6d4",
            fillOpacity: 0.95,
            strokeColor: "#0e7490",
            strokeWeight: 2,
            scale: 8,
          }}
          title="Destination"
        />

        {spots.map((spot) => {
          const selected = selectedSpotId === spot.id;

          return (
            <MarkerF
              key={spot.id}
              position={spot.location}
              title={spot.name}
              label={selected ? { text: "P", color: "#111827", fontWeight: "700" } : undefined}
              onClick={() => {
                onSelectSpot(spot.id);
                setActiveInfoSpotId(spot.id);
              }}
            >
              {activeInfoSpotId === spot.id ? (
                <InfoWindowF onCloseClick={() => setActiveInfoSpotId(null)}>
                  <div>
                    {spot.images?.[0] ? (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <Image
                          src={spot.images[0]}
                          alt={`${spot.name} preview`}
                          width={260}
                          height={140}
                          unoptimized
                          style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                        />
                      </div>
                    ) : null}
                    <strong>{spot.name}</strong>
                    <div>{spot.address}</div>
                    <div>Status: {spot.status}</div>
                    <div>ETA: ~{spot.routeEtaMinutes} min</div>
                    <div>{spot.routeLabel}</div>
                  </div>
                </InfoWindowF>
              ) : null}
            </MarkerF>
          );
        })}

          {communitySpots.map((cluster) => (
            <MarkerF
              key={`community-${cluster.id}`}
              position={cluster.location}
              title={cluster.tag || "Community Public Spot"}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: "#f97316",
                fillOpacity: 0.95,
                strokeColor: "#c2410c",
                strokeWeight: 2,
                scale: 9,
              }}
              onClick={() => {
                setActiveCommunitySpotId(cluster.id);
                onClearAuditTarget?.();
              }}
            >
              {openCommunitySpotId === cluster.id ? (
                <InfoWindowF
                  onCloseClick={() => {
                    setActiveCommunitySpotId(null);
                    onClearAuditTarget?.();
                  }}
                >
                  <div style={{ maxWidth: "320px", display: "grid", gap: "0.5rem" }}>
                    <strong>Community Public Spot</strong>
                    <div>Tag: {cluster.tag || "Community Public Spot"}</div>
                    <div>Reporters: {cluster.report_count}</div>
                    <div>Reliability: {cluster.reliability_score || 0}%</div>
                    {cluster.latest_audit_status ? (
                      <div>
                        Latest update:{" "}
                        {cluster.latest_audit_status === "space_left"
                          ? "Parking available"
                          : "No parking (full)"}{" "}
                        ({formatAgo(cluster.latest_audit_at)})
                      </div>
                    ) : (
                      <div>Latest update: No audits yet.</div>
                    )}
                    {cluster.latest_audit_message ? (
                      <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                        Review: {cluster.latest_audit_message}
                      </div>
                    ) : null}
                    <div style={{ fontSize: "0.85rem", color: "#9a3412" }}>
                      Community-reported public space. It may already be occupied on arrival.
                    </div>
                    {onAuditCommunitySpot ? (
                      <>
                        <label style={{ display: "grid", gap: "0.2rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: 600 }}>
                            Add quick review (optional)
                          </span>
                          <textarea
                            value={auditMessages[cluster.id] || ""}
                            onChange={(event) =>
                              setAuditMessages((prev) => ({ ...prev, [cluster.id]: event.target.value.slice(0, 220) }))
                            }
                            placeholder="Example: 2 slots free near the gate."
                            style={{
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              padding: "0.45rem 0.55rem",
                              minHeight: "64px",
                              fontSize: "0.85rem",
                              resize: "vertical",
                            }}
                          />
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const message = auditMessages[cluster.id];
                              onAuditCommunitySpot(cluster.id, "space_left", message);
                              setAuditMessages((prev) => ({ ...prev, [cluster.id]: "" }));
                            }}
                            isLoading={auditingClusterId === cluster.id}
                          >
                            Parking Here
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const message = auditMessages[cluster.id];
                              onAuditCommunitySpot(cluster.id, "full", message);
                              setAuditMessages((prev) => ({ ...prev, [cluster.id]: "" }));
                            }}
                            isLoading={auditingClusterId === cluster.id}
                          >
                            No Parking
                          </Button>
                        </div>
                      </>
                    ) : null}
                    {onLoadCommunityAuditHistory ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void openHistory(cluster.id)}
                        isLoading={historyLoading && historyClusterId === cluster.id}
                      >
                        View Audit History
                      </Button>
                    ) : null}
                  </div>
                </InfoWindowF>
              ) : null}
            </MarkerF>
          ))}
        </GoogleMap>
      </div>
      {selectedRoutePath.length > 1 ? (
        <div className="glass-card" style={{ marginTop: "0.75rem", padding: "0.75rem" }}>
          <div className="hero-actions">
            <Badge tone="info">Selected Route</Badge>
            {typeof selectedRouteEtaMinutes === "number" ? (
              <Badge tone="success">ETA: ~{selectedRouteEtaMinutes} min</Badge>
            ) : null}
          </div>
          {selectedRouteLabel ? <p className="card-subtitle">{selectedRouteLabel}</p> : null}
        </div>
      ) : null}
      <Modal
        open={Boolean(historyClusterId)}
        onClose={() => setHistoryClusterId(null)}
        title={`${historyCluster?.tag || "Community Public Spot"} Audit History`}
        description="Latest updates are shown first. Use this to judge the spot before arriving."
      >
        {historyLoading ? <p className="card-subtitle">Loading audit history...</p> : null}
        {historyError ? <p className="card-subtitle">{historyError}</p> : null}
        {!historyLoading && !historyError && !historyRows.length ? (
          <p className="card-subtitle">No audit history yet for this public spot.</p>
        ) : null}
        {!historyLoading && !historyError && historyRows.length ? (
          <div className="form-grid">
            {historyRows.map((audit) => (
              <div key={audit.id} className="glass-card" style={{ padding: "0.75rem" }}>
                <div className="hero-actions" style={{ marginBottom: "0.4rem" }}>
                  <Badge tone={audit.status === "space_left" ? "success" : "danger"}>
                    {audit.status === "space_left" ? "Parking Here" : "No Parking"}
                  </Badge>
                  <Badge tone="neutral">{formatAuditTimestamp(audit.created_at)}</Badge>
                </div>
                <p className="card-subtitle" style={{ marginTop: 0 }}>
                  {audit.message?.trim() ? audit.message : "No message added."}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
