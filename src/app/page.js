import "./globals.css";

const WHOP_OAUTH_URL =
  "https://whop.com/oauth?client_id=y29DvHwAq_g71Sg-MRrX-1cLU2LgI7Du0onH-Xt-1QQ&redirect_uri=https://edgecheck.app/auth/callback&response_type=code";

export default function LandingPage() {
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
          AI-Powered Sports Betting Edge Analyzer
        </p>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            marginBottom: 40,
            lineHeight: 1.6,
          }}
        >
          Real-time odds from multiple sportsbooks. Instant AI analysis on every
          bet. Find your edge before the line moves.
        </p>

        <a
          href={WHOP_OAUTH_URL}
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
          Get Access
        </a>

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
            { label: "Live Odds", desc: "NFL, NBA, MLB, NHL & more" },
            { label: "AI Analysis", desc: "Instant edge detection" },
            { label: "Multi-Book", desc: "Compare across sportsbooks" },
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
