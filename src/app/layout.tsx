import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AxlesAI - AI-Powered Truck & Equipment Marketplace",
  description: "The future of buying and selling trucks, trailers, and heavy equipment. AI-powered search, smart pricing, and instant listings.",
  keywords: ["trucks", "trailers", "heavy equipment", "marketplace", "semi trucks", "commercial vehicles", "Peterbilt", "Freightliner", "Kenworth"],
  openGraph: {
    title: "AxlesAI - AI-Powered Truck & Equipment Marketplace",
    description: "The future of buying and selling trucks, trailers, and heavy equipment.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
