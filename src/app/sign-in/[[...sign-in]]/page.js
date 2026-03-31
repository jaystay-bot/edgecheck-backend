import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
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
          Sign in to access your dashboard
        </p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: 400 },
            card: { background: "var(--surface)", border: "1px solid var(--border)" },
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/dashboard"
      />
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
