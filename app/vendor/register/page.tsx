import { RegistrationForm } from "@/components/vendor/RegistrationForm";
import { Card } from "@/components/ui";
import "@/styles/vendor.css";

export default function VendorRegisterPage() {
  return (
    <div className="vendor-page shell">
      <section className="section">
        <Card title="Vendor Registration" subtitle="Add your parking inventory to ParkSaathi.">
          <p className="card-subtitle">
            Provide your business details, upload verification docs, and submit your spot listing for
            admin approval.
          </p>
        </Card>
      </section>

      <section className="section">
        <RegistrationForm />
      </section>
    </div>
  );
}
