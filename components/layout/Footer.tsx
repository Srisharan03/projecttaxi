import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-shell" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p>Built for hackathon demos: real-time parking discovery, booking, and QR check-in.</p>
          <p>ParkSaathi © {new Date().getFullYear()}</p>
        </div>
        <Link href="/admin/dashboard" style={{ fontSize: "0.75rem", opacity: 0.5, color: "var(--text-primary)", textDecoration: "none" }}>
          Admin Portal
        </Link>
      </div>
    </footer>
  );
}
