import Image from "next/image";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import "@/styles/landing.css";

export default function Home() {
  const valuePillars = [
    {
      title: "Clarity First",
      text: "One clear route from search to parking. No crowded UI, no noise.",
    },
    {
      title: "Realtime Confidence",
      text: "Spot availability and workflow actions update live while users navigate.",
    },
    {
      title: "MVP Practicality",
      text: "Everything important is visible fast: discover, book, verify, and exit.",
    },
  ];

  const journey = [
    {
      title: "Find",
      text: "Choose destination and vehicle profile to get relevant nearby spots.",
    },
    {
      title: "Decide",
      text: "Compare route-fit and price quickly with less visual clutter.",
    },
    {
      title: "Park",
      text: "Generate OTP/QR flow, verify entry and exit, then complete seamlessly.",
    },
  ];

  const realtimeHighlights = [
    "Live status sync between user, owner, and admin",
    "Approval workflow for owner spots",
    "Public spot reports with proof and audit trail",
    "Route-aware ranking for practical parking decisions",
  ];

  return (
    <div className="landing-page shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <Badge tone="info">MVP - REALTIME PARKING</Badge>
          <h1>Smarter Parking Operations Through Clarity, Accuracy, and Control</h1>
          <p>
            ParkSaathi is built for real decisions in real time. We keep the flow simple:
            find quickly, book confidently, and complete entry/exit without confusion.
          </p>
          <div className="hero-actions">
            <Link href="/auth">
              <Button size="lg">Start Parking</Button>
            </Link>
            <Link href="/vendor/register">
              <Button size="lg" variant="secondary">List A Spot</Button>
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-glow hero-glow-a" />
          <div className="hero-glow hero-glow-b" />
          <Image
            src="/car-hero.svg"
            alt="Modern car parking illustration"
            width={900}
            height={520}
            priority
            className="hero-car"
          />
          <div className="hero-floating-card">
            <Image src="/car-mini.svg" alt="Car visual card" width={240} height={120} />
            <p>Realtime parking guidance with clean decisions at every step.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="value-grid">
          {valuePillars.map((pillar) => (
            <Card key={pillar.title} className="value-card" title={pillar.title}>
              <p className="card-subtitle">{pillar.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <Card
          title="Parking Journey"
          subtitle="Designed to reduce stress, not add screens."
          className="journey-card"
        >
          <div className="journey-grid">
            {journey.map((step, index) => (
              <article className="journey-step" key={step.title}>
                <span className="journey-index">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <section className="section">
        <Card
          title="Realtime Foundation"
          subtitle="All key actions are aligned across user, owner, and admin."
          className="realtime-card"
        >
          <div className="realtime-list">
            {realtimeHighlights.map((item) => (
              <article key={item} className="realtime-item">
                <span className="realtime-dot" />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <section className="section">
        <Card className="cta-section" title="Ready to Launch Better Parking UX?" subtitle="Use the current feature set with a cleaner, calmer interface.">
          <div className="hero-actions">
            <Link href="/map">
              <Button size="lg">Open Map</Button>
            </Link>
            <Link href="/auth">
              <Button size="lg" variant="secondary">Login</Button>
            </Link>
          </div>
          <div className="cta-footnote">
            <p>No fake counters. No filler metrics. Just workflow clarity.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
