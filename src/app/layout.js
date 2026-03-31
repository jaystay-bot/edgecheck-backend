import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "EdgeCheck - Sports Betting Edge Analyzer",
  description: "AI-powered sports betting edge analysis",
};

export default function RootLayout({ children }) {
  // Only wrap with ClerkProvider if credentials are configured
  const hasClerkCredentials = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en">
      <body>
        {hasClerkCredentials ? (
          <ClerkProvider>{children}</ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
