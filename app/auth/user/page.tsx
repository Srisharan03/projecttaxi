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

export default function UserAuthPage() {
  const router = useRouter();
  const setRole = useAuthStore((state) => state.setRole);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      setRole("user");
      router.push("/map");
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
            <Badge tone="info">DRIVER ACCESS</Badge>
            <h2>{isLogin ? "Welcome back." : "Create your driver account."}</h2>
            <p>
              Keep your parking flow simple: authenticate, open map, choose spot, and continue quickly.
            </p>
            <div className="auth-checklist">
              <article className="auth-checkitem"><span className="auth-checkdot" />Realtime spot discovery</article>
              <article className="auth-checkitem"><span className="auth-checkdot" />Quick booking actions</article>
              <article className="auth-checkitem"><span className="auth-checkdot" />Clear status and session flow</article>
            </div>
          </div>
          <Image src="/car-mini.svg" alt="Driver login visual" width={420} height={220} />
        </aside>

        <Card
          className="auth-main-card"
          title={isLogin ? "Driver Sign In" : "Driver Sign Up"}
          subtitle="Use email and password to continue."
        >
          <form onSubmit={handleSubmit} className="form-grid">
            {!isLogin ? (
              <label className="auth-field">
                <span className="card-subtitle">Full Name</span>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
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

            <Button type="submit" size="lg" isLoading={loading} style={{ width: "100%" }}>
              {isLogin ? "Sign In" : "Create Account"}
            </Button>

            <div className="auth-switch-row">
              <span>{isLogin ? "Need an account?" : "Already have an account?"}</span>
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
