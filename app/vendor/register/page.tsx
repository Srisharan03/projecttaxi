import { RegistrationForm } from "@/components/vendor/RegistrationForm";
import { Card } from "@/components/ui";
import "@/styles/vendor.css";

export default function VendorRegisterPage() {
  return (
    <div className="vendor-page shell">
      <section className="section">
        <Card title="Vendor Registration" subtitle="Create your profile and register one or more parking spots.">
          <p className="card-subtitle">
            Step 1 collects vendor details and profile image. Step 2 lets you add multiple parking
            spots with photos, size, location, amenities, and pricing.
          </p>
        </Card>
      </section>

      <section className="section">
        <RegistrationForm />
      </section>
    </div>
  );
}
