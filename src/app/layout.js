import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "EdgeCheck - Sports Betting Edge Analyzer",
  description: "AI-powered sports betting edge analysis",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
