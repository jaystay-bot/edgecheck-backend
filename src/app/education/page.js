export const metadata = {
  title: "Education - EdgeCheck",
  description: "Learn responsible betting practices and how to use EdgeCheck effectively",
};

export default function EducationPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0e17",
      color: "#e2e8f0",
      padding: "32px 16px",
    }}>
      <div style={{
        maxWidth: "720px",
        margin: "0 auto",
      }}>
        {/* Header */}
        <header style={{ marginBottom: "40px" }}>
          <a
            href="/dashboard"
            style={{
              fontSize: "14px",
              color: "#9CA3AF",
              textDecoration: "none",
              display: "inline-block",
              marginBottom: "16px",
            }}
          >
            &larr; Back to Dashboard
          </a>
          <h1 style={{
            fontSize: "32px",
            fontWeight: "700",
            color: "#ffffff",
            marginBottom: "8px",
          }}>
            Betting Education
          </h1>
          <p style={{
            fontSize: "16px",
            color: "#9CA3AF",
          }}>
            Understanding the fundamentals of responsible sports betting.
          </p>
        </header>

        {/* Sections Container */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}>
          {/* Bankroll Discipline */}
          <section>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#ffffff",
              paddingBottom: "8px",
              borderBottom: "1px solid #243055",
              marginBottom: "16px",
            }}>
              Bankroll Discipline
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "15px",
              lineHeight: "1.7",
              color: "#D1D5DB",
            }}>
              <p>
                <strong style={{ color: "#ffffff" }}>Set a budget.</strong> Only bet money you can afford to lose.
                Your bankroll should be completely separate from rent, bills, and savings.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Use unit sizing.</strong> A standard approach is betting 1-2% of
                your bankroll per wager. This protects you from variance and losing streaks.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Never chase losses.</strong> Increasing bet sizes after losses
                is the fastest path to going broke. Stick to your unit size regardless of recent results.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Track everything.</strong> Keep records of every bet.
                This helps you identify leaks and stay accountable to your strategy.
              </p>
            </div>
          </section>

          {/* Emotional Control */}
          <section>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#ffffff",
              paddingBottom: "8px",
              borderBottom: "1px solid #243055",
              marginBottom: "16px",
            }}>
              Emotional Control
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "15px",
              lineHeight: "1.7",
              color: "#D1D5DB",
            }}>
              <p>
                <strong style={{ color: "#ffffff" }}>Detach from outcomes.</strong> Even +EV bets lose frequently.
                A 55% win rate means losing 45% of the time. Focus on process, not results.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Avoid tilt betting.</strong> Never place bets when angry,
                frustrated, or trying to &quot;get back&quot; at the books. Step away when emotions run high.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Set session limits.</strong> If you hit a predetermined loss
                limit for the day, stop. Tomorrow is another day with fresh opportunities.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Celebrate discipline, not wins.</strong> The goal is making
                good decisions consistently, not hitting parlays.
              </p>
            </div>
          </section>

          {/* Expected Value Basics */}
          <section>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#ffffff",
              paddingBottom: "8px",
              borderBottom: "1px solid #243055",
              marginBottom: "16px",
            }}>
              Expected Value Basics
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "15px",
              lineHeight: "1.7",
              color: "#D1D5DB",
            }}>
              <p>
                <strong style={{ color: "#ffffff" }}>What is EV?</strong> Expected Value measures the average
                profit or loss per bet over time. Positive EV (+EV) means the bet is profitable long-term.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>The math matters.</strong> If you flip a coin at +105 odds
                (true probability 50%), you have +2.4% EV. Over 1000 flips, you expect to profit.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Edge vs. variance.</strong> Having an edge doesn&apos;t guarantee
                short-term wins. You need volume for EV to materialize. Think in hundreds of bets, not singles.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Small edges compound.</strong> A consistent 2-3% edge, properly
                sized and repeated, builds significant returns over a season.
              </p>
            </div>
          </section>

          {/* Using EdgeCheck Responsibly */}
          <section>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#ffffff",
              paddingBottom: "8px",
              borderBottom: "1px solid #243055",
              marginBottom: "16px",
            }}>
              Using EdgeCheck Responsibly
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "15px",
              lineHeight: "1.7",
              color: "#D1D5DB",
            }}>
              <p>
                <strong style={{ color: "#ffffff" }}>EdgeCheck is a tool, not a guarantee.</strong> Our analysis
                identifies statistical edges, but sports are unpredictable. No system wins every bet.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Do your own research.</strong> Use EdgeCheck data as one input
                among many. Check injury reports, weather, and other factors before betting.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Understand the scores.</strong> Higher heater scores indicate
                stronger statistical support, but even 9+ rated plays lose regularly.
              </p>
              <p>
                <strong style={{ color: "#ffffff" }}>Don&apos;t bet every play.</strong> Being selective is part of
                the edge. It&apos;s okay to skip days with thin slates or uncertain data.
              </p>
            </div>
          </section>

          {/* Resources */}
          <section>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#ffffff",
              paddingBottom: "8px",
              borderBottom: "1px solid #243055",
              marginBottom: "16px",
            }}>
              If You Need Help
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "15px",
              lineHeight: "1.7",
              color: "#D1D5DB",
            }}>
              <p>
                Gambling should be entertainment, not a source of stress or financial hardship.
                If betting is causing problems in your life, help is available.
              </p>
              <p style={{ color: "#9CA3AF" }}>
                <strong style={{ color: "#ffffff" }}>National Problem Gambling Helpline:</strong> 1-800-522-4700
                <br />
                <span style={{ fontSize: "13px" }}>Free, confidential, 24/7</span>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer style={{
          textAlign: "center",
          color: "#6B7280",
          fontSize: "13px",
          paddingTop: "32px",
          marginTop: "40px",
          borderTop: "1px solid #243055",
        }}>
          <p>Bet responsibly. Know your limits.</p>
        </footer>
      </div>
    </div>
  );
}
