import { Badge, Button } from "@/components/ui";
import type { Vendor } from "@/lib/firestore";

type VendorWithId = Vendor & { id: string };

interface VendorTableProps {
  vendors: VendorWithId[];
  onOpenVendor: (vendor: VendorWithId) => void;
}

export function VendorTable({ vendors, onOpenVendor }: VendorTableProps) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Vendor</th>
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
                  Review
                </Button>
              </td>
            </tr>
          ))}
          {!vendors.length ? (
            <tr>
              <td colSpan={6}>No vendors in this status.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
