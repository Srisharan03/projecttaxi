"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const role = useAuthStore((state) => state.role);
  const setRole = useAuthStore((state) => state.setRole);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
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
    if (initialized && user && role !== "vendor") {
      setRole("vendor");
      return;
    }

    if (initialized && !user) {
      router.push("/auth/vendor");
    } else if (initialized && role !== "vendor") {
      router.push("/");
    }
  }, [user, initialized, role, router, setRole]);

  if (!initialized || !user || role !== "vendor") {
    return (
      <div className="shell" style={{ padding: "4rem", textAlign: "center" }}>
        <p className="card-subtitle">
          {isStalled ? "Vendor access check is taking too long." : "Verifying vendor access..."}
        </p>
        {isStalled ? (
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.75rem" }}>
            <Button variant="secondary" onClick={() => router.push("/auth/vendor")}>Go to Vendor Login</Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
