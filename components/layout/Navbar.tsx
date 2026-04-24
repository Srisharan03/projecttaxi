"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/layout/MobileNav";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";

export function Navbar() {
  const pathname = usePathname();
  const { user, role, clearAuth } = useAuthStore();

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
        { href: "/vendor/register", label: "Register Spot" },
        { href: "/scan", label: "Scan QR" },
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
          {user && (
            <button onClick={handleLogout} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-danger)" }}>
              Logout
            </button>
          )}
        </nav>

        <MobileNav items={navItems} />
      </div>
    </header>
  );
}
