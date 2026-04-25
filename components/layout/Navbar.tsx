"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/layout/MobileNav";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";
import { ReportPublicSpotModal } from "@/components/community/ReportPublicSpotModal";
import { GlobalExpiryReminder } from "@/components/booking/GlobalExpiryReminder";
import { subscribeToUserSessions, subscribeToVendors, type Session, type Vendor } from "@/lib/firestore";

type SessionWithId = Session & { id: string };
type VendorWithId = Vendor & { id: string };

export function Navbar() {
  const pathname = usePathname();
  const { user, role, clearAuth } = useAuthStore();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    return Notification.permission === "granted";
  });
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [vendorApprovalMessage, setVendorApprovalMessage] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notifRef = useRef<HTMLDivElement | null>(null);

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
        { href: "/vendor/profile", label: "Profile" },
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
      { href: "/profile", label: "Profile" },
    ];
  };

  const navItems = getNavItems();
  const canReportPublicSpot = Boolean(user) && (role === "user" || role === "vendor");
  const reporterId = user?.uid || user?.email || "anonymous-user";
  // Keep this aligned with booking page session ownership (currently demo-user in this app).
  const reminderUserId = "demo-user";
  const canShowBell = Boolean(user) && role === "user";
  const canShowVendorApprovalBanner = Boolean(user) && role === "vendor" && Boolean(vendorApprovalMessage);

  useEffect(() => {
    if (!canShowBell) {
      return;
    }

    return subscribeToUserSessions(reminderUserId, (rows) => setSessions(rows));
  }, [canShowBell, reminderUserId]);

  useEffect(() => {
    if (!user?.email || role !== "vendor") {
      return;
    }

    const normalizedEmail = user.email.toLowerCase();
    return subscribeToVendors((rows: VendorWithId[]) => {
      const mine = rows.find((vendor) => (vendor.email || "").toLowerCase() === normalizedEmail);
      if (!mine || mine.status !== "approved") {
        return;
      }

      const approvalKey = `vendor-approval-notified-${mine.id}`;
      const alreadyNotified =
        typeof window !== "undefined" && window.localStorage.getItem(approvalKey) === "1";
      if (alreadyNotified) {
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(approvalKey, "1");
      }

      setVendorApprovalMessage("Admin approved your parking profile. Your spots are now live.");

      if (typeof window === "undefined" || !("Notification" in window)) {
        return;
      }

      const sendBrowserNotice = () => {
        try {
          new Notification("Parking Spots Approved", {
            body: "Admin approved your parking spots. They are now live.",
          });
        } catch {
          // Keep banner notification even if browser notification fails.
        }
      };

      if (Notification.permission === "granted") {
        sendBrowserNotice();
      } else if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === "granted") {
              sendBrowserNotice();
            }
          })
          .catch(() => {
            // Ignore prompt failures and keep in-app banner.
          });
      }
    });
  }, [user, role]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotifPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const expiringSessions = useMemo(() => {
    return sessions
      .filter((session) => (session.approval_status ?? "accepted") === "accepted")
      .filter((session) => session.status === "checked_in")
      .filter((session) => session.end_time_ms > nowMs)
      .map((session) => ({
        ...session,
        minutesLeft: Math.ceil((session.end_time_ms - nowMs) / (60 * 1000)),
      }))
      .filter((session) => session.minutesLeft <= 10)
      .sort((left, right) => left.end_time_ms - right.end_time_ms);
  }, [sessions, nowMs]);

  const handleBellClick = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((permission) => {
          setNotificationEnabled(permission === "granted");
          setIsNotifPanelOpen(true);
        })
        .catch(() => {
          // Keep UX non-blocking if browser rejects prompt.
        });
      return;
    }

    setNotificationEnabled(Notification.permission === "granted");
    setIsNotifPanelOpen((prev) => !prev);
  };

  return (
    <header className="site-header glass-card">
      <div className="shell nav-shell">
        <Link href="/" className="brand-link">
          <span className="brand-dot" />
          <span style={{ fontWeight: 800 }}>ParkSaathi</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary">
          {canShowBell ? (
            <div className="nav-notif-wrap" ref={notifRef}>
              <button
                type="button"
                className="nav-bell"
                title={notificationEnabled ? "Booking reminders" : "Enable booking reminders"}
                aria-label={notificationEnabled ? "Booking reminders" : "Enable booking reminders"}
                onClick={handleBellClick}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3a6 6 0 0 0-6 6v3.8c0 .6-.2 1.2-.6 1.7l-1 1.2A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .8-1.3l-1-1.2a2.8 2.8 0 0 1-.6-1.7V9a6 6 0 0 0-6-6Zm0 18a3 3 0 0 0 2.7-1.7h-5.4A3 3 0 0 0 12 21Z"
                    fill="currentColor"
                  />
                </svg>
                <span className={notificationEnabled ? "nav-bell-dot nav-bell-dot-on" : "nav-bell-dot"} />
                {expiringSessions.length ? <span className="nav-bell-count">{expiringSessions.length}</span> : null}
              </button>

              {isNotifPanelOpen ? (
                <div className="nav-notif-panel">
                  <p className="nav-notif-title">Booking Notifications</p>
                  {expiringSessions.length ? (
                    <div className="nav-notif-list">
                      {expiringSessions.map((session) => (
                        <div key={session.id} className="nav-notif-item">
                          <p className="nav-notif-item-title">
                            Booking code <strong>{session.access_code}</strong> is about to expire
                          </p>
                          <p className="nav-notif-item-subtitle">
                            Ends in {session.minutesLeft} min at {new Date(session.end_time_ms).toLocaleTimeString()}.
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="nav-notif-empty">No bookings expiring in the next 10 minutes.</p>
                  )}

                  <Link href="/booking" className="nav-notif-link" onClick={() => setIsNotifPanelOpen(false)}>
                    Open My Bookings
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
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
      {Boolean(user) && role === "user" ? <GlobalExpiryReminder userId={reminderUserId} /> : null}
      {canShowVendorApprovalBanner ? (
        <div className="vendor-approval-banner">
          <p className="vendor-approval-text">{vendorApprovalMessage}</p>
          <button
            type="button"
            className="vendor-approval-dismiss"
            onClick={() => setVendorApprovalMessage("")}
          >
            Dismiss
          </button>
        </div>
      ) : null}

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
