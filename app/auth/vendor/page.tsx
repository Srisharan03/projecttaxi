"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { loginWithEmail, registerWithEmail } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import "@/styles/auth.css";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed";
}

export default function VendorAuthPage() {
  const router = useRouter();
  const setRole = useAuthStore((state) => state.setRole);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
        setRole("vendor");
        router.push("/vendor/dashboard");
      } else {
        await registerWithEmail(email, password);
        setRole("vendor");
        router.push("/vendor/register");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page shell">
      <div className="auth-form-wrap">
        <aside className="auth-form-side">
          <div>
            <Badge tone="success">OWNER ACCESS</Badge>
            <h2>{isLogin ? "Owner dashboard sign in." : "Register your parking business."}</h2>
            <p>
              Access booking requests, spot approvals, and operations in one streamlined workflow.
            </p>
            <div className="auth-checklist">
              <article className="auth-checkitem"><span className="auth-checkdot" />Spot registration flow</article>
              <article className="auth-checkitem"><span className="auth-checkdot" />Realtime request handling</article>
              <article className="auth-checkitem"><span className="auth-checkdot" />Admin approval status visibility</article>
            </div>
          </div>
          <Image src="/car-hero.svg" alt="Owner parking visual" width={900} height={520} />
        </aside>

        <Card
          className="auth-main-card"
          title={isLogin ? "Owner Sign In" : "Owner Sign Up"}
          subtitle="Use business credentials to continue."
        >
          <form onSubmit={handleSubmit} className="form-grid">
            {!isLogin ? (
              <label className="auth-field">
                <span className="card-subtitle">Business or Parking Name</span>
                <input
                  className="input"
                  type="text"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span className="card-subtitle">Email Address</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span className="card-subtitle">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <Button type="submit" size="lg" variant="secondary" isLoading={loading} style={{ width: "100%" }}>
              {isLogin ? "Owner Sign In" : "Create Owner Account"}
            </Button>

            <div className="auth-switch-row">
              <span>{isLogin ? "Need an owner account?" : "Already registered?"}</span>
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => setIsLogin((value) => !value)}
              >
                {isLogin ? "Sign Up" : "Log In"}
              </button>
            </div>

            <Link href="/auth" className="auth-role-back">
              <Button type="button" variant="ghost" size="sm">Back to role selection</Button>
            </Link>
          </form>
        </Card>
      </div>
    </div>
  );
}
