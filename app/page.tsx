import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import "@/styles/landing.css";

export default function Home() {
  const features = [
    "Live vendor status sync",
    "Smart ranking by distance, price, trust",
    "QR check-in/out with geofence validation",
    "Crowdsourced spot audits",
    "Vendor and admin control panels",
    "Route guidance with OpenRouteService",
    "Revenue transparency with platform fees",
  ];

  const steps = [
    "Search by area and vehicle type",
    "Review smart-ranked spots",
    "Book and generate QR session pass",
    "Pay with UPI or cash OTP",
    "Scan on arrival for geofenced check-in",
    "Scan on exit for checkout and billing",
    "Submit audits and earn verification credits",
  ];

  const testimonials = [
    {
      quote: "We turned random parking chaos into a live marketplace for our area.",
      name: "Naveen • Vendor",
    },
    {
      quote: "I book, scan, and park in under a minute now.",
      name: "Aadhya • Daily commuter",
    },
    {
      quote: "The live open/close toggle is the demo crowd favorite every time.",
      name: "Team Mentor",
    },
  ];

  return (
    <div className="landing-page shell">
      <section className="hero">
        <Badge tone="info">HACKATHON BUILD</Badge>
        <h1>Find trusted parking in seconds with real-time occupancy and QR entry.</h1>
        <p>
          ParkSaathi connects drivers with approved vendors through a live marketplace,
          geofenced check-ins, and optimization-driven ranking.
        </p>

        <div className="hero-actions">
          <Link href="/auth">
            <Button>Find Parking</Button>
          </Link>
          <Link href="/auth">
            <Button variant="secondary">List Your Space</Button>
          </Link>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">LIVE SPOTS</span>
            <span className="stat-value">1,200+</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">AVG. SAVE TIME</span>
            <span className="stat-value">18 min</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">VENDOR UPTIME</span>
            <span className="stat-value">98.4%</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 style={{ textAlign: "center", marginBottom: "2rem", fontSize: "2rem", fontWeight: 700 }}>Features that solve the chaos</h2>
        <div className="features-grid">
          {features.map((feature) => (
            <Card key={feature} title={feature}>
              <p className="card-subtitle">
                Built on Firebase real-time updates and modular Next.js route architecture.
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <Card title="How It Works" subtitle="From discovery to checkout in smooth steps.">
          <div className="timeline-grid">
            {steps.map((step, index) => (
              <article key={step} className="timeline-step">
                <Badge tone="info">Step {index + 1}</Badge>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <section className="section">
        <Card className="cta-section" title="Ready to join the revolution?" subtitle="Experience the future of urban parking today.">
          <div className="hero-actions">
            <Link href="/auth">
              <Button>Get Started Now</Button>
            </Link>
            <Link href="/auth">
              <Button variant="secondary">Become a Partner</Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
