"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import "@/styles/auth.css";

export default function AuthSelectionPage() {
  const router = useRouter();
  const setRole = useAuthStore((state) => state.setRole);

  const handleSelect = (role: "user" | "vendor") => {
    setRole(role);
    router.push(`/auth/${role}`);
  };

  return (
    <div className="auth-page shell">
      <div className="auth-shell auth-role-layout">
        <section className="auth-hero">
          <div>
            <Badge tone="info">PARKING APP ACCESS</Badge>
            <h1>Choose your role and continue in one clean flow.</h1>
            <p>
              Driver and owner journeys are separated so each user gets the right actions,
              faster decisions, and less clutter from the first screen.
            </p>
          </div>
          <Image
            src="/car-hero.svg"
            alt="Parking experience visual"
            width={900}
            height={520}
            className="auth-hero-media"
            priority
          />
        </section>

        <section className="form-grid" style={{ alignContent: "center" }}>
          <Card className="auth-choice-card" title="I am a Driver" subtitle="Find, compare, and book parking quickly.">
            <div className="auth-choice-grid">
              <p className="auth-choice-text">Best for people who want to search near destination and park without confusion.</p>
              <Button size="lg" onClick={() => handleSelect("user")}>
                Continue as Driver
              </Button>
            </div>
          </Card>

          <Card className="auth-choice-card" title="I am an Owner" subtitle="Register and manage your parking inventory.">
            <div className="auth-choice-grid">
              <p className="auth-choice-text">Best for owners who want to list spots, handle requests, and track status in realtime.</p>
              <Button size="lg" variant="secondary" onClick={() => handleSelect("vendor")}>
                Continue as Owner
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
