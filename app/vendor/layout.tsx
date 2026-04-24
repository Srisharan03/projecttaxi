"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized, role } = useAuthStore();

  useEffect(() => {
    if (initialized && !user) {
      router.push("/auth");
    } else if (initialized && role !== "vendor") {
      router.push("/");
    }
  }, [user, initialized, role, router]);

  if (!initialized || !user || role !== "vendor") {
    return (
      <div className="shell" style={{ padding: "4rem", textAlign: "center" }}>
        <p className="card-subtitle">Verifying vendor access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
