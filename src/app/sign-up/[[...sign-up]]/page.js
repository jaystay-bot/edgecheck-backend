import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ color: "var(--accent)" }}>Edge</span>Check
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
          Create your account
        </p>
      </div>
      {clerkEnabled ? (
        <SignUp
          appearance={{
            elements: {
              rootBox: { width: "100%", maxWidth: 400 },
              card: { background: "var(--surface)", border: "1px solid var(--border)" },
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/verify-email"
        />
      ) : (
        <div style={{ padding: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, maxWidth: 400 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Auth not configured for local development.</p>
          <a href="/dashboard" style={{ color: "var(--accent)", fontSize: 14 }}>Go to Dashboard</a>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
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
  );
}
