import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
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
  title: {
    default: "AxlesAI - AI-Powered Truck & Equipment Marketplace",
    template: "%s | AxlesAI",
  },
  description: "The future of buying and selling trucks, trailers, and heavy equipment. AI-powered search, smart pricing, and instant listings.",
  keywords: ["trucks", "trailers", "heavy equipment", "marketplace", "semi trucks", "commercial vehicles", "Peterbilt", "Freightliner", "Kenworth", "Volvo", "buy trucks", "sell trucks"],
  authors: [{ name: "AxlesAI" }],
  creator: "AxlesAI",
  publisher: "AxlesAI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://axles.ai"),
  openGraph: {
    title: "AxlesAI - AI-Powered Truck & Equipment Marketplace",
    description: "The future of buying and selling trucks, trailers, and heavy equipment. Search with AI, get smart pricing, and list your equipment instantly.",
    type: "website",
    siteName: "AxlesAI",
    locale: "en_US",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "AxlesAI - Find Your Next Truck or Equipment",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AxlesAI - AI-Powered Truck & Equipment Marketplace",
    description: "The future of buying and selling trucks, trailers, and heavy equipment.",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
        <NotificationProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </NotificationProvider>
      </body>
    </html>
  );
}
