"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";
import { ReportPublicSpotModal } from "@/components/community/ReportPublicSpotModal";
import { GlobalExpiryReminder } from "@/components/booking/GlobalExpiryReminder";
import { subscribeToUserSessions, subscribeToVendors, type Session, type Vendor } from "@/lib/firestore";

type SessionWithId = Session & { id: string };
type VendorWithId = Vendor & { id: string };

type NavItem = {
  href: string;
  label: string;
};

type NavIconName =
  | "home"
  | "login"
  | "dashboard"
  | "requests"
  | "register"
  | "scan"
  | "map"
  | "booking"
  | "profile"
  | "admin"
  | "report"
  | "logout"
  | "bell";

const DESKTOP_MEDIA_QUERY = "(min-width: 1080px)";

function NavIcon({ name }: { name: NavIconName }) {
  const common = { className: "side-nav-icon-svg", viewBox: "0 0 24 24", "aria-hidden": true } as const;

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M12 4L4 10V20H10V14H14V20H20V10L12 4Z" fill="currentColor" />
        </svg>
      );
    case "login":
      return (
        <svg {...common}>
          <path d="M10 17L15 12L10 7V10H3V14H10V17ZM19 3H12V7H19V17H12V21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" fill="currentColor" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M3 13H11V3H3V13ZM13 21H21V11H13V21ZM3 21H11V15H3V21ZM13 3V9H21V3H13Z" fill="currentColor" />
        </svg>
      );
    case "requests":
      return (
        <svg {...common}>
          <path d="M6 2H18V6H6V2ZM4 8H20V22H4V8ZM8 12V14H16V12H8ZM8 16V18H13V16H8Z" fill="currentColor" />
        </svg>
      );
    case "register":
      return (
        <svg {...common}>
          <path d="M19 11H13V5H11V11H5V13H11V19H13V13H19V11Z" fill="currentColor" />
          <path d="M3 3H9V9H3V3ZM15 15H21V21H15V15Z" fill="currentColor" opacity="0.5" />
        </svg>
      );
    case "scan":
      return (
        <svg {...common}>
          <path d="M3 3H9V5H5V9H3V3ZM15 3H21V9H19V5H15V3ZM3 15H5V19H9V21H3V15ZM19 15H21V21H15V19H19V15ZM7 7H17V17H7V7Z" fill="currentColor" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M15.5 5L8.5 2L2 4V20L8.5 18L15.5 21L22 19V3L15.5 5ZM15 18.8L9 16.5V4.2L15 6.5V18.8Z" fill="currentColor" />
        </svg>
      );
    case "booking":
      return (
        <svg {...common}>
          <path d="M7 2V4H17V2H19V4H22V22H2V4H5V2H7ZM4 10V20H20V10H4ZM6 12H10V16H6V12Z" fill="currentColor" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <path d="M12 12C14.2 12 16 10.2 16 8S14.2 4 12 4 8 5.8 8 8 9.8 12 12 12ZM12 14C8.7 14 6 16.7 6 20H18C18 16.7 15.3 14 12 14Z" fill="currentColor" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path d="M12 2L4 5V11C4 16.5 7.4 21.4 12 22C16.6 21.4 20 16.5 20 11V5L12 2ZM11 16L7 12L8.4 10.6L11 13.2L15.6 8.6L17 10L11 16Z" fill="currentColor" />
        </svg>
      );
    case "report":
      return (
        <svg {...common}>
          <path d="M14 2L4 8V22L14 16L22 19V5L14 2ZM14 14L10 16V9L14 7V14Z" fill="currentColor" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17L15 12L10 7V10H3V14H10V17ZM19 3H12V7H19V17H12V21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" fill="currentColor" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.9 16.4 5.3 13.5 4.4V4C13.5 3.2 12.8 2.5 12 2.5S10.5 3.2 10.5 4V4.4C7.6 5.3 6 7.9 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

function getNavIconForHref(href: string): NavIconName {
  if (href === "/") return "home";
  if (href.startsWith("/auth")) return "login";
  if (href.startsWith("/vendor/dashboard")) return "dashboard";
  if (href.startsWith("/vendor/requests")) return "requests";
  if (href.startsWith("/vendor/register")) return "register";
  if (href.startsWith("/scan")) return "scan";
  if (href.startsWith("/map")) return "map";
  if (href.startsWith("/booking")) return "booking";
  if (href.includes("profile")) return "profile";
  if (href.startsWith("/admin")) return "admin";
  return "home";
}

function NavAction({
  href,
  label,
  icon,
  active,
  showLabel,
  onClick,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  showLabel: boolean;
  onClick?: () => void;
}) {
  const className = cn("side-nav-link", active ? "side-nav-link-active" : "");

  if (href) {
    return (
      <Link href={href} className={className} title={label} onClick={onClick}>
        <span className="side-nav-item-icon" aria-hidden="true">{icon}</span>
        {showLabel ? <span className="side-nav-item-label">{label}</span> : null}
      </Link>
    );
  }

  return (
    <button type="button" className={cn(className, "side-nav-link-button")} title={label} onClick={onClick}>
      <span className="side-nav-item-icon" aria-hidden="true">{icon}</span>
      {showLabel ? <span className="side-nav-item-label">{label}</span> : null}
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { user, role, clearAuth } = useAuthStore();

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("park-saathi-side-nav-collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const [notificationEnabled, setNotificationEnabled] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    return Notification.permission === "granted";
  });
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [notifPanelStyle, setNotifPanelStyle] = useState<CSSProperties | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [vendorApprovalMessage, setVendorApprovalMessage] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notifRef = useRef<HTMLDivElement | null>(null);
  const notifButtonRef = useRef<HTMLButtonElement | null>(null);

  const reminderUserId = "demo-user";

  const handleLogout = async () => {
    await logout();
    clearAuth();
  };

  const navItems = useMemo<NavItem[]>(() => {
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
      return [{ href: "/admin/dashboard", label: "Admin Panel" }];
    }

    return [
      { href: "/map", label: "Find Parking" },
      { href: "/booking", label: "My Bookings" },
      { href: "/profile", label: "Profile" },
    ];
  }, [role, user]);

  const profileItem = useMemo(() => navItems.find((item) => item.href.includes("profile")) ?? null, [navItems]);
  const mainItems = useMemo(() => navItems.filter((item) => item !== profileItem), [navItems, profileItem]);

  const canReportPublicSpot = Boolean(user) && (role === "user" || role === "vendor");
  const reporterId = user?.uid || user?.email || "anonymous-user";
  const canShowBell = Boolean(user) && role === "user";
  const canShowVendorApprovalBanner = Boolean(user) && role === "vendor" && Boolean(vendorApprovalMessage);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const sync = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      if (desktop) {
        setMobileOpen(false);
      }
    };

    sync();
    media.addEventListener("change", sync);

    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("park-saathi-side-nav-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

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

      setVendorApprovalMessage("Admin approved your owner profile. Your spots are now live.");

      if (typeof window === "undefined" || !("Notification" in window)) {
        return;
      }

      const sendBrowserNotice = () => {
        try {
          new Notification("Parking Spots Approved", {
            body: "Admin approved your parking spots. They are now live.",
          });
        } catch {
          // Keep in-app banner even if browser notification fails.
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
    const updatePanelPosition = () => {
      if (!isDesktop || !notifButtonRef.current || typeof window === "undefined") {
        return;
      }

      const panelWidth = Math.min(304, window.innerWidth - 24);
      const rect = notifButtonRef.current.getBoundingClientRect();
      let left = rect.right + 10;
      if (left + panelWidth > window.innerWidth - 12) {
        left = Math.max(12, rect.left - panelWidth - 10);
      }

      const maxTop = Math.max(12, window.innerHeight - 220);
      const top = Math.max(12, Math.min(rect.top, maxTop));

      setNotifPanelStyle({
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
      });
    };

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((permission) => {
          setNotificationEnabled(permission === "granted");
          updatePanelPosition();
          setIsNotifPanelOpen(true);
        })
        .catch(() => {
          // Keep UX non-blocking if browser rejects prompt.
        });
      return;
    }

    setNotificationEnabled(Notification.permission === "granted");
    setIsNotifPanelOpen((prev) => {
      const next = !prev;
      if (next) {
        updatePanelPosition();
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isNotifPanelOpen || !isDesktop || typeof window === "undefined") {
      return;
    }

    const updatePanelPosition = () => {
      if (!notifButtonRef.current) {
        return;
      }

      const panelWidth = Math.min(304, window.innerWidth - 24);
      const rect = notifButtonRef.current.getBoundingClientRect();
      let left = rect.right + 10;
      if (left + panelWidth > window.innerWidth - 12) {
        left = Math.max(12, rect.left - panelWidth - 10);
      }

      const maxTop = Math.max(12, window.innerHeight - 220);
      const top = Math.max(12, Math.min(rect.top, maxTop));
      setNotifPanelStyle({
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
      });
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isDesktop, isNotifPanelOpen]);

  const sidebarExpanded = isDesktop ? !collapsed : mobileOpen;
  const showLabel = sidebarExpanded;

  return (
    <>
      {!isDesktop ? (
        <button
          type="button"
          className="side-nav-mobile-toggle"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      ) : null}

      {!isDesktop && mobileOpen ? (
        <button
          type="button"
          className="side-nav-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <aside
        className={cn(
          "side-nav glass-card",
          isDesktop ? "side-nav-desktop" : "side-nav-mobile",
          sidebarExpanded ? "side-nav-open" : "side-nav-collapsed",
        )}
      >
        <div className="side-nav-header">
          <Link href="/" className="brand-link side-nav-brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-dot" />
            <span className="side-nav-brand-text">ParkSaathi</span>
          </Link>

          {isDesktop ? (
            <button
              type="button"
              className="side-nav-collapse-btn"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? ">" : "<"}
            </button>
          ) : null}
        </div>

        <div className="side-nav-body">
          <nav className="side-nav-links" aria-label="Primary">
            {mainItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <NavAction
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={<NavIcon name={getNavIconForHref(item.href)} />}
                  active={active}
                  showLabel={showLabel}
                  onClick={() => setMobileOpen(false)}
                />
              );
            })}

            {canReportPublicSpot ? (
              <NavAction
                label="Report Public Spot"
                icon={<NavIcon name="report" />}
                showLabel={showLabel}
                onClick={() => {
                  setIsReportModalOpen(true);
                  setMobileOpen(false);
                }}
              />
            ) : null}

            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void handleLogout();
                }}
                className="side-nav-link side-nav-link-button side-nav-link-logout"
                title="Logout"
              >
                <span className="side-nav-item-icon" aria-hidden="true"><NavIcon name="logout" /></span>
                {showLabel ? <span className="side-nav-item-label">Logout</span> : null}
              </button>
            ) : null}
          </nav>

          {Boolean(user) && role === "user" ? (
            <div className="side-nav-banner-wrap">
              <GlobalExpiryReminder userId={reminderUserId} />
            </div>
          ) : null}

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

          <div className="side-nav-bottom">
            {canShowBell ? (
              <div className="side-nav-notif" ref={notifRef}>
                <button
                  ref={notifButtonRef}
                  type="button"
                  className={cn("side-nav-link side-nav-link-button", isNotifPanelOpen ? "side-nav-link-active" : "")}
                  title={notificationEnabled ? "Booking reminders" : "Enable booking reminders"}
                  aria-label={notificationEnabled ? "Booking reminders" : "Enable booking reminders"}
                  onClick={handleBellClick}
                >
                  <span className="side-nav-item-icon" aria-hidden="true"><NavIcon name="bell" /></span>
                  {showLabel ? <span className="side-nav-item-label">Notifications</span> : null}
                  {expiringSessions.length ? <span className="side-nav-notif-count">{expiringSessions.length}</span> : null}
                  <span className={cn("side-nav-notif-dot", notificationEnabled ? "side-nav-notif-dot-on" : "")} />
                </button>

                {isNotifPanelOpen ? (
                  <div className="side-nav-notif-panel" style={isDesktop ? notifPanelStyle : undefined}>
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

            {profileItem ? (
              <NavAction
                href={profileItem.href}
                label={profileItem.label}
                icon={<NavIcon name="profile" />}
                active={pathname.startsWith(profileItem.href)}
                showLabel={showLabel}
                onClick={() => setMobileOpen(false)}
              />
            ) : null}
          </div>
        </div>
      </aside>

      {canReportPublicSpot ? (
        <ReportPublicSpotModal
          open={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          userId={reporterId}
        />
      ) : null}
    </>
  );
}
