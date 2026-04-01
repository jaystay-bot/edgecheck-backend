import "./globals.css";

export default async function LandingPage() {
  let userId = null;

  // Only call auth() if Clerk is configured
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { auth } = await import("@clerk/nextjs/server");
    const authResult = await auth();
    userId = authResult.userId;
  }

  // If signed in, go to dashboard (Stripe subscription checked there)
  // If not signed in, go to sign-up
  const ctaHref = userId ? "/dashboard" : "/sign-up";
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
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ color: "var(--accent)" }}>Edge</span>Check
        </h1>
        <p
          style={{
            fontSize: 18,
            color: "var(--text-dim)",
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          Know What You&apos;re Betting
        </p>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            marginBottom: 40,
            lineHeight: 1.6,
          }}
        >
          Check any bet in seconds. See the risk, the strength, and whether
          it&apos;s worth playing — or worth skipping.
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            marginBottom: 32,
            fontStyle: "italic",
          }}
        >
          Most bets aren&apos;t good bets. This helps you avoid them.
        </p>

        <a
          href={ctaHref}
          style={{
            display: "inline-block",
            padding: "14px 40px",
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
            textDecoration: "none",
            transition: "background 0.15s",
          }}
        >
          Check a Bet
        </a>

        {!userId && (
          <div style={{ marginTop: 16 }}>
            <a
              href="/sign-in"
              style={{
                fontSize: 13,
                color: "var(--text-dim)",
                textDecoration: "underline",
              }}
            >
              Already a member? Sign in
            </a>
          </div>
        )}

        <div
          style={{
            marginTop: 48,
            display: "flex",
            justifyContent: "center",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Live Odds", desc: "Always see the current number before you bet" },
            { label: "Bet Breakdown", desc: "Edge rating, confidence, and risk in seconds" },
            { label: "Clear Decision", desc: "Know what's worth playing — and what to avoid" },
          ].map((item) => (
            <div key={item.label} style={{ minWidth: 120 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 20,
          fontSize: 12,
          color: "var(--text-dim)",
        }}
      >
        For entertainment purposes only. Please bet responsibly.
      </div>
    </div>
  );
}
