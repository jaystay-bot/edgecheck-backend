import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "EdgeCheck - Sports Betting Edge Analyzer",
  description: "AI-powered sports betting edge analysis",
};

export default function RootLayout({ children }) {
  // Use publishable key check (available on both client and server)
  const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en">
      <body>
        {clerkEnabled ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
