"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

interface MobileNavProps {
  items: NavItem[];
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const normalizedPath = useMemo(() => pathname || "/", [pathname]);

  return (
    <div className="mobile-nav-wrapper">
      <button
        type="button"
        className="mobile-nav-trigger"
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Menu</span>
        <span className={cn("mobile-nav-burger", open ? "mobile-nav-burger-open" : "")} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={cn("mobile-nav-backdrop", open ? "mobile-nav-backdrop-open" : "")}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div className={cn("mobile-nav-menu", open ? "mobile-nav-menu-open" : "")} id="mobile-nav-menu">
        {items.map((item) => {
          const active =
            item.href === "/" ? normalizedPath === "/" : normalizedPath.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-link", active ? "nav-link-active" : "")}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
