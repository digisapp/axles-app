import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { CompareProvider } from "@/context/CompareContext";
import { CompareBar } from "@/components/listings/CompareBar";
import { FloatingCallButton } from "@/components/FloatingCallButton";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { PWAProvider } from "@/components/PWAInstallPrompt";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

// Organization JSON-LD Schema for rich search results
function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AxlonAI',
    url: 'https://axlon.ai',
    logo: 'https://axlon.ai/images/axlonai-logo.png',
    description: 'AI-powered marketplace for trucks, trailers, and equipment. Search with AI, get smart pricing, and list your equipment instantly.',
    foundingDate: '2024',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: '+1-469-421-3536',
      email: 'sales@axlon.ai',
      availableLanguage: 'English',
    },
    sameAs: [
      'https://instagram.com/axlonai',
      'https://facebook.com/axlonai',
      'https://twitter.com/axlonai',
      'https://linkedin.com/company/axlonai',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// WebSite JSON-LD Schema with SearchAction for sitelinks search box
function WebsiteJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AxlonAI',
    url: 'https://axlon.ai',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://axlon.ai/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

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
    default: "AxlonAI - AI-Powered Truck & Equipment Marketplace",
    template: "%s | AxlonAI",
  },
  description: "The future of buying and selling trucks, trailers, and equipment. AI-powered search, smart pricing, and instant listings.",
  keywords: ["trucks", "trailers", "heavy equipment", "marketplace", "semi trucks", "commercial vehicles", "Peterbilt", "Freightliner", "Kenworth", "Volvo", "buy trucks", "sell trucks"],
  authors: [{ name: "AxlonAI" }],
  creator: "AxlonAI",
  publisher: "AxlonAI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://axlon.ai"),
  openGraph: {
    title: "AxlonAI - AI-Powered Truck & Equipment Marketplace",
    description: "The future of buying and selling trucks, trailers, and equipment. Search with AI, get smart pricing, and list your equipment instantly.",
    type: "website",
    siteName: "AxlonAI",
    locale: "en_US",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "AxlonAI - Find Your Next Truck or Equipment",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AxlonAI - AI-Powered Truck & Equipment Marketplace",
    description: "The future of buying and selling trucks, trailers, and equipment.",
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
    icon: "/favicon.png",
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
      <head>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <NotificationProvider>
              <CompareProvider>
                <PWAProvider>
                  {children}
                  <CompareBar />
                  <FloatingCallButton />
                  <KeyboardShortcuts />
                  <div aria-live="polite" aria-atomic="true">
                    <Toaster position="top-right" richColors closeButton />
                  </div>
                </PWAProvider>
              </CompareProvider>
            </NotificationProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
