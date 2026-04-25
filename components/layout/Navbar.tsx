"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/layout/MobileNav";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";
import { ReportPublicSpotModal } from "@/components/community/ReportPublicSpotModal";

export function Navbar() {
  const pathname = usePathname();
  const { user, role, clearAuth } = useAuthStore();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    clearAuth();
  };

  const getNavItems = () => {
    if (!user) {
      return [
        { href: "/", label: "Home" },
        { href: "/auth", label: "Login / Signup" },
      ];
    }

    if (role === "vendor") {
      return [
        { href: "/vendor/dashboard", label: "Dashboard" },
        { href: "/vendor/requests", label: "Booking Requests" },
        { href: "/vendor/register", label: "Register Spot" },
        { href: "/scan", label: "Verify OTP" },
      ];
    }

    if (role === "admin") {
      return [
        { href: "/admin/dashboard", label: "Admin Panel" },
      ];
    }

    // Default for USER
    return [
      { href: "/map", label: "Find Parking" },
      { href: "/booking", label: "My Bookings" },
    ];
  };

  const navItems = getNavItems();
  const canReportPublicSpot = Boolean(user) && (role === "user" || role === "vendor");
  const reporterId = user?.uid || user?.email || "anonymous-user";

  return (
    <header className="site-header glass-card">
      <div className="shell nav-shell">
        <Link href="/" className="brand-link">
          <span className="brand-dot" />
          <span style={{ fontWeight: 800 }}>ParkSaathi</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("nav-link", active ? "nav-link-active" : "")}>
                {item.label}
              </Link>
            );
          })}
          {canReportPublicSpot ? (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="nav-link"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              Report Public Spot
            </button>
          ) : null}
          {user && (
            <button onClick={handleLogout} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-danger)" }}>
              Logout
            </button>
          )}
        </nav>

        <MobileNav items={navItems} />
      </div>

      {canReportPublicSpot ? (
        <ReportPublicSpotModal
          open={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          userId={reporterId}
        />
      ) : null}
    </header>
  );
}
