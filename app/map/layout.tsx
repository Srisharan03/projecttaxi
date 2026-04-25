"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized, role, setRole, initializeAuth } = useAuthStore();
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (initialized) return;

    const timeout = window.setTimeout(() => {
      setIsStalled(true);
    }, 8000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [initialized]);

  useEffect(() => {
    if (initialized && user && role !== "user") {
      setRole("user");
      return;
    }

    if (initialized && !user) {
      router.push("/auth");
    } else if (initialized && role !== "user") {
      router.push("/");
    }
  }, [user, initialized, role, router, setRole]);

  if (!initialized || !user || role !== "user") {
    return (
      <div className="shell" style={{ padding: "4rem", textAlign: "center" }}>
        <p className="card-subtitle">
          {isStalled ? "User access check is taking too long." : "Verifying user access..."}
        </p>
        {isStalled ? (
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.75rem" }}>
            <Button variant="secondary" onClick={() => router.push("/auth/user")}>Go to User Login</Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
