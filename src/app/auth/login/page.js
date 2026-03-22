"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";

const WHOP_URL = "https://whop.com/checkout/plan_nQHnE1nsW602p";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "No active membership found.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 400, width: "100%" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ color: "var(--accent)" }}>Edge</span>Check
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            marginBottom: 32,
          }}
        >
          Sign in with the email you used on Whop
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 15,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              outline: "none",
              marginBottom: 16,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 15,
              fontWeight: 700,
              background: loading ? "var(--border)" : "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Checking..." : "Get Access"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>
              {error}
            </p>
            <a
              href={WHOP_URL}
              style={{
                fontSize: 13,
                color: "var(--accent)",
                textDecoration: "underline",
              }}
            >
              Purchase access on Whop
            </a>
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              textDecoration: "underline",
            }}
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
