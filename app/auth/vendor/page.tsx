"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { loginWithEmail, registerWithEmail } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

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
    <div className="shell" style={{ maxWidth: "450px", margin: "4rem auto" }}>
      <Card title={isLogin ? "Vendor Login" : "Vendor Signup"} subtitle="Manage your parking space.">
        <form onSubmit={handleSubmit} className="form-grid">
          {!isLogin && (
            <label>
              <span className="card-subtitle">Business/Parking Name</span>
              <input 
                className="input" 
                type="text" 
                value={businessName} 
                onChange={(e) => setBusinessName(e.target.value)} 
                required 
              />
            </label>
          )}
          <label>
            <span className="card-subtitle">Email Address</span>
            <input 
              className="input" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </label>
          <label>
            <span className="card-subtitle">Password</span>
            <input 
              className="input" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </label>

          {error && <p style={{ color: "var(--text-danger)", fontSize: "0.9rem" }}>{error}</p>}

          <Button type="submit" variant="secondary" isLoading={loading} style={{ width: "100%", marginTop: "1rem" }}>
            {isLogin ? "Vendor Sign In" : "Register Business"}
          </Button>

          <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}>
            {isLogin ? "Not a vendor yet?" : "Already registered?"}{" "}
            <button 
              type="button" 
              onClick={() => setIsLogin(!isLogin)}
              style={{ color: "var(--text-primary)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {isLogin ? "Register Now" : "Log In"}
            </button>
          </p>
        </form>
      </Card>
    </div>
  );
}
