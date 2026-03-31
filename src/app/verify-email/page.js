"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    // If email is verified, redirect to dashboard
    if (user?.primaryEmailAddress?.verification?.status === "verified") {
      window.location.href = "/dashboard";
    }
  }, [isLoaded, user]);

  const handleResend = async () => {
    if (!user?.primaryEmailAddress) return;
    setChecking(true);
    try {
      await user.primaryEmailAddress.prepareVerification({ strategy: "email_code" });
      alert("Verification email sent! Check your inbox.");
    } catch (err) {
      alert("Failed to send verification email. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading...
      </div>
    );
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
      <div style={{ maxWidth: 400 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ color: "var(--accent)" }}>Edge</span>Check
        </h1>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          Verify Your Email
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 24 }}>
          We sent a verification email to{" "}
          <strong>{user?.primaryEmailAddress?.emailAddress}</strong>. Please
          check your inbox and click the verification link.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={handleRefresh}
            style={{
              padding: "12px 24px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            I&apos;ve Verified My Email
          </button>

          <button
            onClick={handleResend}
            disabled={checking}
            style={{
              padding: "12px 24px",
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: checking ? "not-allowed" : "pointer",
            }}
          >
            {checking ? "Sending..." : "Resend Verification Email"}
          </button>

          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            style={{
              padding: "12px 24px",
              background: "transparent",
              color: "var(--text-dim)",
              border: "none",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Sign out and use a different email
          </button>
        </div>
      </div>
    </div>
  );
}
