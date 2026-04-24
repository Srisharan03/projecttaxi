"use client";

import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

export default function AuthSelectionPage() {
  const router = useRouter();
  const setRole = useAuthStore((state) => state.setRole);

  const handleSelect = (role: "user" | "vendor") => {
    setRole(role);
    router.push(`/auth/${role}`);
  };

  return (
    <div className="shell" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: "800px", width: "100%" }}>
        <h1 style={{ textAlign: "center", marginBottom: "2rem", fontSize: "2.5rem", fontWeight: 800 }}>
          How would you like to continue?
        </h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
          <Card 
            title="I am a Driver" 
            subtitle="Find, book, and navigate to parking spots in seconds."
          >
            <div style={{ marginTop: "1.5rem" }}>
              <Button onClick={() => handleSelect("user")} style={{ width: "100%" }}>
                Continue as User
              </Button>
            </div>
          </Card>

          <Card 
            title="I am a Vendor" 
            subtitle="List your parking space and manage live occupancy."
          >
            <div style={{ marginTop: "1.5rem" }}>
              <Button onClick={() => handleSelect("vendor")} variant="secondary" style={{ width: "100%" }}>
                Continue as Vendor
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
