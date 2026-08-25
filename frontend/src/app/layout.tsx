import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAKSYNC — India Post Delivery Scheduling",
  description: "AI-assisted delivery scheduling & route planning for India Post.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
