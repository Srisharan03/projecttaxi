"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized, role, setRole } = useAuthStore();

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
        <p className="card-subtitle">Verifying user access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
