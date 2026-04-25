import { Badge, Button } from "@/components/ui";
import type { Vendor } from "@/lib/firestore";

type VendorWithId = Vendor & { id: string };

interface VendorTableProps {
  vendors: VendorWithId[];
  onOpenVendor: (vendor: VendorWithId) => void;
}

export function VendorTable({ vendors, onOpenVendor }: VendorTableProps) {
  return (
    <div className="admin-vendor-list-wrap">
      <div className="table-wrap admin-vendor-table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Email</th>
              <th>Status</th>
              <th>Spots</th>
              <th>Fee</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>{vendor.name}</td>
                <td>{vendor.email}</td>
                <td>
                  <Badge tone={vendor.status === "approved" ? "success" : "warning"}>{vendor.status}</Badge>
                </td>
                <td>{vendor.spots.length}</td>
                <td>{Math.round(vendor.platform_fee_rate * 100)}%</td>
                <td>
                  <Button size="sm" variant="secondary" onClick={() => onOpenVendor(vendor)}>
                    Open Review
                  </Button>
                </td>
              </tr>
            ))}
            {!vendors.length ? (
              <tr>
                <td colSpan={6}>No owners in this status.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-vendor-mobile-list">
        {!vendors.length ? (
          <p className="card-subtitle">No owners in this status.</p>
        ) : (
          vendors.map((vendor) => (
            <article key={vendor.id} className="glass-card admin-vendor-mobile-card">
              <div className="admin-vendor-mobile-head">
                <strong>{vendor.name}</strong>
                <Badge tone={vendor.status === "approved" ? "success" : "warning"}>{vendor.status}</Badge>
              </div>
              <p className="card-subtitle">{vendor.email}</p>
              <div className="admin-vendor-mobile-meta">
                <span>Spots: {vendor.spots.length}</span>
                <span>Fee: {Math.round(vendor.platform_fee_rate * 100)}%</span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onOpenVendor(vendor)}>
                Open Review
              </Button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
